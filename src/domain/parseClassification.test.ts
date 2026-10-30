import { test } from "node:test";
import assert from "node:assert/strict";
import { parseClassification } from "./parseClassification.js";
import { INTENTS } from "./intents.js";

test("valid intent and accuracy", () => {
  assert.deepEqual(parseClassification(`{"intent":"${INTENTS[0]}","accuracy":87}`), { intent: INTENTS[0], accuracy: 87 });
});

test("tolerates fences and prose around the JSON", () => {
  const r = parseClassification(`Sure!\n\`\`\`json\n{"intent":"${INTENTS[1]}","accuracy":50}\n\`\`\``);
  assert.equal(r.intent, INTENTS[1]);
});

test("unknown for intent outside the list", () => {
  assert.equal(parseClassification(`{"intent":"BOGUS","accuracy":90}`).intent, "unknown");
});

test("unknown on garbage; accuracy clamped", () => {
  assert.deepEqual(parseClassification("nope"), { intent: "unknown", accuracy: 0 });
  assert.equal(parseClassification(`{"intent":"${INTENTS[0]}","accuracy":250}`).accuracy, 100);
});
