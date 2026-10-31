import { test } from "node:test";
import assert from "node:assert/strict";
import { readPdfText } from "./readPdfText.js";

test("extracts text from a PDF", async () => {
  assert.match(await readPdfText("kb/pdf/returns.pdf"), /Returns Policy/);
});
