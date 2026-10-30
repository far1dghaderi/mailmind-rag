import { parseEmails } from "../domain/parseEmails.js";
import { classifyEmail } from "./classifyEmail.js";
import type { Llm, ReadFile } from "./ports.js";

export type ClassifyFile = (path: string) => Promise<{
  emails: { email: number; intent: string; accuracy: number }[];
}>;

export const makeClassifyFile =
  (deps: { llm: Llm; readFile: ReadFile }): ClassifyFile =>
  async (path) => {
    const emails = [];
    for (const { email, text } of parseEmails(await deps.readFile(path))) {
      emails.push({ email, ...(await classifyEmail(text, deps.llm)) });
    }
    return { emails };
  };
