import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dataFileReader } from "./fsReadFile.js";

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "mm-"));
  await writeFile(join(dir, "emails.txt"), "hello");
  return dataFileReader(dir);
}

test("reads a file inside the data dir", async () => {
  assert.equal(await (await setup())("emails.txt"), "hello");
});

test("rejects paths escaping the data dir", async () => {
  const read = await setup();
  await assert.rejects(read("../secret"), { status: 400 });
  await assert.rejects(read("/etc/passwd"), { status: 400 });
});
