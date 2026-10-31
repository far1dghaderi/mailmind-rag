import { test } from "node:test";
import assert from "node:assert/strict";
import { createPool } from "./createPool.js";

test("fails with a clear message when DATABASE_URL is missing", () => {
  assert.throws(() => createPool(undefined), /DATABASE_URL is not set/);
  assert.throws(() => createPool(""), /\.env/);
});

test("creates a pool when a URL is given", async () => {
  const pool = createPool("postgres://u:p@localhost:1/db");
  await pool.end();
});
