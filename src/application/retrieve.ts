import type { ChunkStore, Embedder, Hit } from "./ports.js";

// shortcut: defaults come from 7 hand-checked questions (answerable top-1 scored 0.68-0.77, an unanswerable one 0.56); tune with the eval set.
export const RETRIEVAL_DEFAULTS = { k: 3, threshold: 0.6 };

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
