import { test } from "node:test";
import assert from "node:assert/strict";
import { ollamaEmbedder } from "./ollamaEmbedder.js";

const vec = (n: number) => Array.from({ length: n }, (_, i) => i / n);

function fake(embeddings: number[][], status = 200) {
  const calls: any[] = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(init.body as string) });
    return new Response(JSON.stringify({ embeddings }), { status });
  }) as typeof fetch;
  return { f, calls };
}

test("documents are prefixed and sent as one batch", async () => {
  const { f, calls } = fake([vec(768), vec(768)]);
  const out = await ollamaEmbedder({ fetch: f }).embedDocuments(["a", "b"]);
  assert.equal(out.length, 2);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://localhost:11434/api/embed");
  assert.equal(calls[0].body.model, "nomic-embed-text");
  assert.deepEqual(calls[0].body.input, ["search_document: a", "search_document: b"]);
});

test("query is prefixed with search_query:", async () => {
  const { f, calls } = fake([vec(768)]);
  const out = await ollamaEmbedder({ fetch: f }).embedQuery("q");
  assert.equal(out.length, 768);
  assert.deepEqual(calls[0].body.input, ["search_query: q"]);
});

test("rejects a wrong dimension and a non-2xx response", async () => {
  await assert.rejects(ollamaEmbedder({ fetch: fake([vec(10)]).f }).embedQuery("q"), /768/);
  await assert.rejects(ollamaEmbedder({ fetch: fake([], 500).f }).embedQuery("q"), /Ollama 500/);
});

test("rejects when the count of vectors differs from the inputs", async () => {
  await assert.rejects(ollamaEmbedder({ fetch: fake([vec(768)]).f }).embedDocuments(["a", "b"]), /expected 2/);
});
