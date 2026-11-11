import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { POLICY_INTENTS, UNKNOWN } from "../domain/intents.js";
import { answerFromSearch, type NoAnswerReason } from "./answerQuestion.js";
import { classifyEmail } from "./classifyEmail.js";
import type { ChunkStore, Embedder, Llm } from "./ports.js";
import { search, type SearchResult } from "./retrieve.js";
import type { TriageResult } from "./triage.js";

type FlagReason = "intent_not_handled" | "empty_email" | NoAnswerReason;

const State = Annotation.Root({
  text: Annotation<string>(),
  intent: Annotation<string>(),
  confidence: Annotation<number>(),
  search: Annotation<SearchResult | undefined>(),
  reason: Annotation<FlagReason | undefined>(), // set by any node that decides the email needs a human
  result: Annotation<TriageResult>(),
});

type Deps = { llm: Llm; embedder: Embedder; store: ChunkStore };

// check -> classify -> retrieve -> answer, and every early exit goes to flag. The raw email text is the retrieval query.
export function buildTriageGraph({ llm, embedder, store }: Deps) {
  const toFlagOr = (next: string) => (s: typeof State.State) => (s.reason ? "flag" : next);

  return new StateGraph(State)
    .addNode("check", (s) => (s.text.trim() ? {} : { intent: UNKNOWN, confidence: 0, reason: "empty_email" as const }))
    .addNode("classify", async (s) => {
      const { intent, confidence } = await classifyEmail(s.text, llm);
      return (POLICY_INTENTS as readonly string[]).includes(intent) ? { intent, confidence } : { intent, confidence, reason: "intent_not_handled" as const };
    })
    .addNode("retrieve", async (s) => {
      const found = await search(s.text, embedder, store);
      return found.hits.some((h) => h.relevant) ? { search: found } : { search: found, reason: "no_relevant_chunks" as const };
    })
    .addNode("answer", async (s) => {
      const a = await answerFromSearch(s.text, s.search!, llm);
      if (!a.answered) return { reason: a.reason };
      return { result: { intent: s.intent, confidence: s.confidence, status: "answered" as const, answer: a.answer, citations: a.citations, search: s.search! } };
    })
    .addNode("flag", (s) => ({
      result: { intent: s.intent, confidence: s.confidence, status: "flagged" as const, reason: s.reason!, ...(s.search && { search: s.search }) },
    }))
    .addEdge(START, "check")
    .addConditionalEdges("check", toFlagOr("classify"), ["flag", "classify"])
    .addConditionalEdges("classify", toFlagOr("retrieve"), ["flag", "retrieve"])
    .addConditionalEdges("retrieve", toFlagOr("answer"), ["flag", "answer"])
    .addConditionalEdges("answer", (s) => (s.reason ? "flag" : END), ["flag", END])
    .addEdge("flag", END)
    .compile();
}
