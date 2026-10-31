import { generateGeminiJson } from "@/lib/gemini";
import type { LeavePlan } from "@/lib/trip";

const schema = {
  type: "OBJECT",
  properties: { explanation: { type: "STRING" } },
  required: ["explanation"],
};

// Accept only a short line that uses numbers already calculated by the server.
function safeExplanation(value: unknown, allowedNumbers: number[]): value is string {
  if (typeof value !== "string" || value.length > 220 || /[\r\n]/.test(value)) return false;
  const words = value.trim().split(/\s+/);
  if (words.length > 30 || /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|dozen|hundred|thousand)\b/i.test(value)) return false;

  const numericTokens = value.match(/\b\d+(?:\.\d+)?%?\b/g) ?? [];
  return numericTokens.every((token) => allowedNumbers.some((number) => Number(token.replace("%", "")) === number));
}

export async function explainPlanWithGemini(plan: LeavePlan): Promise<string> {
  const fallback = plan.explanation;
  if (!process.env.GEMINI_API_KEY) return fallback;

  const facts = {
    travelMinutes: plan.durationMinutes,
    safetyMarginMinutes: plan.safetyMarginMinutes,
    fixedBufferMinutes: plan.fixedBufferMinutes,
    rainPenaltyMinutes: plan.weatherPenaltyMinutes,
    onTimeConfidencePercent: plan.confidence,
    marginMethod: plan.safetyMarginMethod,
  };
  const allowedNumbers = [
    facts.travelMinutes,
    facts.safetyMarginMinutes,
    facts.fixedBufferMinutes,
    facts.rainPenaltyMinutes,
    facts.onTimeConfidencePercent,
  ];

  try {
    const result = await generateGeminiJson<{ explanation: string }>(
      `Write one clear sentence explaining this recommendation using only these facts: ${JSON.stringify(facts)}. Do not add any new quantities, times, distances, or claims. Any digits in your sentence must match one of the supplied numeric values exactly. Do not spell numbers as words. Keep it under 25 words.`,
      schema,
      100,
      8_000,
    );
    return safeExplanation(result?.explanation, allowedNumbers) ? result.explanation.trim() : fallback;
  } catch {
    return fallback;
  }
}
