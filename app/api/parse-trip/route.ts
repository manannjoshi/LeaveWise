import { NextResponse } from "next/server";
import { generateGroqJson, GroqError } from "@/lib/groq";
import type { Importance, TravelMode } from "@/lib/trip";

// Keep the AI request within Vercel Hobby's function limit.
export const maxDuration = 30;

const schema = {
  type: "object",
  properties: {
    origin: { type: "string", description: "Starting place, or an empty string if the user did not say one." },
    destination: { type: "string" },
    arriveBy: { type: "string", description: "Future local timestamp YYYY-MM-DDTHH:mm:ss in the user's timezone, or empty when missing." },
    mode: { type: "string", enum: ["car", "two-wheeler", "walk"] },
    importance: { type: "string", enum: ["casual", "important", "critical"] },
  },
  required: ["origin", "destination", "arriveBy", "mode", "importance"],
  additionalProperties: false,
};

type ParsedTrip = {
  origin: string;
  destination: string;
  arriveBy: string;
  mode: TravelMode;
  importance: Importance;
};

// Convert a local date/time from the user's timezone into a UTC ISO timestamp.
function localDateTimeToIso(value: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText = "0"] = match;
  const localParts = [yearText, monthText, dayText, hourText, minuteText, secondText].map(Number);
  const [year, month, day, hour, minute, second] = localParts;
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const isValidDate = new Date(localAsUtc).toISOString().startsWith(
    `${yearText}-${monthText}-${dayText}T${hourText}:${minuteText}:${secondText.padStart(2, "0")}`,
  );
  if (!isValidDate) return null;

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  // Two passes account for timezone offsets, including daylight saving changes.
  let utcGuess = localAsUtc;
  for (let pass = 0; pass < 2; pass += 1) {
    const zoned = Object.fromEntries(formatter.formatToParts(new Date(utcGuess)).map((part) => [part.type, part.value]));
    const representedAsUtc = Date.UTC(
      Number(zoned.year), Number(zoned.month) - 1, Number(zoned.day),
      Number(zoned.hour), Number(zoned.minute), Number(zoned.second),
    );
    utcGuess += localAsUtc - representedAsUtc;
  }

  const check = Object.fromEntries(formatter.formatToParts(new Date(utcGuess)).map((part) => [part.type, part.value]));
  if (year !== Number(check.year) || month !== Number(check.month) || day !== Number(check.day) ||
      hour !== Number(check.hour) || minute !== Number(check.minute) || second !== Number(check.second)) return null;
  return new Date(utcGuess).toISOString();
}

function normalizeArriveBy(value: unknown, timeZone: string) {
  if (typeof value !== "string") return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
  }
  return localDateTimeToIso(value, timeZone);
}

function tripValidationIssue(value: unknown, allowMissingOrigin = false): string | null {
  if (!value || typeof value !== "object") return "invalid_object";
  const trip = value as Partial<ParsedTrip>;
  const hasOrigin = typeof trip.origin === "string" && trip.origin.trim().length > 0;
  if (!allowMissingOrigin && !hasOrigin) return "invalid_origin";
  if (hasOrigin && trip.origin!.length > 160) return "invalid_origin";
  if (typeof trip.destination !== "string" || !trip.destination.trim() || trip.destination.length > 160) return "invalid_destination";
  if (typeof trip.arriveBy !== "string" || !Number.isFinite(Date.parse(trip.arriveBy))) return "invalid_arrival_time";
  if (Date.parse(trip.arriveBy) <= Date.now()) return "arrival_time_not_future";
  if (!["car", "two-wheeler", "walk"].includes(trip.mode ?? "")) return "invalid_travel_mode";
  if (!["casual", "important", "critical"].includes(trip.importance ?? "")) return "invalid_importance";
  return null;
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
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: "AI trip entry is not configured yet. Fill in the trip form below." }, { status: 503 });
  }

  const prompt = [
    "Extract a single trip from the user's sentence.",
    `Current instant: ${new Date().toISOString()}. User timezone: ${input.timeZone}.`,
    "Resolve relative days and times (such as Friday at 6am) to a future local timestamp in the user's timezone, formatted YYYY-MM-DDTHH:mm:ss WITHOUT a timezone or offset. Do not output a named timezone.",
    "Do not invent a missing origin, destination, or arrival time. If the origin is missing, return origin as an empty string so the app can ask whether to use the user's current location. If the user does not specify a travel mode use car; if they do not specify importance use important.",
    "Keep origin and destination as concise place names exactly specific enough for a place search. If the user says a personal place such as 'my hostel' and no address is given, preserve that phrase; do not guess its address.",
    "Return the JSON fields required by the schema.",
    `Trip description: ${JSON.stringify(input.text.trim())}`,
  ].join("\n");

  try {
    const trip = await generateGroqJson<ParsedTrip>(prompt, schema, 1_000, 12_000);
    const normalizedArriveBy = normalizeArriveBy(trip?.arriveBy, input.timeZone);
    const normalizedTrip = { ...trip, arriveBy: normalizedArriveBy ?? "" };
    const needsOrigin = typeof normalizedTrip.origin !== "string" || !normalizedTrip.origin.trim();
    const validationIssue = tripValidationIssue(normalizedTrip, needsOrigin);
    if (validationIssue) {
      // This diagnostic contains no place names, prompt text, or other personal trip data.
      console.info("Groq trip fields rejected", { reason: validationIssue });
      return NextResponse.json({ error: "I couldn't confidently find two places and a future arrival time. Fill in the trip form below." }, { status: 422 });
    }
    return NextResponse.json({
      needsOrigin,
      trip: {
        ...normalizedTrip,
        origin: typeof normalizedTrip.origin === "string" ? normalizedTrip.origin.trim() : "",
        destination: normalizedTrip.destination.trim(),
      },
    });
  } catch (error) {
    const code = error instanceof GroqError ? error.code : "unexpected";
    const status = error instanceof GroqError ? error.status : undefined;
    const providerDetails = error instanceof GroqError ? error.providerDetails : undefined;
    // Keep diagnostics useful without logging the API key or the user's location text.
    console.error("Groq trip parsing failed", { code, status, ...providerDetails });

    let message = "Groq couldn't read that trip right now. Your normal trip form is ready below.";
    if (status === 401 || status === 403) message = "Groq rejected the API key or its access. Check GROQ_API_KEY in Vercel.";
    else if (status === 429) message = "Groq's request limit was reached. Try again later or check your Groq limits.";
    else if (status === 400 || status === 404) message = "Groq rejected the request setup. Check the latest Vercel runtime log for the status.";
    else if (code === "timeout" || code === "network") message = "Groq did not respond in time. Check the connection and try again.";

    return NextResponse.json({ error: `${message} You can still use the trip form below.` }, { status: 502 });
  }
}
