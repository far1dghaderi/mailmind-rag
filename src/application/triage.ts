import { POLICY_INTENTS, UNKNOWN } from "../domain/intents.js";
import { parseEmails } from "../domain/parseEmails.js";
import { answerQuestion, type NoAnswerReason } from "./answerQuestion.js";
import { classifyEmail } from "./classifyEmail.js";
import type { ChunkStore, Embedder, Llm, ReadFile } from "./ports.js";
import type { SearchResult } from "./retrieve.js";

export type TriageResult =
  | { intent: string; confidence: number; status: "answered"; answer: string; citations: string[]; search: SearchResult }
  | { intent: string; confidence: number; status: "flagged"; reason: "intent_not_handled" | "empty_email" | NoAnswerReason; search?: SearchResult };

export type TriagedEmail = TriageResult & { email: number; label?: string; intentMatchesLabel: boolean };

type Deps = { llm: Llm; embedder: Embedder; store: ChunkStore };

// The raw email text (subject + body) is used as the retrieval query: no rewriting step.
export async function triageEmail(text: string, deps: Deps): Promise<TriageResult> {
  if (!text.trim()) return { intent: UNKNOWN, confidence: 0, status: "flagged", reason: "empty_email" };

  const { intent, confidence } = await classifyEmail(text, deps.llm);
  if (!(POLICY_INTENTS as readonly string[]).includes(intent)) {
    return { intent, confidence, status: "flagged", reason: "intent_not_handled" };
  }

  const a = await answerQuestion(text, deps);
  return a.answered
    ? { intent, confidence, status: "answered", answer: a.answer, citations: a.citations, search: a.search }
    : { intent, confidence, status: "flagged", reason: a.reason, search: a.search };
}

export async function triageFile(readFile: ReadFile, path: string, deps: Deps, only?: number[]): Promise<TriagedEmail[]> {
  const results: TriagedEmail[] = [];
  for (const { email, text, label } of parseEmails(await readFile(path))) {
    if (only && !only.includes(email)) continue;
    const r = await triageEmail(text, deps);
    results.push({ email, label, intentMatchesLabel: r.intent === label, ...r });
  }
  return results;
}
