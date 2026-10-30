import type { Llm } from "../application/ports.js";

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
    const res = await doFetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        format: "json",
        options: { temperature: 0 },
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
    return (await res.json()).message.content;
  },
});
