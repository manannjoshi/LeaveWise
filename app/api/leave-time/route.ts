import { NextResponse } from "next/server";
import { planTrip } from "@/lib/plan-trip";
import { getLearnedSafetyMargin, validResidualsFromRequest } from "@/lib/calibration";
import { isTripRequest } from "@/lib/validate-trip";
import { explainPlanWithGemini } from "@/lib/plan-explanation";

// Route, weather, and optional AI explanation calls can take longer together.
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Please send valid trip details." }, { status: 400 });
  }

  if (!isTripRequest(body)) {
    return NextResponse.json({ error: "Please complete each trip field." }, { status: 400 });
  }

  if (Date.parse(body.arriveBy) <= Date.now()) {
    return NextResponse.json({ error: "Arrive-by time must be in the future." }, { status: 400 });
  }

  const requestBody = body as typeof body & { historyResiduals?: unknown };
  const residuals = validResidualsFromRequest(requestBody.historyResiduals);
  const calibration = getLearnedSafetyMargin(residuals, body.importance);
  const plan = await planTrip(body, calibration);
  // AI wording is optional; the calculation and fallback explanation are deterministic.
  plan.explanation = await explainPlanWithGemini(plan);
  return NextResponse.json(plan);
}
