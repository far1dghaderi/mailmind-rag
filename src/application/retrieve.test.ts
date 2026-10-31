import { test } from "node:test";
import assert from "node:assert/strict";
import { retrieve, search } from "./retrieve.js";
import type { ChunkStore, Embedder, Hit } from "./ports.js";

const hit = (id: string, similarity: number): Hit => ({ id, doc: "d", section: "S", text: "t", similarity });

function setup(hits: Hit[]) {
  const seen: any = {};
  const embedder: Embedder = {
    model: "m",
    embedDocuments: async () => [],
    embedQuery: async (q) => ((seen.query = q), [1, 2, 3]),
  };
  const store: ChunkStore = {
    replaceDoc: async () => {},
    search: async (embedding, model, k) => ((seen.args = { embedding, model, k }), hits),
  };
  return { embedder, store, seen };
}

test("embeds the question and searches with the embedder's model and k", async () => {
  const { embedder, store, seen } = setup([hit("a", 0.9)]);
  await retrieve("Can I return it?", embedder, store, { k: 2, threshold: 0.5 });
  assert.equal(seen.query, "Can I return it?");
  assert.deepEqual(seen.args, { embedding: [1, 2, 3], model: "m", k: 2 });
});

test("keeps only hits at or above the threshold, in the store's order", async () => {
  const { embedder, store } = setup([hit("a", 0.8), hit("b", 0.6), hit("c", 0.59)]);
  const hits = await retrieve("q", embedder, store, { k: 3, threshold: 0.6 });
  assert.deepEqual(hits.map((h) => h.id), ["a", "b"]);
});

test("returns an empty list when nothing is relevant enough", async () => {
  const { embedder, store } = setup([hit("a", 0.3)]);
  assert.deepEqual(await retrieve("q", embedder, store, { k: 3, threshold: 0.6 }), []);
});

test("rejects an empty question without calling the model", async () => {
  const { embedder, store, seen } = setup([]);
  await assert.rejects(retrieve("   ", embedder, store), /empty/);
  assert.equal(seen.query, undefined);
});

test("search keeps every top-k hit and flags which are relevant", async () => {
  const { embedder, store } = setup([hit("a", 0.8), hit("b", 0.59)]);
  assert.deepEqual(await search("q", embedder, store, { k: 3, threshold: 0.6 }), {
    threshold: 0.6,
    hits: [
      { ...hit("a", 0.8), relevant: true },
      { ...hit("b", 0.59), relevant: false },
    ],
  });
});
