import type { Llm } from "../application/ports.js";
import { ollamaPost, unexpectedReply } from "./ollamaFetch.js";

interface Options {
  baseUrl?: string;
  model?: string;
  fetch?: typeof fetch;
}

export const ollamaLlm = ({
  baseUrl = "http://localhost:11434",
  model = "llama3.1:8b",
  fetch: doFetch = fetch,
}: Options = {}): Llm => ({
  async complete(prompt) {
    const reply = await ollamaPost(doFetch, baseUrl, "/api/chat", {
      model,
      stream: false,
      format: "json",
      options: { temperature: 0 },
      messages: [{ role: "user", content: prompt }],
    });
    if (typeof reply?.message?.content !== "string") throw unexpectedReply("message.content");
    return reply.message.content;
  },
});
