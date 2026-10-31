export type Refusal = "model_declined" | "invalid_output" | "no_valid_citation" | "ungrounded_numbers";

export type ParsedAnswer =
  | { ok: true; answer: string; citations: string[] }
  | { ok: false; reason: Refusal };

const numbers = (s: string) => s.match(/\d+(?:\.\d+)?/g) ?? [];
const fail = (reason: Refusal): ParsedAnswer => ({ ok: false, reason });

// Provider-agnostic: validates whatever a model returned against the chunks it was given.
export function parseAnswer(raw: string, chunks: { id: string; text: string }[], question: string): ParsedAnswer {
  let parsed: any;
  try {
    parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "");
  } catch {
    return fail("invalid_output");
  }
  if (!parsed || typeof parsed !== "object") return fail("invalid_output");

  const { answer } = parsed;
  if (answer === null || (typeof answer === "string" && !answer.trim())) return fail("model_declined");
  if (typeof answer !== "string") return fail("invalid_output");

  // Only chunks we actually gave the model can be cited.
  const cited = chunks.filter((c) => Array.isArray(parsed.citations) && parsed.citations.includes(c.id));
  if (!cited.length) return fail("no_valid_citation");

  // Every number in the answer must come from the question or a cited chunk (the model must not invent figures).
  const allowed = new Set(numbers([question, ...cited.map((c) => c.text)].join(" ")));
  const withoutIds = answer.replace(/\b[\w-]+#\d+\b/g, "");
  if (numbers(withoutIds).some((n) => !allowed.has(n))) return fail("ungrounded_numbers");

  return { ok: true, answer: answer.trim(), citations: cited.map((c) => c.id) };
}
