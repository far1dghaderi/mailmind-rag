import { test } from "node:test";
import assert from "node:assert/strict";
import { parseClassification } from "./parseClassification.js";
import { INTENTS } from "./intents.js";

test("valid intent and confidence", () => {
  assert.deepEqual(parseClassification(`{"intent":"${INTENTS[0]}","confidence":87}`), { intent: INTENTS[0], confidence: 87 });
});

test("tolerates fences and prose around the JSON", () => {
  const r = parseClassification(`Sure!\n\`\`\`json\n{"intent":"${INTENTS[1]}","confidence":50}\n\`\`\``);
  assert.equal(r.intent, INTENTS[1]);
});

test("unknown for intent outside the list", () => {
  assert.equal(parseClassification(`{"intent":"BOGUS","confidence":90}`).intent, "unknown");
});

test("unknown/0 on garbage; confidence clamped; missing confidence is 0", () => {
  assert.deepEqual(parseClassification("nope"), { intent: "unknown", confidence: 0 });
  assert.equal(parseClassification(`{"intent":"${INTENTS[0]}","confidence":250}`).confidence, 100);
  assert.equal(parseClassification(`{"intent":"${INTENTS[0]}"}`).confidence, 0);
});
