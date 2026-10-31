import { readFileSync } from 'node:fs';
import { triageFile } from '../src/application/triage.js';
import { parseEmails } from '../src/domain/parseEmails.js';
import { createLlm } from '../src/infrastructure/createLlm.js';
import { createPool } from '../src/infrastructure/createPool.js';
import { dataFileReader } from '../src/infrastructure/fsReadFile.js';
import { ollamaEmbedder } from '../src/infrastructure/ollamaEmbedder.js';
import { pgChunkStore } from '../src/infrastructure/pgChunkStore.js';

// usage: npm run pipeline -- <file in data/> [comma-separated email numbers]
const [file = 'classified-emails.txt', list] = process.argv.slice(2);
const only = list?.split(',').map(Number);

const pool = createPool();
const deps = {
  llm: createLlm({ provider: process.env.LLM_PROVIDER, baseUrl: process.env.LLM_URL, model: process.env.LLM_MODEL }),
  embedder: ollamaEmbedder({ baseUrl: process.env.EMBED_URL, model: process.env.EMBED_MODEL }),
  store: pgChunkStore(pool),
};

const texts = new Map(parseEmails(readFileSync(`data/${file}`, 'utf8')).map((e) => [e.email, e.text]));
for (const r of await triageFile(dataFileReader('data'), file, deps, only)) {
  const [subject, ...body] = texts.get(r.email)!.split('\n');
  console.log(`\n#${r.email} ${subject}\n  ${body.join(' ').trim().slice(0, 170)}`);
  console.log(`  label=${r.label}  intent=${r.intent} (${r.confidence})  ${r.intentMatchesLabel ? 'match' : 'MISMATCH'}`);
  console.log(
    r.status === 'answered'
      ? `  ANSWERED: ${r.answer}  [${r.citations.join(', ')}]`
      : `  FLAGGED FOR HUMAN: ${r.reason}`,
  );
}
await pool.end();
