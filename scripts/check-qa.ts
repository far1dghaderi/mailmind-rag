import { readdirSync, readFileSync } from 'node:fs';
import { chunkPolicy } from '../src/domain/chunkPolicy.js';
import { parseQaSet } from '../src/domain/qaSet.js';
import { readPdfText } from '../src/infrastructure/readPdfText.js';

const file = process.argv[2] ?? 'eval/qa-set.json';

const known = new Set<string>();
for (const f of readdirSync('kb/pdf').filter((f) => f.endsWith('.pdf'))) {
  for (const c of chunkPolicy(f.replace('.pdf', ''), await readPdfText(`kb/pdf/${f}`))) known.add(c.id);
}

const set = parseQaSet(JSON.parse(readFileSync(file, 'utf8')), known);
const count = (f: (q: (typeof set)[number]) => boolean) => set.filter(f).length;
console.log(`${file}: ${set.length} questions OK`);
console.log(`  answerable ${count((q) => q.type === 'answerable')}, multi_chunk ${count((q) => q.type === 'multi_chunk')}, unanswerable ${count((q) => q.type === 'unanswerable')}`);
for (const doc of ['returns', 'shipping', 'discounts']) {
  console.log(`  cites ${doc.padEnd(9)} ${count((q) => q.source_chunks.some((s) => s.startsWith(doc + '#')))}`);
}
