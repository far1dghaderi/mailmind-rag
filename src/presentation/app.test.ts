import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { createApp } from "./app.js";

type Deps = Parameters<typeof createApp>[0];
const noSearch: Deps["search"] = async () => ({ threshold: 0.6, hits: [] });
const noTriage: Deps["triage"] = async () => [];
const noTriageText: Deps["triageText"] = async () => ({ intent: "unknown", confidence: 0, status: "flagged", reason: "intent_not_handled" });
const noAnswer: Deps["answer"] = async () => ({ answered: false, reason: "no_relevant_chunks", flagForHuman: true, search: { threshold: 0.6, hits: [] } });

async function call(classifyFile: Deps["classifyFile"], body: unknown, search: Deps["search"] = noSearch, path = "/classify", answer: Deps["answer"] = noAnswer) {
  const server = createApp({ classifyFile, search, answer, triage: noTriage, triageText: noTriageText }).listen(0);
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
  const server = createApp({ classifyFile: idle, search: noSearch, answer: noAnswer, triage: noTriage, triageText: noTriageText }).listen(0);
  try {
    const res = await fetch(`http://localhost:${(server.address() as AddressInfo).port}/`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /<form/);
  } finally {
    server.close();
  }
});

test("/ask returns the answer result for a question", async () => {
  let asked = "";
  const result = { answered: true as const, answer: "No.", citations: ["r#1"], search: { threshold: 0.6, hits: [] } };
  const r = await call(idle, { question: " Can I? " }, noSearch, "/ask", async (q) => ((asked = q), result));
  assert.deepEqual(r, { status: 200, json: result });
  assert.equal(asked, "Can I?");
});

test("/ask 400 for a missing, blank or oversized question", async () => {
  for (const body of [{}, { question: "  " }, { question: "x".repeat(1001) }]) {
    assert.equal((await call(idle, body, noSearch, "/ask")).status, 400);
  }
});

async function post(app: ReturnType<typeof createApp>, path: string, body: unknown) {
  const server = app.listen(0);
  try {
    const res = await fetch(`http://localhost:${(server.address() as AddressInfo).port}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: await res.json() };
  } finally {
    server.close();
  }
}

test("/triage runs the pipeline on a file, optionally on chosen emails", async () => {
  let args: unknown[] = [];
  const triage: Deps["triage"] = async (path, emails) => ((args = [path, emails]), []);
  const app = createApp({ classifyFile: idle, search: noSearch, answer: noAnswer, triage, triageText: noTriageText });
  assert.deepEqual(await post(app, "/triage", { path: "f.txt", emails: [0, 4] }), { status: 200, json: { results: [] } });
  assert.deepEqual(args, ["f.txt", [0, 4]]);
});

test("/triage 400 for a bad path or email list", async () => {
  const app = createApp({ classifyFile: idle, search: noSearch, answer: noAnswer, triage: noTriage, triageText: noTriageText });
  assert.equal((await post(app, "/triage", {})).status, 400);
  assert.equal((await post(app, "/triage", { path: "f.txt", emails: "all" })).status, 400);
});

test("/triage/email runs the pipeline on subject + body", async () => {
  let seen = "";
  const result = { intent: "return_exchange", confidence: 90, status: "flagged" as const, reason: "no_relevant_chunks" as const };
  const triageText: Deps["triageText"] = async (t) => ((seen = t), result);
  const app = createApp({ classifyFile: idle, search: noSearch, answer: noAnswer, triage: noTriage, triageText });
  const r = await post(app, "/triage/email", { subject: "  Return?  ", body: "\nCan I return it?\n" });
  assert.deepEqual(r, { status: 200, json: result });
  assert.equal(seen, "Return?\nCan I return it?");
});

test("/triage/email accepts a body with no subject", async () => {
  const app = createApp({ classifyFile: idle, search: noSearch, answer: noAnswer, triage: noTriage, triageText: noTriageText });
  assert.equal((await post(app, "/triage/email", { body: "hello" })).status, 200);
});

test("/triage/email 400 for an empty, non-string or oversized email", async () => {
  const app = createApp({ classifyFile: idle, search: noSearch, answer: noAnswer, triage: noTriage, triageText: noTriageText });
  for (const body of [{}, { subject: " ", body: "  " }, { subject: 5, body: "x" }, { subject: "s", body: "x".repeat(5001) }]) {
    assert.equal((await post(app, "/triage/email", body)).status, 400);
  }
});
