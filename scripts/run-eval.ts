import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { ANSWER_PROMPT_VERSION, answerQuestion } from '../src/application/answerQuestion.js';
import { RETRIEVAL_DEFAULTS } from '../src/application/retrieve.js';
import { chunkPolicy } from '../src/domain/chunkPolicy.js';
import { parseQaSet } from '../src/domain/qaSet.js';
import { scoreQa, type QaOutcome } from '../src/domain/scoreQa.js';
import { createLlm } from '../src/infrastructure/createLlm.js';
import { createPool } from '../src/infrastructure/createPool.js';
import { ollamaEmbedder } from '../src/infrastructure/ollamaEmbedder.js';
import { pgChunkStore } from '../src/infrastructure/pgChunkStore.js';
import { readPdfText } from '../src/infrastructure/readPdfText.js';

const known = new Set<string>();
for (const f of readdirSync('kb/pdf').filter((f) => f.endsWith('.pdf'))) {
  for (const c of chunkPolicy(f.replace('.pdf', ''), await readPdfText(`kb/pdf/${f}`))) known.add(c.id);
}
const items = parseQaSet(JSON.parse(readFileSync('eval/qa-set.json', 'utf8')), known);

const pool = createPool();
const model = process.env.LLM_MODEL ?? 'llama3.1:8b';
const deps = {
  embedder: ollamaEmbedder({ baseUrl: process.env.EMBED_URL, model: process.env.EMBED_MODEL }),
  store: pgChunkStore(pool),
  llm: createLlm({ provider: process.env.LLM_PROVIDER, baseUrl: process.env.LLM_URL, model }),
};

const outcomes: (QaOutcome & { reason?: string; answer?: string })[] = [];
for (const [i, q] of items.entries()) {
  const r = await answerQuestion(q.question, deps);
  outcomes.push({
    id: q.id,
    answered: r.answered,
    citations: r.answered ? r.citations : [],
    topK: r.search.hits.map((h) => h.id),
    relevant: r.search.hits.filter((h) => h.relevant).map((h) => h.id),
    ...(r.answered ? { answer: r.answer } : { reason: r.reason }),
  });
  process.stdout.write(`\r${i + 1}/${items.length}`);
}
await pool.end();

const { summary, rows } = scoreQa(items, outcomes);
const pct = ({ hit, total }: { hit: number; total: number }) => `${hit}/${total} = ${((100 * hit) / total).toFixed(1)}%`;
console.log('\n');
console.log(`retrieval, in top-${RETRIEVAL_DEFAULTS.k}:       ${pct(summary.retrievalTopK)}`);
console.log(`retrieval, after cutoff:    ${pct(summary.retrievalAfterCutoff)}`);
console.log(`answerable that got answer: ${pct(summary.answeredAnswerable)}`);
console.log(`unanswerable refused:       ${pct(summary.refusedUnanswerable)}`);
console.log(`answers citing a source:    ${pct(summary.cited)}`);
const f = summary.facts;
console.log(`fact check: ${f.confirmed} confirmed, ${f.wrong} wrong, ${f.unchecked} need a human, ${f.refused} refused`);

const date = new Date().toISOString().slice(0, 10);
const out = `results/${date}-qa-eval.json`;
mkdirSync('results', { recursive: true });
writeFileSync(
  out,
  JSON.stringify({ date, model, answerPromptVersion: ANSWER_PROMPT_VERSION, retrieval: RETRIEVAL_DEFAULTS, summary, rows, outcomes }, null, 2) + '\n',
);
console.log(`-> ${out}`);
