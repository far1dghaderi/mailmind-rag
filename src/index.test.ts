import { test } from "node:test";
import assert from "node:assert/strict";
import { name } from "./index.js";

test("module loads", () => {
  assert.equal(name, "mailmind-rag");
});
