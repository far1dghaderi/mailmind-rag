import { parseEmails } from "../domain/parseEmails.js";
import { classifyEmail } from "./classifyEmail.js";
import type { Llm, ReadFile } from "./ports.js";

export type ClassifyFile = (path: string) => Promise<{
  emails: { email: number; intent: string; confidence: number; accurate: boolean }[];
}>;

export const makeClassifyFile =
  (deps: { llm: Llm; readFile: ReadFile }): ClassifyFile =>
  async (path) => {
    const emails = [];
    for (const { email, text, label } of parseEmails(await deps.readFile(path))) {
      const { intent, confidence } = await classifyEmail(text, deps.llm);
      emails.push({ email, intent, confidence, accurate: intent === label });
    }
    return { emails };
  };
