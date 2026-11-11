import { test } from "node:test";
import assert from "node:assert/strict";
import { ollamaLlm } from "./ollamaLlm.js";
import { ollamaEmbedder } from "./ollamaEmbedder.js";

const down = (async () => {
  throw new TypeError("fetch failed");
}) as typeof fetch;

test("Ollama not running: the llm fails with a clear 503, not a bare 'fetch failed'", async () => {
  await assert.rejects(ollamaLlm({ baseUrl: "http://h:1", fetch: down }).complete("p"), (e: any) => e.status === 503 && /not reachable at http:\/\/h:1/.test(e.message));
});

test("Ollama not running: the embedder fails with the same clear 503", async () => {
  await assert.rejects(ollamaEmbedder({ baseUrl: "http://h:1", fetch: down }).embedQuery("q"), (e: any) => e.status === 503 && /not reachable/.test(e.message));
});

test("a 200 reply without the expected shape is a clear error, not a TypeError", async () => {
  const odd = (async () => new Response(JSON.stringify({}))) as typeof fetch;
  await assert.rejects(ollamaLlm({ fetch: odd }).complete("p"), /unexpected reply/);
  await assert.rejects(ollamaEmbedder({ fetch: odd }).embedQuery("q"), /unexpected reply/);
});
