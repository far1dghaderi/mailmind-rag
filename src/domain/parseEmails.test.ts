import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEmails } from "./parseEmails.js";

const file = `0
From: a@x.com
To: b@x.com
Date: 2026-01-01
Intent: order_status
Subject: Invoice 42

Please pay.
Subject: not the header
Intent: not the label

#DIVIDER#
1
From: c@x.com
To: b@x.com
Date: 2026-01-02
Subject: Hello
Intent: unknown

Hi there`;

test("splits emails, joins subject + body, reads the label", () => {
  const emails = parseEmails(file);
  assert.equal(emails.length, 2);
  assert.deepEqual(emails[0], {
    email: 0,
    label: "order_status",
    text: "Invoice 42\nPlease pay.\nSubject: not the header\nIntent: not the label",
  });
  assert.deepEqual(emails[1], { email: 1, label: "unknown", text: "Hello\nHi there" });
});

test("label never leaks into the text, wherever it sits in the header", () => {
  for (const e of parseEmails(file)) assert.doesNotMatch(e.text.split("\n")[0]!, /Intent/);
  assert.doesNotMatch(parseEmails(file)[1]!.text, /unknown/);
});

test("label is undefined when absent; blank chunks skipped", () => {
  assert.equal(parseEmails("0\nSubject: A\n\nbody")[0]!.label, undefined);
  assert.equal(parseEmails("\n#DIVIDER#\n").length, 0);
});
