import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { checkNumbers } from '../src/domain/numberGuard.js';

const SYSTEM = `You write customer-facing store policy documents in Markdown.
Rules:
- Use ONLY the facts provided. Include every fact.
- Do NOT add any numbers, time limits, fees, or rules that are not in the facts.
- Copy every number exactly as written. Never replace a number with words like "a period of time" or "a certain number of days".
- Do NOT add steps, forms, or ways to do things that the facts do not mention.
- Keep the meaning of each fact: do not turn a customer's right into something the store "may" do.
- Use a title, short numbered sections with headings, and a plain friendly tone.
- Maximum 350 words. Output Markdown only, no commentary.`;

const MAX_ATTEMPTS = 3;

// No arguments: generate only the policies that do not exist yet. With names: (re)generate exactly those.
// Regenerating rewrites the text and shifts chunk ids, which the eval set cites, so existing policies are never touched by default.
const named = process.argv.slice(2);

mkdirSync('kb/md', { recursive: true });

async function generate(name: string, facts: string): Promise<string> {
  const res = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      model: 'llama3.1:8b',
      stream: false,
      options: { temperature: 0.2 },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `Write the ${name} policy from these facts:\n\n${facts}` },
      ],
    }),
  });
  return (await res.json()).message.content;
}

for (const file of readdirSync('kb/facts')) {
  const name = file.replace('.txt', '');
  const skip = named.length ? !named.includes(name) : existsSync(`kb/md/${name}.md`);
  if (skip) continue;

  const facts = readFileSync(`kb/facts/${file}`, 'utf8');
  let md = '';
  let check = { invented: [] as string[], missing: [] as string[] };
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    md = await generate(name, facts);
    check = checkNumbers(facts, md);
    if (!check.invented.length && !check.missing.length) break;
    console.log(`  ${name} attempt ${attempt}: invented [${check.invented}] missing [${check.missing}]`);
  }
  writeFileSync(`kb/md/${name}.md`, md);
  const ok = !check.invented.length && !check.missing.length;
  console.log(ok ? `✓ ${name}` : `⚠ ${name}: still invented [${check.invented}] missing [${check.missing}] after ${MAX_ATTEMPTS} attempts`);
}
