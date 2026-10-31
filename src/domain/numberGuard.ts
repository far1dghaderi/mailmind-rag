const numbers = (s: string) => new Set(s.match(/\d+/g) ?? []);

// Checks a generated policy against its fact sheet in both directions: numbers the model invented, and facts it dropped.
export function checkNumbers(facts: string, policy: string): { invented: string[]; missing: string[] } {
  // "1. Title", "## 2. Title", "**3. Title**", "4) Title": the section number is not a fact
  const body = policy.replace(/^\s*(?:#+\s*|\*\*)?\d+[.)]\s/gm, "");
  const allowed = numbers(facts);
  const present = numbers(body);
  return {
    invented: [...present].filter((n) => !allowed.has(n)),
    missing: [...allowed].filter((n) => !present.has(n)),
  };
}
