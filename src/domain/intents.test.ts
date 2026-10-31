import { test } from "node:test";
import assert from "node:assert/strict";
import { INTENTS, POLICY_INTENTS } from "./intents.js";

test("every policy intent is a real intent", () => {
  for (const i of POLICY_INTENTS) assert.ok((INTENTS as readonly string[]).includes(i), i);
});

test("intents needing order, payment or product data are not policy intents", () => {
  for (const i of ["order_status", "order_cancellation", "product_information", "payment_issue", "unknown"]) {
    assert.ok(!(POLICY_INTENTS as readonly string[]).includes(i), i);
  }
});
