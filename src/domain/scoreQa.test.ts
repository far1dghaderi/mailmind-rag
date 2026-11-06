import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreQa, type QaOutcome } from "./scoreQa.js";
import type { QaItem } from "./qaSet.js";

const one: QaItem = { id: "a", type: "answerable", question: "?", expected_answer: "x", source_chunks: ["r#1", "r#2"] };
const multi: QaItem = { id: "m", type: "multi_chunk", question: "?", expected_answer: "x", source_chunks: ["r#1", "s#1"] };
const none: QaItem = { id: "u", type: "unanswerable", question: "?", expected_answer: null, source_chunks: [] };

const out = (id: string, o: Partial<QaOutcome>): QaOutcome => ({ id, answered: false, citations: [], topK: [], relevant: [], ...o });

test("answerable: any one source chunk counts; multi_chunk needs all", () => {
  const { rows } = scoreQa(
    [one, multi],
    [out("a", { topK: ["r#2", "x#1"], relevant: ["r#2"] }), out("m", { topK: ["r#1", "x#1"], relevant: ["r#1"] })],
  );
  assert.deepEqual(rows.map((r) => [r.inTopK, r.afterCutoff]), [[true, true], [false, false]]);
});

test("a chunk found in top-k but dropped by the cutoff is a cutoff miss", () => {
  const { rows } = scoreQa([one], [out("a", { topK: ["r#1"], relevant: [] })]);
  assert.deepEqual([rows[0].inTopK, rows[0].afterCutoff], [true, false]);
});

test("refusal: unanswerable must be refused, answerable must be answered", () => {
  const { summary } = scoreQa(
    [one, none, { ...none, id: "u2" }],
    [out("a", { answered: false }), out("u", { answered: false }), out("u2", { answered: true })],
  );
  assert.deepEqual(summary.refusedUnanswerable, { hit: 1, total: 2 });
  assert.deepEqual(summary.answeredAnswerable, { hit: 0, total: 1 });
});

test("citation: only answered questions are judged; cited chunks must cover the sources", () => {
  const { summary } = scoreQa(
    [one, multi],
    [out("a", { answered: true, citations: ["r#2"] }), out("m", { answered: true, citations: ["r#1"] })],
  );
  assert.deepEqual(summary.cited, { hit: 1, total: 2 });
});

test("throws when an outcome is missing", () => {
  assert.throws(() => scoreQa([one], []), /no outcome for a/);
});

test("fact check: counts confirmed, wrong and unchecked answers; refusals are counted apart", () => {
  const items: QaItem[] = [
    { ...one, id: "a1", expected_answer: "Yes, within 14 days." },
    { ...one, id: "a2", expected_answer: "Yes, within 14 days." },
    { ...one, id: "a3", expected_answer: "Refunds go to the card." },
    { ...one, id: "a4" },
  ];
  const { summary } = scoreQa(items, [
    out("a1", { answered: true, answer: "Yes" }),
    out("a2", { answered: true, answer: "No" }),
    out("a3", { answered: true, answer: "the original method" }),
    out("a4", { answered: false }),
  ]);
  assert.deepEqual(summary.facts, { confirmed: 1, wrong: 1, unchecked: 1, refused: 1 });
});
