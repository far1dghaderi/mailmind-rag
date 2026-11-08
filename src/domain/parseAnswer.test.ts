import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAnswer } from "./parseAnswer.js";

const chunks = [
  { id: "returns#4", text: "sale items are final sale and cannot be returned." },
  { id: "shipping#2", text: "Takes 3-5 business days\nCosts $4.99 (free on orders over $50)" },
];
const parse = (raw: string, q = "question") => parseAnswer(raw, chunks, q);

test("accepts a grounded answer with valid citations", () => {
  assert.deepEqual(parse(`{"answer":"No, sale items are final sale.","citations":["returns#4"]}`), {
    ok: true,
    answer: "No, sale items are final sale.",
    citations: ["returns#4"],
  });
});

test("tolerates fences and prose around the JSON", () => {
  const r = parse('Sure!\n```json\n{"answer":"Final sale.","citations":["returns#4"]}\n```');
  assert.equal(r.ok, true);
});

test("a null or empty answer means the model declined", () => {
  assert.deepEqual(parse(`{"answer":null,"citations":[]}`), { ok: false, reason: "model_declined" });
  assert.deepEqual(parse(`{"answer":"  ","citations":["returns#4"]}`), { ok: false, reason: "model_declined" });
});

test("unparseable output is invalid", () => {
  assert.deepEqual(parse("I think so"), { ok: false, reason: "invalid_output" });
  assert.deepEqual(parse(`{"answer":42,"citations":[]}`), { ok: false, reason: "invalid_output" });
});

test("invented citation ids are dropped; none valid means refusal", () => {
  const some = parse(`{"answer":"Final sale.","citations":["returns#4","returns#99"]}`);
  assert.deepEqual(some, { ok: true, answer: "Final sale.", citations: ["returns#4"] });
  assert.deepEqual(parse(`{"answer":"Final sale.","citations":["returns#99"]}`), { ok: false, reason: "no_valid_citation" });
  assert.deepEqual(parse(`{"answer":"Final sale.","citations":[]}`), { ok: false, reason: "no_valid_citation" });
});

test("numbers must appear in the cited chunks or the question", () => {
  const good = parse(`{"answer":"Standard shipping costs $4.99 and takes 3-5 business days.","citations":["shipping#2"]}`);
  assert.equal(good.ok, true);
  const invented = parse(`{"answer":"Shipping takes 7 business days.","citations":["shipping#2"]}`);
  assert.deepEqual(invented, { ok: false, reason: "ungrounded_numbers" });
  const fromQuestion = parse(`{"answer":"No, a $45 order is under $50.","citations":["shipping#2"]}`, "free shipping on a $45 order?");
  assert.equal(fromQuestion.ok, true);
});

test("a number only in a chunk that was not cited is not allowed", () => {
  const r = parse(`{"answer":"Costs $4.99.","citations":["returns#4"]}`);
  assert.deepEqual(r, { ok: false, reason: "ungrounded_numbers" });
});

test("chunk ids written inside the answer text do not count as numbers", () => {
  const r = parse(`{"answer":"Final sale (returns#4).","citations":["returns#4"]}`);
  assert.equal(r.ok, true);
});

test("answerable:false is a refusal even when an answer is attached; answerable:true or absent is judged as before", () => {
  assert.deepEqual(parse(`{"answerable":false,"answer":"No.","citations":["returns#4"]}`), { ok: false, reason: "model_declined" });
  assert.equal(parse(`{"answerable":true,"answer":"No.","citations":["returns#4"]}`).ok, true);
});
