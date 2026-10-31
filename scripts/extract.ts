import { readdirSync, readFileSync } from 'node:fs';
import { PDFParse } from 'pdf-parse';

for (const f of readdirSync('kb/pdf').filter((f) => f.endsWith('.pdf'))) {
  const parser = new PDFParse({ data: readFileSync(`kb/pdf/${f}`) });
  const { text, total } = await parser.getText();
  await parser.destroy();
  console.log(`\n===== ${f} (${total} pages, ${text.length} chars) =====\n${text}`);
}
