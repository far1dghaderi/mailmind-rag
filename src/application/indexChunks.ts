import type { Chunk } from "../domain/chunkPolicy.js";
import type { ChunkStore, Embedder, StoredChunk } from "./ports.js";

// Section headings are generated and can mislead, so what gets embedded is one line to change/evaluate.
export const embeddingText = (c: Chunk) => `${c.section}\n${c.text}`;

export async function indexChunks(chunks: Chunk[], embedder: Embedder, store: ChunkStore): Promise<number> {
  const vectors = await embedder.embedDocuments(chunks.map(embeddingText));
  const byDoc = new Map<string, StoredChunk[]>();
  chunks.forEach((c, i) => {
    const rows = byDoc.get(c.doc) ?? [];
    rows.push({ ...c, embedding: vectors[i]!, model: embedder.model });
    byDoc.set(c.doc, rows);
  });
  for (const [doc, rows] of byDoc) await store.replaceDoc(doc, rows);
  return chunks.length;
}
