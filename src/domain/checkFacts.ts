export type FactVerdict = "confirmed" | "wrong" | "unchecked";

const polarity = (s: string) => /^\s*(yes|no)\b/i.exec(s)?.[1]?.toLowerCase();
// "$4.99", "14", "5-7", "10%", "WELCOME10": the facts a wrong answer usually gets wrong.
const facts = (s: string) =>
  new Set((s.replace(/[–—]/g, "-").match(/\$?\d[\d,.]*(?:-\d+)?%?|[A-Z]{3,}\d+/g) ?? []).map((f) => f.replace(/[$,.]+$|^\$/g, "").toLowerCase()));

// shortcut: a cheap screen, not a judge. It catches flipped yes/no and different numbers; everything else is "unchecked" and needs a human.
export function checkFacts(expected: string, answer: string): FactVerdict {
  const [pe, pa] = [polarity(expected), polarity(answer)];
  if (pe && pa && pe !== pa) return "wrong";

  const [fe, fa] = [facts(expected), facts(answer)];
  const shared = [...fa].some((f) => fe.has(f));
  if (fe.size && fa.size && !shared) return "wrong";

  return (pe && pe === pa) || shared ? "confirmed" : "unchecked";
}
