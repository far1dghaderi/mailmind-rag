import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyEmail } from "./classifyEmail.js";
import { INTENTS } from "../domain/intents.js";

test("sends intents + email to the llm and parses the reply", async () => {
  let prompt = "";
  const llm = { complete: async (p: string) => ((prompt = p), `{"intent":"${INTENTS[0]}","confidence":87}`) };
  assert.deepEqual(await classifyEmail("my email text", llm), { intent: INTENTS[0], confidence: 87 });
  assert.match(prompt, /my email text/);
  assert.match(prompt, new RegExp(INTENTS[1]));
});
