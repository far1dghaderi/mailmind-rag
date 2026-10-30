import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEmails } from "./parseEmails.js";

const file = `0
From: a@x.com
To: b@x.com
Date: 2026-01-01
Subject: Invoice 42

Please pay.
Subject: not the header

#DIVIDER#
1
From: c@x.com
To: b@x.com
Date: 2026-01-02
Subject: Hello

Hi there`;

test("splits emails and joins subject + body", () => {
  const emails = parseEmails(file);
  assert.equal(emails.length, 2);
  assert.equal(emails[0]!.email, 0);
  assert.equal(emails[0]!.text, "Invoice 42\nPlease pay.\nSubject: not the header");
  assert.equal(emails[1]!.email, 1);
  assert.equal(emails[1]!.text, "Hello\nHi there");
});

test("skips blank chunks", () => {
  assert.equal(parseEmails("\n#DIVIDER#\n").length, 0);
});
