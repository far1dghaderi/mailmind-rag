export type QaType = "answerable" | "multi_chunk" | "unanswerable";

export interface QaItem {
  id: string;
  type: QaType;
  question: string;
  expected_answer: string | null;
  source_chunks: string[];
}

const TYPES: QaType[] = ["answerable", "multi_chunk", "unanswerable"];

// Validates the eval question file and checks every cited chunk really exists; throws one error listing all problems.
export function parseQaSet(raw: unknown, knownChunkIds: ReadonlySet<string>): QaItem[] {
  const questions = (raw as { questions?: unknown } | null)?.questions;
  if (!Array.isArray(questions)) throw new Error('qa set must be {"questions": [...]}');

  const problems: string[] = [];
  const ids = new Set<string>();
  const texts = new Set<string>();

  for (const [i, q] of questions.entries()) {
    const id = typeof q?.id === "string" && q.id ? q.id : `#${i}`;
    const bad = (msg: string) => problems.push(`${id}: ${msg}`);

    if (ids.has(id)) problems.push(`duplicate id ${id}`);
    ids.add(id);
    if (!TYPES.includes(q?.type)) bad(`type must be one of ${TYPES.join(", ")}`);
    if (typeof q?.question !== "string" || !q.question.trim()) bad("question is empty");
    else {
      const key = q.question.trim().toLowerCase().replace(/\s+/g, " ");
      if (texts.has(key)) problems.push(`duplicate question at ${id}`);
      texts.add(key);
    }

    const sources: unknown = q?.source_chunks;
    if (!Array.isArray(sources) || !sources.every((s) => typeof s === "string")) {
      bad("source_chunks must be an array of strings");
      continue;
    }
    for (const s of sources) if (!knownChunkIds.has(s)) bad(`unknown chunk ${s}`);

    if (q.type === "unanswerable") {
      if (q.expected_answer !== null) bad("unanswerable needs expected_answer null");
      if (sources.length) bad("unanswerable must cite no chunks");
    } else {
      if (typeof q.expected_answer !== "string" || !q.expected_answer.trim()) bad("expected_answer is empty");
      // answerable: any one of the listed chunks answers it (the same fact can sit in two chunks); multi_chunk: all are needed
      if (q.type === "answerable" && sources.length < 1) bad("answerable needs at least one source chunk");
      if (q.type === "multi_chunk" && sources.length < 2) bad("multi_chunk needs at least two source chunks");
    }
  }

  if (problems.length) throw new Error(`qa set has ${problems.length} problem(s):\n- ${problems.join("\n- ")}`);
  return questions as QaItem[];
}
