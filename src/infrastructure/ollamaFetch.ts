// Shared by the Ollama adapters: turns "connection refused" and odd replies into errors an operator can act on.
export async function ollamaPost(doFetch: typeof fetch, baseUrl: string, path: string, body: unknown): Promise<any> {
  let res: Response;
  try {
    res = await doFetch(`${baseUrl}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw Object.assign(new Error(`Ollama is not reachable at ${baseUrl}. Is it running?`), { status: 503 });
  }
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  return res.json();
}

export const unexpectedReply = (what: string) => new Error(`Ollama sent an unexpected reply (no ${what})`);
