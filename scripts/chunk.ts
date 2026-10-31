import { readdirSync, readFileSync } from 'node:fs';
import { chunkPolicy } from '../src/domain/chunkPolicy.js';
import { readPdfText } from '../src/infrastructure/readPdfText.js';

let missing = 0;
for (const f of readdirSync('kb/pdf').filter((f) => f.endsWith('.pdf'))) {
  const doc = f.replace('.pdf', '');
  const chunks = chunkPolicy(doc, await readPdfText(`kb/pdf/${f}`));
  console.log(`\n===== ${doc}: ${chunks.length} chunks =====`);
  for (const c of chunks)
    console.log(`[${c.id}] ${c.section} (${c.text.length} chars)\n${c.text}\n`);

  // every number in the fact sheet must survive into some chunk
  const all = chunks.map((c) => c.text).join('\n');
  const nums =
    readFileSync(`kb/facts/${doc}.txt`, 'utf8').match(
      /\$?\d+(?:[-.]\d+)*%?/g,
    ) ?? [];
  for (const n of new Set(nums)) {
    if (!all.includes(n.replace(/%$/, ''))) {
      console.log(`MISSING in ${doc}: ${n}`);
      missing++;
    }
  }
}
console.log(
  missing
    ? `\n${missing} fact numbers missing`
    : '\nall fact-sheet numbers present in chunks',
);
process.exit(missing ? 1 : 0);
