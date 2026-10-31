import { test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { DIMENSIONS, pgChunkStore, schemaSql } from "./pgChunkStore.js";

// Integration test: runs only when TEST_DATABASE_URL points at a Postgres with pgvector.
const url = process.env.TEST_DATABASE_URL;
const vec = (x: number) => Array.from({ length: DIMENSIONS }, () => x);
const row = (id: string, doc: string, x: number) => ({ id, doc, section: "S", text: "t", embedding: vec(x), model: "m" });

test("replaceDoc replaces only that document, atomically", { skip: !url }, async () => {
  const pool = new pg.Pool({ connectionString: url });
  const table = `chunks_test_${Date.now()}`;
  try {
    await pool.query(schemaSql(table));
    const store = pgChunkStore(pool, table);
    await store.replaceDoc("a", [row("a#1", "a", 0.1), row("a#2", "a", 0.2)]);
    await store.replaceDoc("b", [row("b#1", "b", 0.3)]);
    await store.replaceDoc("a", [row("a#1", "a", 0.5)]);

    const { rows } = await pool.query(`SELECT id, vector_dims(embedding) AS dims, embedding_model FROM ${table} ORDER BY id`);
    assert.deepEqual(rows, [
      { id: "a#1", dims: DIMENSIONS, embedding_model: "m" },
      { id: "b#1", dims: DIMENSIONS, embedding_model: "m" },
    ]);

    await assert.rejects(store.replaceDoc("a", [row("dup", "a", 0.1), row("dup", "a", 0.1)]));
    const after = await pool.query(`SELECT count(*)::int AS n FROM ${table} WHERE doc = 'a'`);
    assert.equal(after.rows[0].n, 1); // failed replace rolled back, old row kept
  } finally {
    await pool.query(`DROP TABLE IF EXISTS ${table}`);
    await pool.end();
  }
});
