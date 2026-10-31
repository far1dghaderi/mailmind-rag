import { test } from "node:test";
import assert from "node:assert/strict";
import { checkNumbers } from "./numberGuard.js";

const facts = "Store name: Northwind Goods\nParcels are held for 5 business days\nRedelivery within 2 business days\nHeld 21 days then restocked";

test("a faithful policy has no invented or missing numbers", () => {
  const md = "# Policy\n\n## 1. Held\n\nHeld for 5 business days.\n\n## 2. Redelivery\n\nWithin 2 business days.\n\n## 3. Restock\n\nHeld 21 days.";
  assert.deepEqual(checkNumbers(facts, md), { invented: [], missing: [] });
});

test("numbers that are not in the facts are invented", () => {
  assert.deepEqual(checkNumbers(facts, "Held 5 days. Redelivery 2 days. Restock 21 days. Fee $99.").invented, ["99"]);
});

test("numbers in the facts but absent from the policy are missing", () => {
  const md = "Parcels are held for a period of time. Redelivery within 2 business days.";
  assert.deepEqual(checkNumbers(facts, md).missing, ["5", "21"]);
});

test("section numbering is ignored in every heading style", () => {
  const md = "**1. Held**\n5 days 2 days 21 days\n## 2. Next\n### 3) Third\n4. Fourth\n  5. Fifth";
  assert.deepEqual(checkNumbers(facts, md), { invented: [], missing: [] });
});

test("a number repeated inside a longer number does not count as present", () => {
  assert.deepEqual(checkNumbers("Limit 5 per order", "Limit 15 per order").missing, ["5"]);
});
