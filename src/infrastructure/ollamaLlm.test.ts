import { test } from "node:test";
import assert from "node:assert/strict";
import { ollamaLlm } from "./ollamaLlm.js";

test("posts prompt to /api/chat and returns message content", async () => {
  let url = "", body: any;
  const fakeFetch = (async (u: string, init: RequestInit) => {
    url = u;
    body = JSON.parse(init.body as string);
    return new Response(JSON.stringify({ message: { content: "hi" } }));
  }) as typeof fetch;

  const out = await ollamaLlm({ baseUrl: "http://h:1", model: "m", fetch: fakeFetch }).complete("prompt");

  assert.equal(out, "hi");
  assert.equal(url, "http://h:1/api/chat");
  assert.equal(body.model, "m");
  assert.equal(body.stream, false);
  assert.equal(body.format, "json");
  assert.deepEqual(body.messages, [{ role: "user", content: "prompt" }]);
});

test("throws on non-2xx", async () => {
  const fakeFetch = (async () => new Response("boom", { status: 500 })) as typeof fetch;
  await assert.rejects(ollamaLlm({ fetch: fakeFetch }).complete("p"), /Ollama 500/);
});
