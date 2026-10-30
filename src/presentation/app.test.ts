import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { createApp } from "./app.js";

async function call(classifyFile: Parameters<typeof createApp>[0], body: unknown) {
  const server = createApp(classifyFile).listen(0);
  try {
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://localhost:${port}/classify`, {
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
