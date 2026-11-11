import type { ChunkStore, Embedder, Hit } from "./ports.js";

// Chosen with scripts/sweep-retrieval.ts on the 80-question eval set: k=5, cutoff 0.55 finds the right chunk for 94% of answerable questions (k=3, 0.6 found 83%).
// shortcut: the cutoff barely separates answerable from unanswerable (14 of 16 unanswerable pass even 0.6); the model's answerable flag does that job. Revisit with a reranker.
export const RETRIEVAL_DEFAULTS = { k: 5, threshold: 0.55 };

export type ScoredHit = Hit & { relevant: boolean };
export interface SearchResult {
  threshold: number;
  hits: ScoredHit[];
}

// Top-k chunks with every score, and a flag for those above the cutoff. Used by the UI and the eval.
export async function search(
  question: string,
  embedder: Embedder,
  store: ChunkStore,
  { k, threshold } = RETRIEVAL_DEFAULTS,
): Promise<SearchResult> {
  if (!question.trim()) throw new Error("question is empty");
  const hits = await store.search(await embedder.embedQuery(question), embedder.model, k);
  return { threshold, hits: hits.map((h) => ({ ...h, relevant: h.similarity >= threshold })) };
}

// Only the relevant chunks, best first. An empty list means "nothing found": the caller must refuse.
export async function retrieve(
  question: string,
  embedder: Embedder,
  store: ChunkStore,
  options = RETRIEVAL_DEFAULTS,
): Promise<Hit[]> {
  return (await search(question, embedder, store, options)).hits.filter((h) => h.relevant);
}
