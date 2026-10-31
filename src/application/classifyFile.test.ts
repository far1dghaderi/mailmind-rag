import { test } from "node:test";
import assert from "node:assert/strict";
import { makeClassifyFile } from "./classifyFile.js";
import { INTENTS } from "../domain/intents.js";

const file = (...labels: (string | undefined)[]) =>
  labels.map((l, i) => `${i}\nIntent: ${l}\nSubject: S${i}\n\nbody`).join("\n#DIVIDER#\n");

test("accurate is true only when the model intent equals the label", async () => {
  const classifyFile = makeClassifyFile({
    readFile: async () => file(INTENTS[0], INTENTS[1]),
    llm: { complete: async () => `{"intent":"${INTENTS[0]}","confidence":70}` },
  });
  assert.deepEqual(await classifyFile("any"), {
    emails: [
      { email: 0, intent: INTENTS[0], confidence: 70, accurate: true },
      { email: 1, intent: INTENTS[0], confidence: 70, accurate: false },
    ],
  });
});

test("the label is never sent to the model", async () => {
  const prompts: string[] = [];
  const classifyFile = makeClassifyFile({
    readFile: async () => file("secret_label"),
    llm: { complete: async (p) => (prompts.push(p), "{}") },
  });
  await classifyFile("any");
  assert.doesNotMatch(prompts[0]!, /secret_label/);
});
