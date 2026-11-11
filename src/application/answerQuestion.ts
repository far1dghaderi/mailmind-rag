import { parseAnswer, type Refusal } from "../domain/parseAnswer.js";
import { RETRIEVAL_DEFAULTS, search, type SearchResult } from "./retrieve.js";
import type { ChunkStore, Embedder, Hit, Llm } from "./ports.js";

export const ANSWER_PROMPT_VERSION = "v3";

export type NoAnswerReason = "no_relevant_chunks" | Refusal;

export type AnswerResult =
  | { answered: true; answer: string; citations: string[] }
  | { answered: false; reason: NoAnswerReason; flagForHuman: true };

// The search is returned too, so a caller can show which chunks were found and which were used.
export type Answer = AnswerResult & { search: SearchResult };

const buildPrompt = (question: string, chunks: Hit[]) => `You answer customer questions for Northwind Goods using ONLY the context below.
Rules:
- Use only facts stated in the context. Do not add numbers, fees, time limits, or rules that are not there.
- First decide whether the context states what is needed to answer the question. If it does not, set "answerable" to false and "answer" to null. Do not guess, and do not answer "no" just because the context is silent.
- If it does, set "answerable" to true and write one or two complete sentences a customer could be sent as written, starting with yes or no when the question asks for it.
- Cite the id of every chunk whose facts you used, including chunks that only support part of the answer.
Reply with only JSON: {"answerable": true or false, "answer": "<one or two complete sentences, or null>", "citations": ["<chunk id>", ...]}

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
