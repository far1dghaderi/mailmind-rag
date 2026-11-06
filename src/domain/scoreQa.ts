import { checkFacts, type FactVerdict } from "./checkFacts.js";
import type { QaItem } from "./qaSet.js";

// What the pipeline did for one question: the chunk ids it found, and what it finally said.
export interface QaOutcome {
  id: string;
  answered: boolean;
  answer?: string;
  citations: string[];
  topK: string[]; // every chunk returned by the search
  relevant: string[]; // those that passed the similarity cutoff
}

export interface Rate {
  hit: number;
  total: number;
}

export interface QaRow {
  id: string;
  type: QaItem["type"];
  inTopK?: boolean; // answerable / multi_chunk only
  afterCutoff?: boolean;
  cited?: boolean; // only when the pipeline answered
  facts?: FactVerdict; // only when the pipeline answered
  decisionOk: boolean; // refused when it should, answered when it should
}

// Answerable needs any one source chunk (the same fact can sit in two); multi_chunk needs all of them.
const covers = (item: QaItem, ids: string[]) =>
  item.type === "multi_chunk" ? item.source_chunks.every((s) => ids.includes(s)) : item.source_chunks.some((s) => ids.includes(s));

export function scoreQa(items: QaItem[], outcomes: QaOutcome[]) {
  const byId = new Map(outcomes.map((o) => [o.id, o]));
  const rows: QaRow[] = items.map((item) => {
    const o = byId.get(item.id);
    if (!o) throw new Error(`no outcome for ${item.id}`);
    if (item.type === "unanswerable") return { id: item.id, type: item.type, decisionOk: !o.answered };
    return {
      id: item.id,
      type: item.type,
      inTopK: covers(item, o.topK),
      afterCutoff: covers(item, o.relevant),
      cited: o.answered ? covers(item, o.citations) : undefined,
      facts: o.answered ? checkFacts(item.expected_answer ?? "", o.answer ?? "") : undefined,
      decisionOk: o.answered,
    };
  });

  const rate = (list: QaRow[], f: (r: QaRow) => boolean | undefined): Rate => {
    const judged = list.filter((r) => f(r) !== undefined);
    return { hit: judged.filter((r) => f(r)).length, total: judged.length };
  };
  const answerable = rows.filter((r) => r.type !== "unanswerable");
  const summary = {
    retrievalTopK: rate(answerable, (r) => r.inTopK),
    retrievalAfterCutoff: rate(answerable, (r) => r.afterCutoff),
    answeredAnswerable: rate(answerable, (r) => r.decisionOk),
    refusedUnanswerable: rate(rows.filter((r) => r.type === "unanswerable"), (r) => r.decisionOk),
    cited: rate(answerable, (r) => r.cited),
    facts: {
      confirmed: answerable.filter((r) => r.facts === "confirmed").length,
      wrong: answerable.filter((r) => r.facts === "wrong").length,
      unchecked: answerable.filter((r) => r.facts === "unchecked").length,
      refused: answerable.filter((r) => r.facts === undefined).length,
    },
  };
  return { summary, rows };
}
