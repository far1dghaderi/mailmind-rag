import { INTENTS, UNKNOWN } from "./intents.js";

export interface Classification {
  intent: string;
  accuracy: number;
}

// Provider-agnostic: takes whatever text a model returned.
export function parseClassification(raw: string): Classification {
  try {
    const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "");
    const known = (INTENTS as readonly string[]).includes(parsed.intent);
    const accuracy = Math.min(100, Math.max(0, Number(parsed.accuracy) || 0));
    return { intent: known ? parsed.intent : UNKNOWN, accuracy };
  } catch {
    return { intent: UNKNOWN, accuracy: 0 };
  }
}
