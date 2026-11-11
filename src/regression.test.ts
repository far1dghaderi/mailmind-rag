import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { ANSWER_PROMPT_VERSION } from "./application/answerQuestion.js";
import { PROMPT_VERSION } from "./application/classifyEmail.js";
import { RETRIEVAL_DEFAULTS } from "./application/retrieve.js";
import { checkThresholds } from "./domain/checkThresholds.js";

// Reads the newest saved eval results (npm run eval writes them) and fails if a metric fell below eval/thresholds.json.
// It cannot run the model itself, so it also fails when a prompt or retrieval setting changed since the results were produced.
const latest = (suffix: string) => JSON.parse(readFileSync(`results/${readdirSync("results").filter((f) => f.endsWith(suffix)).sort().at(-1)}`, "utf8"));
const qa = latest("-qa-eval.json");
const cls = latest("-classification-eval.json");
const rate = ({ hit, total }: { hit: number; total: number }) => hit / total;

test("the saved results were produced by the current prompts and retrieval settings", () => {
  assert.deepEqual(
    { answerPrompt: qa.answerPromptVersion, retrieval: qa.retrieval, classifyPrompt: cls.promptVersion },
    { answerPrompt: ANSWER_PROMPT_VERSION, retrieval: RETRIEVAL_DEFAULTS, classifyPrompt: PROMPT_VERSION },
    "results are stale: run `npm run eval`, check the numbers, then commit the new results",
  );
});

test("no metric is below its floor in eval/thresholds.json", () => {
  const failures = checkThresholds(
    {
      classificationRate: rate(cls.total.accuracy),
      retrievalRate: rate(qa.summary.retrievalAfterCutoff),
      answeredRate: rate(qa.summary.answeredAnswerable),
      refusalRate: rate(qa.summary.refusedUnanswerable),
      citationRate: rate(qa.summary.cited),
      wrongAnswers: qa.summary.facts.wrong,
    },
    JSON.parse(readFileSync("eval/thresholds.json", "utf8")),
  );
  assert.deepEqual(failures, []);
});
