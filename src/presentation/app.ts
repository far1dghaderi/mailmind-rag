import express, { type ErrorRequestHandler } from "express";
import type { ClassifyFile } from "../application/classifyFile.js";
import type { SearchResult } from "../application/retrieve.js";

const MAX_QUESTION_CHARS = 1000;

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = err.code === "ENOENT" ? 404 : (err.status ?? 500);
  res.status(status).json({ error: err.message });
};

export interface Deps {
  classifyFile: ClassifyFile;
  search: (question: string) => Promise<SearchResult>;
}

export function createApp({ classifyFile, search }: Deps) {
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

  app.post("/search", async (req, res) => {
    const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
    if (!question || question.length > MAX_QUESTION_CHARS) {
      res.status(400).json({ error: `body must be {"question": string} of 1-${MAX_QUESTION_CHARS} characters` });
      return;
    }
    res.json(await search(question));
  });

  app.use(errorHandler);
  return app;
}
