import type { Rate } from "./scoreQa.js";

export interface ClassifiedRow {
  label: string; // what a human said
  intent: string; // what the model said
  confidence: number;
}

const BUCKETS = [
  { range: "0-49", min: 0 },
  { range: "50-69", min: 50 },
  { range: "70-89", min: 70 },
  { range: "90-100", min: 90 },
];

export function scoreClassification(rows: ClassifiedRow[]) {
  const confusion: Record<string, Record<string, number>> = {};
  for (const { label, intent } of rows) {
    confusion[label] ??= {};
    confusion[label][intent] = (confusion[label][intent] ?? 0) + 1;
  }

  // Calibration: a model that says "90" should be right about 90% of the time.
  const calibration = BUCKETS.map(({ range, min }, i) => {
    const max = BUCKETS[i + 1]?.min ?? Infinity;
    const inBucket = rows.filter((r) => r.confidence >= min && r.confidence < max);
    return { range, hit: inBucket.filter((r) => r.intent === r.label).length, total: inBucket.length };
  });

  const accuracy: Rate = { hit: rows.filter((r) => r.intent === r.label).length, total: rows.length };
  return { accuracy, confusion, calibration };
}
