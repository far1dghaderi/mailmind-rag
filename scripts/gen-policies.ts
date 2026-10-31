import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const SYSTEM = `You write customer-facing store policy documents in Markdown.
Rules:
- Use ONLY the facts provided. Include every fact.
- Do NOT add any numbers, time limits, fees, or rules that are not in the facts.
- Use a title, short numbered sections with headings, and a plain friendly tone.
- Maximum 350 words. Output Markdown only, no commentary.`;

mkdirSync('kb/md', { recursive: true });

for (const file of readdirSync('kb/facts')) {
  const name = file.replace('.txt', '');
  const facts = readFileSync(`kb/facts/${file}`, 'utf8');

  const res = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      model: 'llama3.1:8b',
      stream: false,
      options: { temperature: 0.2 },
      messages: [
        { role: 'system', content: SYSTEM },
        {
          role: 'user',
          content: `Write the ${name} policy from these facts:\n\n${facts}`,
        },
      ],
    }),
  });
  const md: string = (await res.json()).message.content;
  writeFileSync(`kb/md/${name}.md`, md);

  const nums = (s: string) => new Set(s.match(/\d+/g) ?? []);
  const allowed = nums(facts);
  const body = md.replace(/^\s*(#+\s*)?\d+[.)]\s/gm, '');
  const extra = [...nums(body)].filter((n) => !allowed.has(n));
  console.log(
    extra.length ? `⚠ ${name}: invented numbers ${extra}` : `✓ ${name}`,
  );
}
