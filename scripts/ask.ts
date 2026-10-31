import { answerQuestion } from '../src/application/answerQuestion.js';
import { createLlm } from '../src/infrastructure/createLlm.js';
import { createPool } from '../src/infrastructure/createPool.js';
import { ollamaEmbedder } from '../src/infrastructure/ollamaEmbedder.js';
import { pgChunkStore } from '../src/infrastructure/pgChunkStore.js';

const pool = createPool();
const deps = {
  embedder: ollamaEmbedder({ baseUrl: process.env.EMBED_URL, model: process.env.EMBED_MODEL }),
  store: pgChunkStore(pool),
  llm: createLlm({ provider: process.env.LLM_PROVIDER, baseUrl: process.env.LLM_URL, model: process.env.LLM_MODEL }),
};

for (const q of process.argv.slice(2)) {
  const r = await answerQuestion(q, deps);
  console.log(`\n${q}`);
  console.log(r.answered ? `  ANSWER: ${r.answer}\n  cites:  ${r.citations.join(', ')}` : `  REFUSED (${r.reason}) -> flag for a human`);
  for (const h of r.search.hits) console.log(`    ${h.relevant ? '*' : ' '} ${h.id.padEnd(14)} ${h.similarity.toFixed(3)}  ${h.section}`);
}
await pool.end();
