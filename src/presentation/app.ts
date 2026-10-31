import express, { type ErrorRequestHandler } from "express";
import type { ClassifyFile } from "../application/classifyFile.js";
import type { Answer } from "../application/answerQuestion.js";
import type { SearchResult } from "../application/retrieve.js";
import type { TriageResult, TriagedEmail } from "../application/triage.js";

const MAX_QUESTION_CHARS = 1000;
const MAX_EMAIL_CHARS = 5000;

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = err.code === "ENOENT" ? 404 : (err.status ?? 500);
  res.status(status).json({ error: err.message });
};

export interface Deps {
  classifyFile: ClassifyFile;
  search: (question: string) => Promise<SearchResult>;
  answer: (question: string) => Promise<Answer>;
  triage: (path: string, emails?: number[]) => Promise<TriagedEmail[]>;
  triageText: (text: string) => Promise<TriageResult>;
}

export function createApp({ classifyFile, search, answer, triage, triageText }: Deps) {
  const app = express();
  app.use(express.json());
  app.use(express.static(new URL("../../public", import.meta.url).pathname));

  app.post("/classify", async (req, res) => {
    const path = req.body?.path;
    if (typeof path !== "string" || !path) {
      res.status(400).json({ error: 'body must be {"path": string}' });
      return;
    }
    res.json(await classifyFile(path));
  });

  app.post("/triage", async (req, res) => {
    const { path, emails } = req.body ?? {};
    const badEmails = emails !== undefined && !(Array.isArray(emails) && emails.every(Number.isInteger));
    if (typeof path !== "string" || !path || badEmails) {
      res.status(400).json({ error: 'body must be {"path": string, "emails"?: integer[]}' });
      return;
    }
    res.json({ results: await triage(path, emails) });
  });

  // Same text shape as parseEmails builds from a file: subject, newline, body.
  app.post("/triage/email", async (req, res) => {
    const { subject = "", body = "" } = req.body ?? {};
    const ok = typeof subject === "string" && typeof body === "string" && (subject.trim() || body.trim()) && subject.length + body.length <= MAX_EMAIL_CHARS;
    if (!ok) {
      res.status(400).json({ error: `body must be {"subject"?: string, "body": string}, not empty, at most ${MAX_EMAIL_CHARS} characters` });
      return;
    }
    res.json(await triageText(`${subject.trim()}\n${body.trim()}`));
  });

  const questionRoute = (run: (question: string) => Promise<unknown>): express.RequestHandler => async (req, res) => {
    const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
    if (!question || question.length > MAX_QUESTION_CHARS) {
      res.status(400).json({ error: `body must be {"question": string} of 1-${MAX_QUESTION_CHARS} characters` });
      return;
    }
    res.json(await run(question));
  };
  app.post("/search", questionRoute(search));
  app.post("/ask", questionRoute(answer));

  app.use(errorHandler);
  return app;
}
