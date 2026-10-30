import { test } from "node:test";
import assert from "node:assert/strict";
import { createLlm } from "./createLlm.js";

test("defaults to ollama", () => {
  assert.equal(typeof createLlm({}).complete, "function");
});

test("rejects unknown providers", () => {
  assert.throws(() => createLlm({ provider: "nope" }), /Unknown LLM provider/);
});
