import { createPool } from '../src/infrastructure/createPool.js';
import { readdirSync } from 'node:fs';
import { indexChunks } from '../src/application/indexChunks.js';
import { chunkPolicy } from '../src/domain/chunkPolicy.js';
import { ollamaEmbedder } from '../src/infrastructure/ollamaEmbedder.js';
import { pgChunkStore } from '../src/infrastructure/pgChunkStore.js';
import { readPdfText } from '../src/infrastructure/readPdfText.js';

const pool = createPool();
const embedder = ollamaEmbedder({ baseUrl: process.env.EMBED_URL, model: process.env.EMBED_MODEL });

const chunks = [];
for (const f of readdirSync('kb/pdf').filter((f) => f.endsWith('.pdf'))) {
  chunks.push(...chunkPolicy(f.replace('.pdf', ''), await readPdfText(`kb/pdf/${f}`)));
}
const n = await indexChunks(chunks, embedder, pgChunkStore(pool));
console.log(`indexed ${n} chunks with ${embedder.model}`);

const { rows } = await pool.query(
  'SELECT doc, count(*)::int AS chunks, min(vector_dims(embedding)) AS dims, min(embedding_model) AS model FROM chunks GROUP BY doc ORDER BY doc',
);
console.table(rows);
await pool.end();
