import { test } from "node:test";
import assert from "node:assert/strict";
import { checkFacts } from "./checkFacts.js";

test("yes/no that contradicts the expected answer is wrong", () => {
  assert.equal(checkFacts("Yes, returns are accepted within 14 days.", "No"), "wrong");
  assert.equal(checkFacts("No, we cannot ship to PO boxes.", "yes"), "wrong");
});

test("matching yes/no is confirmed", () => {
  assert.equal(checkFacts("No, WELCOME10 requires a minimum order of $30.", "no"), "confirmed");
});

test("a number that matches is confirmed, a different number is wrong", () => {
  assert.equal(checkFacts("Standard shipping costs $4.99, free over $50.", "$4.99"), "confirmed");
  assert.equal(checkFacts("Express shipping takes 1-2 business days.", "3-5 business days"), "wrong");
  assert.equal(checkFacts("You can ask within 48 hours.", "48 hours"), "confirmed");
});

test("anything with nothing to compare is left for a human", () => {
  assert.equal(checkFacts("Refunds go to the original payment method.", "the amount actually paid"), "unchecked");
  assert.equal(checkFacts("Yes, a tracking number is emailed.", "No specific information is provided"), "wrong");
});
