import { test } from "node:test";
import assert from "node:assert/strict";
import { checkThresholds } from "./checkThresholds.js";

const limits = { refusalRate: { min: 1 }, wrongAnswers: { max: 5 } };

test("no failures when every metric is within its limit, boundaries included", () => {
  assert.deepEqual(checkThresholds({ refusalRate: 1, wrongAnswers: 5 }, limits), []);
});

test("a metric below its floor or above its ceiling is reported with the value and the limit", () => {
  assert.deepEqual(checkThresholds({ refusalRate: 0.9375, wrongAnswers: 6 }, limits), [
    "refusalRate is 0.9375, below the floor of 1",
    "wrongAnswers is 6, above the ceiling of 5",
  ]);
});

test("a metric missing from the results is a failure, not a pass", () => {
  assert.deepEqual(checkThresholds({ refusalRate: 1 }, limits), ["wrongAnswers is missing from the results"]);
});
