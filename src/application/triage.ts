import { parseEmails } from "../domain/parseEmails.js";
import type { NoAnswerReason } from "./answerQuestion.js";
import type { ChunkStore, Embedder, Llm, ReadFile } from "./ports.js";
import type { SearchResult } from "./retrieve.js";
import { buildTriageGraph } from "./triageGraph.js";

export type TriageResult =
  | { intent: string; confidence: number; status: "answered"; answer: string; citations: string[]; search: SearchResult }
  | { intent: string; confidence: number; status: "flagged"; reason: "intent_not_handled" | "empty_email" | NoAnswerReason; search?: SearchResult };

export type TriagedEmail = TriageResult & { email: number; label?: string; intentMatchesLabel: boolean };

type Deps = { llm: Llm; embedder: Embedder; store: ChunkStore };

// The pipeline is a LangGraph graph (triageGraph.ts). The raw email text (subject + body) is the retrieval query: no rewriting step.
// shortcut: the graph is compiled on every call; compile once in the composition root if throughput ever matters.
export async function triageEmail(text: string, deps: Deps): Promise<TriageResult> {
  return (await buildTriageGraph(deps).invoke({ text })).result;
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
