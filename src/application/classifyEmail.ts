import { INTENTS, UNKNOWN } from "../domain/intents.js";
import { parseClassification, type Classification } from "../domain/parseClassification.js";
import type { Llm } from "./ports.js";

const buildPrompt = (email: string) => `Classify the email below into exactly one of these intents:
${INTENTS.join(", ")}
If it fits none of them, use "${UNKNOWN}".
Reply with only JSON: {"intent": "<intent>", "accuracy": <confidence 0-100>}

<email>
${email}
</email>`;

export async function classifyEmail(email: string, llm: Llm): Promise<Classification> {
  return parseClassification(await llm.complete(buildPrompt(email)));
}
