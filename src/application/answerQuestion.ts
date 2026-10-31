import { parseAnswer, type Refusal } from "../domain/parseAnswer.js";
import { RETRIEVAL_DEFAULTS, search, type SearchResult } from "./retrieve.js";
import type { ChunkStore, Embedder, Hit, Llm } from "./ports.js";

export const ANSWER_PROMPT_VERSION = "v1";

export type AnswerResult =
  | { answered: true; answer: string; citations: string[] }
  | { answered: false; reason: "no_relevant_chunks" | Refusal; flagForHuman: true };

// The search is returned too, so a caller can show which chunks were found and which were used.
export type Answer = AnswerResult & { search: SearchResult };

const buildPrompt = (question: string, chunks: Hit[]) => `You answer customer questions for Northwind Goods using ONLY the context below.
Rules:
- Use only facts stated in the context. Do not add numbers, fees, time limits, or rules that are not there.
- If the context does not contain the answer, reply {"answer": null, "citations": []}.
- Cite the ids of the chunks you used.
Reply with only JSON: {"answer": "<short answer>", "citations": ["<chunk id>", ...]}

Context:
${chunks.map((c) => `[${c.id}] ${c.section}\n${c.text}`).join("\n\n")}

Question: ${question}`;

export async function answerQuestion(
  question: string,
  deps: { embedder: Embedder; store: ChunkStore; llm: Llm },
  options = RETRIEVAL_DEFAULTS,
): Promise<Answer> {
  const found = await search(question, deps.embedder, deps.store, options);
  const relevant = found.hits.filter((h) => h.relevant);
  if (!relevant.length) return { answered: false, reason: "no_relevant_chunks", flagForHuman: true, search: found };

  const parsed = parseAnswer(await deps.llm.complete(buildPrompt(question, relevant)), relevant, question);
  if (!parsed.ok) return { answered: false, reason: parsed.reason, flagForHuman: true, search: found };
  return { answered: true, answer: parsed.answer, citations: parsed.citations, search: found };
}
