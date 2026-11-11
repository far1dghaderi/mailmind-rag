import { test } from "node:test";
import assert from "node:assert/strict";
import { ANSWER_PROMPT_VERSION, answerQuestion } from "./answerQuestion.js";
import type { ChunkStore, Embedder, Hit, Llm } from "./ports.js";

const hit = (id: string, text: string, similarity: number): Hit => ({ id, doc: "d", section: `Sec ${id}`, text, similarity });

function setup(hits: Hit[], reply: string) {
  const prompts: string[] = [];
  const embedder: Embedder = { model: "m", embedDocuments: async () => [], embedQuery: async () => [1] };
  const store: ChunkStore = { replaceDoc: async () => {}, search: async () => hits };
  const llm: Llm = { complete: async (p) => (prompts.push(p), reply) };
  return { deps: { embedder, store, llm }, prompts };
}

test("refuses without calling the model when nothing is relevant", async () => {
  const { deps, prompts } = setup([hit("a#1", "text", 0.3)], "{}");
  const r = await answerQuestion("warranty?", deps);
  assert.deepEqual({ answered: r.answered, reason: (r as any).reason, flag: (r as any).flagForHuman }, {
    answered: false, reason: "no_relevant_chunks", flag: true,
  });
  assert.equal(prompts.length, 0);
  assert.equal(r.search.hits.length, 1);
});

test("answers from relevant chunks only, and returns the search too", async () => {
  const { deps, prompts } = setup(
    [hit("a#1", "Sale items are final sale.", 0.8), hit("a#2", "UNRELATED WEAK TEXT", 0.4)],
    `{"answer":"No, sale items are final sale.","citations":["a#1"]}`,
  );
  const r = await answerQuestion("Can I return a sale item?", deps);
  assert.equal(r.answered, true);
  assert.deepEqual((r as any).citations, ["a#1"]);
  assert.match(prompts[0]!, /\[a#1\]/);
  assert.match(prompts[0]!, /Can I return a sale item\?/);
  assert.doesNotMatch(prompts[0]!, /UNRELATED WEAK TEXT/);
  assert.equal(r.search.hits.length, 2);
});

test("refuses with the reason when the model reply fails the checks", async () => {
  const cases: [string, string][] = [
    [`{"answer":null,"citations":[]}`, "model_declined"],
    [`{"answer":"Final sale.","citations":["zzz#9"]}`, "no_valid_citation"],
    [`{"answer":"Takes 9 days.","citations":["a#1"]}`, "ungrounded_numbers"],
    ["not json", "invalid_output"],
  ];
  for (const [reply, reason] of cases) {
    const r = await answerQuestion("q?", setup([hit("a#1", "Sale items are final sale.", 0.8)], reply).deps);
    assert.deepEqual({ answered: r.answered, reason: (r as any).reason, flag: (r as any).flagForHuman }, { answered: false, reason, flag: true });
  }
});

test("rejects an empty question", async () => {
  await assert.rejects(answerQuestion("  ", setup([], "{}").deps), /empty/);
});

test("prompt asks for a complete sentence, not a one-word reply", async () => {
  const { deps, prompts } = setup([hit("a#1", "Returns within 14 days.", 0.8)], `{"answer":"No.","citations":["a#1"]}`);
  await answerQuestion("Can I return after 20 days?", deps);
  assert.match(prompts[0]!, /complete sentence/i);
  assert.equal(ANSWER_PROMPT_VERSION, "v3");
});

test("prompt asks for every chunk used to be cited", async () => {
  const { deps, prompts } = setup([hit("a#1", "Returns within 14 days.", 0.8)], `{"answer":"No.","citations":["a#1"]}`);
  await answerQuestion("q?", deps);
  assert.match(prompts[0]!, /every chunk/i);
});
