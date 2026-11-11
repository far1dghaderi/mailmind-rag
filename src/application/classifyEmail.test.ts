import { test } from "node:test";
import assert from "node:assert/strict";
import { PROMPT_VERSION, classifyEmail } from "./classifyEmail.js";
import { INTENTS } from "../domain/intents.js";

test("sends intents + email to the llm and parses the reply", async () => {
  let prompt = "";
  const llm = { complete: async (p: string) => ((prompt = p), `{"intent":"${INTENTS[0]}","confidence":87}`) };
  assert.deepEqual(await classifyEmail("my email text", llm), { intent: INTENTS[0], confidence: 87 });
  assert.match(prompt, /my email text/);
  assert.match(prompt, new RegExp(INTENTS[1]));
});

test("prompt defines every intent and tells the model to classify the current request", async () => {
  let prompt = "";
  await classifyEmail("x", { complete: async (p: string) => ((prompt = p), "{}") });
  for (const intent of INTENTS) assert.match(prompt, new RegExp(`${intent}:`));
  assert.match(prompt, /current request/i);
  assert.equal(PROMPT_VERSION, "v2");
});
