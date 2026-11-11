import { readFileSync } from 'node:fs';
import { search } from '../src/application/retrieve.js';
import { parseQaSet } from '../src/domain/qaSet.js';
import { scoreQa } from '../src/domain/scoreQa.js';
import { createPool } from '../src/infrastructure/createPool.js';
import { ollamaEmbedder } from '../src/infrastructure/ollamaEmbedder.js';
import { pgChunkStore } from '../src/infrastructure/pgChunkStore.js';

// Searches once with a large k, then replays every (k, cutoff) pair from those hits. No LLM: measures retrieval alone.
const items = parseQaSet(JSON.parse(readFileSync('eval/qa-set.json', 'utf8')), new Set(JSON.parse(readFileSync('eval/qa-set.json', 'utf8')).questions.flatMap((q: any) => q.source_chunks)));
const pool = createPool();
const embedder = ollamaEmbedder({ baseUrl: process.env.EMBED_URL, model: process.env.EMBED_MODEL });
const store = pgChunkStore(pool);
const hits = new Map(await Promise.all(items.map(async (q) => [q.id, (await search(q.question, embedder, store, { k: 10, threshold: 0 })).hits] as const)));
await pool.end();

const unanswerable = items.filter((q) => q.type === 'unanswerable');
const pct = (h: number, t: number) => `${((100 * h) / t).toFixed(0)}%`.padStart(4);
console.log('k  cutoff | right chunk in kept | multi-chunk (all kept) | unanswerable reaching the model');
for (const k of [3, 4, 5, 6, 8]) {
  for (const cutoff of [0.6, 0.55, 0.5, 0.45]) {
    const outcomes = items.map((q) => {
      const top = hits.get(q.id)!.slice(0, k);
      return { id: q.id, answered: false, citations: [], topK: top.map((h) => h.id), relevant: top.filter((h) => h.similarity >= cutoff).map((h) => h.id) };
    });
    const { summary, rows } = scoreQa(items, outcomes);
    const multi = rows.filter((r) => r.type === 'multi_chunk');
    const reach = unanswerable.filter((q) => outcomes.find((o) => o.id === q.id)!.relevant.length > 0).length;
    console.log(`${k}  ${cutoff.toFixed(2)}   | ${pct(summary.retrievalAfterCutoff.hit, summary.retrievalAfterCutoff.total)} (${summary.retrievalAfterCutoff.hit}/64)       | ${multi.filter((r) => r.afterCutoff).length}/${multi.length}                    | ${reach}/${unanswerable.length}`);
  }
}
