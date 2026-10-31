import { answerQuestion } from "./application/answerQuestion.js";
import { makeClassifyFile } from "./application/classifyFile.js";
import { triageEmail, triageFile } from "./application/triage.js";
import { search } from "./application/retrieve.js";
import { createLlm } from "./infrastructure/createLlm.js";
import { createPool } from "./infrastructure/createPool.js";
import { dataFileReader } from "./infrastructure/fsReadFile.js";
import { ollamaEmbedder } from "./infrastructure/ollamaEmbedder.js";
import { pgChunkStore } from "./infrastructure/pgChunkStore.js";
import { createApp } from "./presentation/app.js";

const llm = createLlm({ provider: process.env.LLM_PROVIDER, baseUrl: process.env.LLM_URL, model: process.env.LLM_MODEL });
const readFile = dataFileReader(process.env.DATA_DIR ?? "data");
const classifyFile = makeClassifyFile({ llm, readFile });

const embedder = ollamaEmbedder({ baseUrl: process.env.EMBED_URL, model: process.env.EMBED_MODEL });
const store = pgChunkStore(createPool());

const port = Number(process.env.PORT ?? 3000);
const deps = { llm, embedder, store };
createApp({
  classifyFile,
  search: (q) => search(q, embedder, store),
  answer: (q) => answerQuestion(q, deps),
  triage: (path, emails) => triageFile(readFile, path, deps, emails),
  triageText: (text) => triageEmail(text, deps),
}).listen(port, () =>
  console.log(`listening on http://localhost:${port}`),
);
