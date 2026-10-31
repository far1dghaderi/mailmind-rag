import type { Embedder } from "../application/ports.js";

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
    const res = await doFetch(`${baseUrl}/api/embed`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model, input: inputs }),
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
    const { embeddings } = (await res.json()) as { embeddings: number[][] };
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
