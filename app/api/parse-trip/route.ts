import { NextResponse } from "next/server";
import { generateGeminiJson, GeminiError } from "@/lib/gemini";
import type { Importance, TravelMode } from "@/lib/trip";

const schema = {
  type: "OBJECT",
  properties: {
    origin: { type: "STRING" },
    destination: { type: "STRING" },
    arriveBy: { type: "STRING", description: "RFC3339 date and time with timezone offset, or empty when missing." },
    mode: { type: "STRING", enum: ["car", "two-wheeler", "walk"] },
    importance: { type: "STRING", enum: ["casual", "important", "critical"] },
  },
  required: ["origin", "destination", "arriveBy", "mode", "importance"],
};

type ParsedTrip = {
  origin: string;
  destination: string;
  arriveBy: string;
  mode: TravelMode;
  importance: Importance;
};

function validParsedTrip(value: unknown): value is ParsedTrip {
  if (!value || typeof value !== "object") return false;
  const trip = value as Partial<ParsedTrip>;
  const isoWithZone = typeof trip.arriveBy === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/.test(trip.arriveBy);
  return typeof trip.origin === "string" && trip.origin.trim().length > 0 && trip.origin.length <= 160 &&
    typeof trip.destination === "string" && trip.destination.trim().length > 0 && trip.destination.length <= 160 &&
    isoWithZone && Number.isFinite(Date.parse(trip.arriveBy!)) && Date.parse(trip.arriveBy!) > Date.now() &&
    ["car", "two-wheeler", "walk"].includes(trip.mode ?? "") &&
    ["casual", "important", "critical"].includes(trip.importance ?? "");
}

function validTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 100) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    const rawBody = await request.text();
    if (rawBody.length > 4_000) {
      return NextResponse.json({ error: "That trip description is too long. Keep it under 500 characters." }, { status: 413 });
    }
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Please enter a trip description." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Please enter a trip description." }, { status: 400 });
  }
  const input = body as { text?: unknown; timeZone?: unknown };
  if (typeof input.text !== "string" || input.text.trim().length < 8 || input.text.length > 500 || !validTimeZone(input.timeZone)) {
    return NextResponse.json({ error: "Enter a short trip description (up to 500 characters)." }, { status: 400 });
  }
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "AI trip entry is not configured yet. Fill in the trip form below." }, { status: 503 });
  }

  const prompt = [
    "Extract a single trip from the user's sentence.",
    `Current instant: ${new Date().toISOString()}. User timezone: ${input.timeZone}.`,
    "Resolve relative days and times (such as Friday at 6am) to a future RFC3339 timestamp with the correct timezone offset.",
    "Do not invent a missing origin, destination, or arrival time. If the user does not specify a travel mode use car; if they do not specify importance use important.",
    "Keep origin and destination as concise place names exactly specific enough for a place search. If the user says a personal place such as 'my hostel' and no address is given, preserve that phrase; do not guess its address.",
    "Return the JSON fields required by the schema.",
    `Trip description: ${JSON.stringify(input.text.trim())}`,
  ].join("\n");

  try {
    const trip = await generateGeminiJson<ParsedTrip>(prompt, schema, 220);
    if (!validParsedTrip(trip)) {
      return NextResponse.json({ error: "I couldn't confidently find two places and a future arrival time. Fill in the trip form below." }, { status: 422 });
    }
    return NextResponse.json({
      trip: { ...trip, origin: trip.origin.trim(), destination: trip.destination.trim() },
    });
  } catch (error) {
    const code = error instanceof GeminiError ? error.code : "unexpected";
    const status = error instanceof GeminiError ? error.status : undefined;
    // Keep diagnostics useful without logging the API key or the user's location text.
    console.error("Gemini trip parsing failed", { code, status });

    let message = "Gemini couldn't read that trip right now. Your normal trip form is ready below.";
    if (status === 401 || status === 403) message = "Gemini rejected the API key or its access. Check the Vercel key and Google AI Studio access.";
    else if (status === 429) message = "Gemini's request limit was reached. Try again later or check the key's quota.";
    else if (status === 400 || status === 404) message = "Gemini rejected the request setup. Check the latest Vercel runtime log for the status.";
    else if (code === "timeout" || code === "network") message = "Gemini did not respond in time. Check the connection and try again.";

    return NextResponse.json({ error: `${message} You can still use the trip form below.` }, { status: 502 });
  }
}
