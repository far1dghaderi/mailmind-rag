import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreClassification } from "./scoreClassification.js";

const rows = [
  { label: "refund_status", intent: "refund_status", confidence: 95 },
  { label: "refund_status", intent: "order_status", confidence: 90 },
  { label: "order_status", intent: "order_status", confidence: 60 },
  { label: "order_status", intent: "unknown", confidence: 0 },
];

test("accuracy counts exact label matches", () => {
  assert.deepEqual(scoreClassification(rows).accuracy, { hit: 2, total: 4 });
});

test("confusion matrix: rows are the true label, columns what the model said", () => {
  const { confusion } = scoreClassification(rows);
  assert.deepEqual(confusion, {
    refund_status: { refund_status: 1, order_status: 1 },
    order_status: { order_status: 1, unknown: 1 },
  });
});

test("calibration buckets confidence and reports how often each bucket was right", () => {
  const { calibration } = scoreClassification(rows);
  assert.deepEqual(calibration, [
    { range: "0-49", hit: 0, total: 1 },
    { range: "50-69", hit: 1, total: 1 },
    { range: "70-89", hit: 0, total: 0 },
    { range: "90-100", hit: 1, total: 2 },
  ]);
});
