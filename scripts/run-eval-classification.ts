import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PROMPT_VERSION, classifyEmail } from '../src/application/classifyEmail.js';
import { parseEmails } from '../src/domain/parseEmails.js';
import { scoreClassification, type ClassifiedRow } from '../src/domain/scoreClassification.js';
import { createLlm } from '../src/infrastructure/createLlm.js';

const files = process.argv.slice(2).length ? process.argv.slice(2) : ['classified-emails.txt', 'messy-emails.txt'];
const model = process.env.LLM_MODEL ?? 'llama3.1:8b';
const llm = createLlm({ provider: process.env.LLM_PROVIDER, baseUrl: process.env.LLM_URL, model });

const pct = ({ hit, total }: { hit: number; total: number }) => (total ? `${hit}/${total} = ${((100 * hit) / total).toFixed(1)}%` : '0/0');

const perFile: Record<string, ReturnType<typeof scoreClassification>> = {};
const all: (ClassifiedRow & { file: string; email: number })[] = [];
for (const file of files) {
  const rows: typeof all = [];
  for (const { email, text, label } of parseEmails(readFileSync(`data/${file}`, 'utf8'))) {
    if (!label) continue; // unlabeled emails can't be scored
    const { intent, confidence } = await classifyEmail(text, llm);
    rows.push({ file, email, label, intent, confidence });
  }
  perFile[file] = scoreClassification(rows);
  all.push(...rows);
  console.log(`${file.padEnd(24)} ${pct(perFile[file].accuracy)}`);
}

const total = scoreClassification(all);
console.log(`${'all'.padEnd(24)} ${pct(total.accuracy)}\n\ncalibration (confidence said -> actually right):`);
for (const b of total.calibration) console.log(`  ${b.range.padEnd(7)} ${pct(b)}`);
console.log('\nmisses (true -> said, confidence):');
for (const r of all.filter((r) => r.intent !== r.label)) console.log(`  ${r.file} #${r.email}: ${r.label} -> ${r.intent} (${r.confidence})`);

const date = new Date().toISOString().slice(0, 10);
const out = `results/${date}-classification-eval.json`;
mkdirSync('results', { recursive: true });
writeFileSync(out, JSON.stringify({ date, model, promptVersion: PROMPT_VERSION, files, perFile, total, rows: all }, null, 2) + '\n');
console.log(`-> ${out}`);
