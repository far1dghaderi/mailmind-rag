import { test } from "node:test";
import assert from "node:assert/strict";
import { parseQaSet } from "./qaSet.js";

const known = new Set(["returns#1", "returns#2", "shipping#1"]);
const ok = { id: "q01", type: "answerable", question: "Q?", expected_answer: "A.", source_chunks: ["returns#1"] };
const multi = { id: "q02", type: "multi_chunk", question: "Q2?", expected_answer: "A2.", source_chunks: ["returns#1", "shipping#1"] };
const none = { id: "q03", type: "unanswerable", question: "Q3?", expected_answer: null, source_chunks: [] };
const set = (...questions: unknown[]) => ({ questions });

test("accepts a valid set", () => {
  assert.equal(parseQaSet(set(ok, multi, none), known).length, 3);
});

test("rejects a malformed file", () => {
  assert.throws(() => parseQaSet({}, known), /questions/);
  assert.throws(() => parseQaSet(null, known), /questions/);
});

test("reports every problem, not just the first", () => {
  const bad = [
    { ...ok, id: "q01" },
    { ...ok, id: "q01" }, // duplicate id
    { ...ok, id: "q04", type: "weird" },
    { ...ok, id: "q05", source_chunks: ["nope#9"] }, // unknown chunk
    { ...ok, id: "q06", expected_answer: "" },
    { ...multi, id: "q07", source_chunks: ["returns#1"] }, // multi needs 2+
    { ...none, id: "q08", expected_answer: "an answer" }, // unanswerable must be null
    { ...none, id: "q09", source_chunks: ["returns#1"] }, // and cite nothing
    { ...ok, id: "q10", question: " " },
  ];
  try {
    parseQaSet(set(...bad), known);
    assert.fail("should throw");
  } catch (e) {
    const m = (e as Error).message;
    for (const needle of ["duplicate id q01", "q04", "nope#9", "q06", "q07", "q08", "q09", "q10"]) assert.match(m, new RegExp(needle));
  }
});

test("rejects duplicate questions (case and spacing ignored)", () => {
  assert.throws(() => parseQaSet(set(ok, { ...ok, id: "q02", question: "  q?  " }), known), /duplicate question/);
});

test("an answerable question may list alternative chunks that each contain the answer", () => {
  const two = { ...ok, id: "q09", question: "Q9?", source_chunks: ["returns#1", "returns#2"] };
  assert.equal(parseQaSet(set(two), known).length, 1);
});

test("an answerable question must cite at least one chunk", () => {
  assert.throws(() => parseQaSet(set({ ...ok, source_chunks: [] }), known), /at least one source chunk/);
});
