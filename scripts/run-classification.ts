import { mkdirSync, writeFileSync } from 'node:fs';
import { makeClassifyFile } from '../src/application/classifyFile.js';
import { PROMPT_VERSION } from '../src/application/classifyEmail.js';
import { createLlm } from '../src/infrastructure/createLlm.js';
import { dataFileReader } from '../src/infrastructure/fsReadFile.js';

const input = process.argv[2] ?? 'classified-emails.txt';
const model = process.env.LLM_MODEL ?? 'llama3.1:8b';

const { emails } = await makeClassifyFile({
  llm: createLlm({ provider: process.env.LLM_PROVIDER, baseUrl: process.env.LLM_URL, model }),
  readFile: dataFileReader('data'),
})(input);

const correct = emails.filter((e) => e.accurate).length;
const date = new Date().toISOString().slice(0, 10);
const result = {
  date,
  model,
  promptVersion: PROMPT_VERSION,
  input,
  total: emails.length,
  correct,
  accuracy: Number((correct / emails.length).toFixed(4)),
  emails,
};

mkdirSync('results', { recursive: true });
const out = `results/${date}-classification.json`;
writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
console.log(`${correct}/${emails.length} = ${(result.accuracy * 100).toFixed(1)}% -> ${out}`);
console.log('misses:', emails.filter((e) => !e.accurate).map((e) => `${e.email}:${e.intent}(${e.confidence})`).join(' '));
