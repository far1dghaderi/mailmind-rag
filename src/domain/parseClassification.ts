import { INTENTS, UNKNOWN } from "./intents.js";

export interface Classification {
  intent: string;
  confidence: number; // the model's own 0-100 self-reported certainty, not measured accuracy
}

// Provider-agnostic: takes whatever text a model returned.
export function parseClassification(raw: string): Classification {
  try {
    const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "");
    const known = (INTENTS as readonly string[]).includes(parsed.intent);
    const confidence = Math.min(100, Math.max(0, Number(parsed.confidence) || 0));
    return { intent: known ? parsed.intent : UNKNOWN, confidence };
  } catch {
    return { intent: UNKNOWN, confidence: 0 };
  }
}
