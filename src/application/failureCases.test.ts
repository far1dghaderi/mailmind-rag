import { test } from "node:test";
import assert from "node:assert/strict";
import { triageEmail } from "./triage.js";
import type { ChunkStore, Embedder, Hit, Llm } from "./ports.js";

// The four ways a real deployment fails. Each must end in a flag for a human or a clear error, never a wrong answer or a crash.

const chunk: Hit = { id: "a#1", doc: "d", section: "S", text: "Sale items are final sale.", similarity: 0.8 };
const classify = `{"intent":"return_exchange","confidence":90}`;

function pipeline(o: { classifyReply?: string | Error; answerReply?: string | Error; hits?: Hit[]; embedError?: Error }) {
  let answerCalls = 0;
  const reply = (r: string | Error) => (r instanceof Error ? Promise.reject(r) : Promise.resolve(r));
  const llm: Llm = {
    complete: (p) => {
      if (p.includes("Classify the email")) return reply(o.classifyReply ?? classify);
      answerCalls++;
      return reply(o.answerReply ?? `{"answerable":true,"answer":"Final sale.","citations":["a#1"]}`);
    },
  };
  const embedder: Embedder = {
    model: "m",
    embedDocuments: async () => [],
    embedQuery: async () => {
      if (o.embedError) throw o.embedError;
      return [1];
    },
  };
  const store: ChunkStore = { replaceDoc: async () => {}, search: async () => o.hits ?? [chunk] };
  return { deps: { llm, embedder, store }, answerCalls: () => answerCalls };
}

test("empty email: whitespace and blank lines are flagged without calling any model", async () => {
  const p = pipeline({ classifyReply: new Error("must not be called") });
  for (const text of ["", "   ", "\n\n \t\n"]) {
    assert.deepEqual(await triageEmail(text, p.deps), { intent: "unknown", confidence: 0, status: "flagged", reason: "empty_email" });
  }
});

test("Ollama down: the error surfaces; the email is not quietly flagged or answered", async () => {
  const down = Object.assign(new Error("Ollama is not reachable at http://localhost:11434"), { status: 503 });
  await assert.rejects(triageEmail("Return?\nCan I return a sale item?", pipeline({ classifyReply: down }).deps), /not reachable/);
  await assert.rejects(triageEmail("Return?\nCan I return a sale item?", pipeline({ answerReply: down }).deps), /not reachable/);
  await assert.rejects(triageEmail("Return?\nCan I return a sale item?", pipeline({ embedError: down }).deps), /not reachable/);
});

test("no chunks found: flagged, and the answer model is never called", async () => {
  const p = pipeline({ hits: [] });
  const r = await triageEmail("Return?\nCan I return a sale item?", p.deps);
  assert.deepEqual({ status: r.status, reason: (r as any).reason }, { status: "flagged", reason: "no_relevant_chunks" });
  assert.equal(p.answerCalls(), 0);
});

test("malformed JSON from the classifier: unknown intent, flagged, no answer attempted", async () => {
  for (const bad of ["not json at all", "", "{", `{"intent": 7}`]) {
    const p = pipeline({ classifyReply: bad });
    const r = await triageEmail("Return?\nCan I return a sale item?", p.deps);
    assert.deepEqual({ intent: r.intent, status: r.status, reason: (r as any).reason }, { intent: "unknown", status: "flagged", reason: "intent_not_handled" });
    assert.equal(p.answerCalls(), 0);
  }
});

test("malformed JSON from the answerer: flagged with invalid_output, never a made-up answer", async () => {
  for (const bad of ["Sure! The answer is no.", "", `{"answer": 42}`]) {
    const r = await triageEmail("Return?\nCan I return a sale item?", pipeline({ answerReply: bad }).deps);
    assert.deepEqual({ status: r.status, reason: (r as any).reason }, { status: "flagged", reason: "invalid_output" });
  }
});
