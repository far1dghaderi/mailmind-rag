import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { createApp } from "./app.js";

type Deps = Parameters<typeof createApp>[0];
const noSearch: Deps["search"] = async () => ({ threshold: 0.6, hits: [] });

async function call(classifyFile: Deps["classifyFile"], body: unknown, search: Deps["search"] = noSearch, path = "/classify") {
  const server = createApp({ classifyFile, search }).listen(0);
  try {
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://localhost:${port}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: await res.json() };
  } finally {
    server.close();
  }
}

test("200 with classifications", async () => {
  const r = await call(async () => ({ emails: [] }), { path: "f" });
  assert.deepEqual(r, { status: 200, json: { emails: [] } });
});

test("400 when path missing", async () => {
  assert.equal((await call(async () => ({ emails: [] }), {})).status, 400);
});

test("404 when file missing", async () => {
  const enoent = async () => { throw Object.assign(new Error("no file"), { code: "ENOENT" }); };
  assert.equal((await call(enoent, { path: "f" })).status, 404);
});

const idle = async () => ({ emails: [] });

test("/search returns the search result for a question", async () => {
  let asked = "";
  const result = { threshold: 0.6, hits: [{ id: "r#1", doc: "r", section: "S", text: "t", similarity: 0.7, relevant: true }] };
  const r = await call(idle, { question: "  Can I return it? " }, async (q) => ((asked = q), result), "/search");
  assert.deepEqual(r, { status: 200, json: result });
  assert.equal(asked, "Can I return it?");
});

test("/search 400 for a missing, blank or oversized question", async () => {
  for (const body of [{}, { question: "   " }, { question: "x".repeat(1001) }]) {
    assert.equal((await call(idle, body, noSearch, "/search")).status, 400);
  }
});

test("serves the UI page at /", async () => {
  const server = createApp({ classifyFile: idle, search: noSearch }).listen(0);
  try {
    const res = await fetch(`http://localhost:${(server.address() as AddressInfo).port}/`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /<form/);
  } finally {
    server.close();
  }
});
