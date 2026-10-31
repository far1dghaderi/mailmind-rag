import { createPool } from '../src/infrastructure/createPool.js';
import { search } from '../src/application/retrieve.js';
import { ollamaEmbedder } from '../src/infrastructure/ollamaEmbedder.js';
import { pgChunkStore } from '../src/infrastructure/pgChunkStore.js';

const questions = process.argv.slice(2);
const pool = createPool();
const embedder = ollamaEmbedder({ baseUrl: process.env.EMBED_URL, model: process.env.EMBED_MODEL });
const store = pgChunkStore(pool);

for (const q of questions) {
  const { hits } = await search(q, embedder, store);
  console.log(`\n${q}${hits.some((h) => h.relevant) ? '' : '   -> NOT FOUND'}`);
  for (const h of hits) console.log(`  ${h.relevant ? '*' : ' '} ${h.id.padEnd(14)} ${h.similarity.toFixed(3)}  ${h.section}`);
}
await pool.end();
