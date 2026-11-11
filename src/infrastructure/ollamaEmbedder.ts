import type { Embedder } from "../application/ports.js";
import { ollamaPost, unexpectedReply } from "./ollamaFetch.js";

interface Options {
  baseUrl?: string;
  model?: string;
  dimensions?: number;
  fetch?: typeof fetch;
}

export const ollamaEmbedder = ({
  baseUrl = "http://localhost:11434",
  model = "nomic-embed-text",
  dimensions = 768,
  fetch: doFetch = fetch,
}: Options = {}): Embedder => {
  async function embed(inputs: string[]): Promise<number[][]> {
    const reply = await ollamaPost(doFetch, baseUrl, "/api/embed", { model, input: inputs });
    if (!Array.isArray(reply?.embeddings)) throw unexpectedReply("embeddings");
    const embeddings: number[][] = reply.embeddings;
    if (embeddings.length !== inputs.length) throw new Error(`expected ${inputs.length} embeddings, got ${embeddings.length}`);
    for (const e of embeddings) if (e.length !== dimensions) throw new Error(`expected ${dimensions} dimensions, got ${e.length}`);
    return embeddings;
  }

  return {
    model,
    embedDocuments: (texts) => embed(texts.map((t) => `search_document: ${t}`)),
    embedQuery: async (text) => (await embed([`search_query: ${text}`]))[0]!,
  };
};
