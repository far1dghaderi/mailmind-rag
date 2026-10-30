import { test } from "node:test";
import assert from "node:assert/strict";
import { makeClassifyFile } from "./classifyFile.js";
import { INTENTS } from "../domain/intents.js";

test("classifies every email in a file", async () => {
  const classifyFile = makeClassifyFile({
    readFile: async () => "0\nSubject: A\n\nbody\n#DIVIDER#\n1\nSubject: B\n\nbody",
    llm: { complete: async () => `{"intent":"${INTENTS[0]}","accuracy":70}` },
  });
  assert.deepEqual(await classifyFile("any"), {
    emails: [
      { email: 0, intent: INTENTS[0], accuracy: 70 },
      { email: 1, intent: INTENTS[0], accuracy: 70 },
    ],
  });
});
