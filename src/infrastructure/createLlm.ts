import type { Llm } from "../application/ports.js";
import { ollamaLlm } from "./ollamaLlm.js";

export interface LlmConfig {
  provider?: string;
  baseUrl?: string;
  model?: string;
}

// Add a new provider = one adapter file + one case here. Nothing else changes.
export function createLlm({ provider = "ollama", baseUrl, model }: LlmConfig): Llm {
  switch (provider) {
    case "ollama":
      return ollamaLlm({ baseUrl, model });
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}
