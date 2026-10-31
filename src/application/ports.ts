// The only contract the app has with any language model.
export interface Llm {
  complete(prompt: string): Promise<string>;
}
export type ReadFile = (path: string) => Promise<string>;

// Prefixes like nomic's "search_document:" belong inside an adapter, not here.
export interface Embedder {
  model: string;
  embedDocuments(texts: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
}

export interface StoredChunk {
  id: string;
  doc: string;
  section: string;
  text: string;
  embedding: number[];
  model: string;
}

export interface ChunkStore {
  // Replaces every chunk of one document atomically, so a re-index never leaves stale rows.
  replaceDoc(doc: string, rows: StoredChunk[]): Promise<void>;
}
