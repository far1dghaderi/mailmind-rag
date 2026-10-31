import { readFile } from "node:fs/promises";
import { PDFParse } from "pdf-parse";

export async function readPdfText(path: string): Promise<string> {
  const parser = new PDFParse({ data: await readFile(path) });
  try {
    return (await parser.getText()).text;
  } finally {
    await parser.destroy();
  }
}
