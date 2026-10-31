import { test } from "node:test";
import assert from "node:assert/strict";
import { chunkPolicy } from "./chunkPolicy.js";

const shipping = `Northwind Goods Shipping Policy
Shipping Areas
We ship to the United States and Canada only.
Shipping Options
We offer two shipping options:
1. Standard Shipping
Takes 3-5 business days
Costs $4.99 (free on orders over $50)
2. Express Shipping
Takes 1-2 business days
Costs $12.99
Shipping Schedule
Orders placed before 2 PM ship the same business day.
Tracking Your Order
A tracking number is emailed to you once your order ships.
Address Changes
You can change your shipping address within 2 hours of placing your order.
Lost Packages
If a package has not arrived 10 days after the estimated delivery date, please contact us to start a lost package
claim.
Shipping Restrictions
We cannot ship to PO boxes.

-- 1 of 1 --`;

const returns = `Northwind Goods Returns Policy
1. Eligibility for Returns
We accept returns within 14 days of delivery. To be eligible for a return, the item must be unused and in its
original packaging.
2. Refund Process
Refunds will be issued to the original payment method.

-- 1 of 1 --`;

test("splits numbered headings", () => {
  assert.deepEqual(chunkPolicy("returns", returns), [
    {
      id: "returns#1",
      doc: "returns",
      section: "1. Eligibility for Returns",
      text: "We accept returns within 14 days of delivery. To be eligible for a return, the item must be unused and in its\noriginal packaging.",
    },
    {
      id: "returns#2",
      doc: "returns",
      section: "2. Refund Process",
      text: "Refunds will be issued to the original payment method.",
    },
  ]);
});

test("splits unnumbered title-case headings; data lines with digits or $ are not headings", () => {
  const chunks = chunkPolicy("shipping", shipping);
  assert.deepEqual(
    chunks.map((c) => c.section),
    ["Shipping Areas", "1. Standard Shipping", "2. Express Shipping", "Shipping Schedule", "Tracking Your Order", "Address Changes", "Lost Packages", "Shipping Restrictions"],
  );
  assert.match(chunks[2]!.text, /^Takes 1-2 business days\nCosts \$12\.99$/);
});

test("a heading with only a lead-in sentence merges into the next chunk, which keeps its own section", () => {
  const c = chunkPolicy("shipping", shipping)[1]!;
  assert.equal(c.section, "1. Standard Shipping");
  assert.match(c.text, /^Shipping Options\nWe offer two shipping options:\nTakes 3-5 business days/);
});

test("title and page markers are not chunks; ids are sequential", () => {
  const chunks = chunkPolicy("shipping", shipping);
  assert.ok(chunks.every((c) => !c.text.includes("-- 1 of 1 --") && !c.text.includes("Shipping Policy")));
  assert.deepEqual(chunks.map((c) => c.id), chunks.map((_, i) => `shipping#${i + 1}`));
});

test("no content lost and no empty chunks", () => {
  const body = shipping.split("\n").slice(1).map((l) => l.trim()).filter((l) => l && !l.startsWith("-- "));
  const all = chunkPolicy("shipping", shipping).flatMap((c) => [c.section, ...c.text.split("\n")]);
  for (const line of body) assert.ok(all.includes(line), `missing: ${line}`);
  assert.ok(chunkPolicy("shipping", shipping).every((c) => c.text.trim()));
});
