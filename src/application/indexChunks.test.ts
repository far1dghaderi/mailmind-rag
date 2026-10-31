import { test } from "node:test";
import assert from "node:assert/strict";
import { embeddingText, indexChunks } from "./indexChunks.js";
import type { ChunkStore, Embedder, StoredChunk } from "./ports.js";

const chunk = (id: string, doc: string, section: string, text: string) => ({ id, doc, section, text });

test("embeddingText puts the section before the text", () => {
  assert.equal(embeddingText(chunk("r#1", "r", "1. Sec", "body")), "1. Sec\nbody");
});

test("embeds all chunks in one batch and replaces each document", async () => {
  const batches: string[][] = [];
  const embedder: Embedder = {
    model: "m",
    embedDocuments: async (t) => (batches.push(t), t.map((_, i) => [i])),
    embedQuery: async () => [0],
  };
  const stored = new Map<string, StoredChunk[]>();
  const store: ChunkStore = { replaceDoc: async (doc, rows) => void stored.set(doc, rows) };

  const n = await indexChunks(
    [chunk("a#1", "a", "S1", "t1"), chunk("a#2", "a", "S2", "t2"), chunk("b#1", "b", "S3", "t3")],
    embedder,
    store,
  );

  assert.equal(n, 3);
  assert.deepEqual(batches, [["S1\nt1", "S2\nt2", "S3\nt3"]]);
  assert.deepEqual([...stored.keys()], ["a", "b"]);
  assert.deepEqual(stored.get("a")!.map((r) => [r.id, r.embedding, r.model, r.text]), [
    ["a#1", [0], "m", "t1"],
    ["a#2", [1], "m", "t2"],
  ]);
  assert.equal(stored.get("b")![0]!.embedding[0], 2);
});
