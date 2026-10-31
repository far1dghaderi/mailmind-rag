import type { Pool } from "pg";
import type { ChunkStore } from "../application/ports.js";

export const DIMENSIONS = 768;

export const schemaSql = (table = "chunks") => `
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS ${table} (
  id text PRIMARY KEY,
  doc text NOT NULL,
  section text NOT NULL,
  text text NOT NULL,
  embedding vector(${DIMENSIONS}) NOT NULL,
  embedding_model text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);`;
// shortcut: no vector index, exact scan is faster and more accurate at ~20 rows; add HNSW (vector_cosine_ops) past a few thousand.

const toVector = (v: number[]) => `[${v.join(",")}]`;

export const pgChunkStore = (pool: Pool, table = "chunks"): ChunkStore => ({
  async replaceDoc(doc, rows) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM ${table} WHERE doc = $1`, [doc]);
      for (const r of rows) {
        await client.query(
          `INSERT INTO ${table} (id, doc, section, text, embedding, embedding_model) VALUES ($1,$2,$3,$4,$5::vector,$6)`,
          [r.id, r.doc, r.section, r.text, toVector(r.embedding), r.model],
        );
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  },
});
