import { makeClassifyFile } from "./application/classifyFile.js";
import { createLlm } from "./infrastructure/createLlm.js";
import { dataFileReader } from "./infrastructure/fsReadFile.js";
import { createApp } from "./presentation/app.js";

const classifyFile = makeClassifyFile({ llm: createLlm({ provider: process.env.LLM_PROVIDER, baseUrl: process.env.LLM_URL, model: process.env.LLM_MODEL }), readFile: dataFileReader(process.env.DATA_DIR ?? "data") });
const port = Number(process.env.PORT ?? 3000);
createApp(classifyFile).listen(port, () => console.log(`listening on ${port}`));
