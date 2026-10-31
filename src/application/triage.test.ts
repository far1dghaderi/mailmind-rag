import { test } from "node:test";
import assert from "node:assert/strict";
import { triageEmail, triageFile } from "./triage.js";
import type { ChunkStore, Embedder, Hit, Llm } from "./ports.js";

const hit = (id: string, text: string, similarity: number): Hit => ({ id, doc: "d", section: "S", text, similarity });

function setup(opts: { intent: string; hits?: Hit[]; answer?: string }) {
  const calls = { classify: 0, answer: 0, embed: 0 };
  const llm: Llm = {
    complete: async (p) => {
      if (p.includes("Classify the email")) {
        calls.classify++;
        return `{"intent":"${opts.intent}","confidence":88}`;
      }
      calls.answer++;
      return opts.answer ?? `{"answer":"Final sale.","citations":["a#1"]}`;
    },
  };
  const embedder: Embedder = { model: "m", embedDocuments: async () => [], embedQuery: async () => (calls.embed++, [1]) };
  const store: ChunkStore = { replaceDoc: async () => {}, search: async () => opts.hits ?? [hit("a#1", "Sale items are final sale.", 0.8)] };
  return { deps: { llm, embedder, store }, calls };
}

test("a policy intent with a grounded answer is answered", async () => {
  const { deps } = setup({ intent: "return_exchange" });
  const r = await triageEmail("Return?\nCan I return a sale item?", deps);
  assert.deepEqual(
    { intent: r.intent, confidence: r.confidence, status: r.status },
    { intent: "return_exchange", confidence: 88, status: "answered" },
  );
  assert.equal((r as any).answer, "Final sale.");
  assert.deepEqual((r as any).citations, ["a#1"]);
});

test("a non-policy intent is flagged without searching or answering", async () => {
  const { deps, calls } = setup({ intent: "order_status" });
  const r = await triageEmail("Where is my order?", deps);
  assert.deepEqual({ status: r.status, reason: (r as any).reason, intent: r.intent }, { status: "flagged", reason: "intent_not_handled", intent: "order_status" });
  assert.deepEqual(calls, { classify: 1, answer: 0, embed: 0 });
});

test("unknown intent is flagged", async () => {
  const { deps } = setup({ intent: "BOGUS" });
  const r = await triageEmail("Python venv question", deps);
  assert.equal(r.intent, "unknown");
  assert.equal((r as any).reason, "intent_not_handled");
});

test("a policy intent with no relevant chunk is flagged with the retrieval reason", async () => {
  const { deps, calls } = setup({ intent: "return_exchange", hits: [hit("a#1", "x", 0.2)] });
  const r = await triageEmail("Return?\nWarranty?", deps);
  assert.deepEqual({ status: r.status, reason: (r as any).reason }, { status: "flagged", reason: "no_relevant_chunks" });
  assert.equal(calls.answer, 0);
});

test("an answer that fails the checks is flagged with its reason", async () => {
  const { deps } = setup({ intent: "return_exchange", answer: `{"answer":"Takes 9 days.","citations":["a#1"]}` });
  const r = await triageEmail("Return?\nHow long?", deps);
  assert.equal((r as any).reason, "ungrounded_numbers");
});

test("an empty email is flagged without calling any model", async () => {
  const { deps, calls } = setup({ intent: "return_exchange" });
  const r = await triageEmail("  \n ", deps);
  assert.deepEqual({ status: r.status, reason: (r as any).reason, intent: r.intent }, { status: "flagged", reason: "empty_email", intent: "unknown" });
  assert.deepEqual(calls, { classify: 0, answer: 0, embed: 0 });
});

test("triageFile triages each email, keeps its label, and can pick emails by number", async () => {
  const { deps } = setup({ intent: "return_exchange" });
  const file = [0, 1, 2].map((i) => `${i}\nIntent: ${i === 1 ? "order_status" : "return_exchange"}\nSubject: S${i}\n\nbody ${i}`).join("\n#DIVIDER#\n");
  const out = await triageFile(async () => file, "f.txt", deps, [0, 1]);
  assert.deepEqual(out.map((r) => [r.email, r.label, r.status, r.intentMatchesLabel]), [
    [0, "return_exchange", "answered", true],
    [1, "order_status", "answered", false],
  ]);
});
