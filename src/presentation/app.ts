import express, { type ErrorRequestHandler } from "express";
import type { ClassifyFile } from "../application/classifyFile.js";

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = err.code === "ENOENT" ? 404 : (err.status ?? 500);
  res.status(status).json({ error: err.message });
};

export function createApp(classifyFile: ClassifyFile) {
  const app = express();
  app.use(express.json());

  app.post("/classify", async (req, res) => {
    const path = req.body?.path;
    if (typeof path !== "string" || !path) {
      res.status(400).json({ error: 'body must be {"path": string}' });
      return;
    }
    res.json(await classifyFile(path));
  });

  app.use(errorHandler);
  return app;
}
