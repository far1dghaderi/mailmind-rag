import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTriageGraph } from "./triageGraph.js";
import type { ChunkStore, Embedder, Hit, Llm } from "./ports.js";

const chunk: Hit = { id: "a#1", doc: "d", section: "S", text: "Sale items are final sale.", similarity: 0.8 };

function deps(intent: string, hits: Hit[] = [chunk]) {
  const llm: Llm = {
    complete: async (p) => (p.includes("Classify the email") ? `{"intent":"${intent}","confidence":90}` : `{"answerable":true,"answer":"Final sale.","citations":["a#1"]}`),
  };
  const embedder: Embedder = { model: "m", embedDocuments: async () => [], embedQuery: async () => [1] };
  const store: ChunkStore = { replaceDoc: async () => {}, search: async () => hits };
  return { llm, embedder, store };
}

// The nodes that ran, in order.
async function route(text: string, d: ReturnType<typeof deps>) {
  const visited: string[] = [];
  for await (const update of await buildTriageGraph(d).stream({ text }, { streamMode: "updates" })) visited.push(...Object.keys(update));
  return visited;
}

test("a policy email goes check, classify, retrieve, answer", async () => {
  assert.deepEqual(await route("Can I return a sale item?", deps("return_exchange")), ["check", "classify", "retrieve", "answer"]);
});

test("each way out goes to the flag node and skips the stages after it", async () => {
  assert.deepEqual(await route("  ", deps("return_exchange")), ["check", "flag"]);
  assert.deepEqual(await route("Where is my order?", deps("order_status")), ["check", "classify", "flag"]);
  assert.deepEqual(await route("Can I return a sale item?", deps("return_exchange", [])), ["check", "classify", "retrieve", "flag"]);
});
