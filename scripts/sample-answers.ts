import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

// Writes the answers a human must read: every "unchecked" one, plus an evenly spaced handful of "confirmed" ones to measure how far the screen can be trusted.
const file = process.argv[2] ?? `results/${readdirSync('results').filter((f) => f.endsWith('-qa-eval.json')).sort().at(-1)}`;
const run = JSON.parse(readFileSync(file, 'utf8'));
const qa = new Map<string, { question: string; expected_answer: string }>(JSON.parse(readFileSync('eval/qa-set.json', 'utf8')).questions.map((q: any) => [q.id, q]));
const answers = new Map<string, string>(run.outcomes.map((o: any) => [o.id, o.answer]));

const rows: { id: string; facts: string }[] = run.rows.filter((r: any) => r.facts);
const unchecked = rows.filter((r) => r.facts === 'unchecked');
const confirmed = rows.filter((r) => r.facts === 'confirmed');
const step = Math.max(1, Math.floor(confirmed.length / 6));
const picked = [...unchecked, ...confirmed.filter((_, i) => i % step === 0).slice(0, 6)];

const out = picked
  .map((r, i) => `### ${i + 1}. ${r.id} (screen: ${r.facts})\nQ: ${qa.get(r.id)!.question}\nExpected: ${qa.get(r.id)!.expected_answer}\nAnswer:   ${answers.get(r.id)}\nYour verdict (right / partly / wrong): \n`)
  .join('\n');
writeFileSync('eval/answer-sample.md', `Hand check for ${file}\n\n${out}`);
console.log(`${picked.length} answers -> eval/answer-sample.md (${unchecked.length} unchecked + ${picked.length - unchecked.length} confirmed)`);
