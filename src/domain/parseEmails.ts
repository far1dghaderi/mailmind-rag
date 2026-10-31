export interface ParsedEmail {
  email: number;
  text: string;
  label?: string;
}

const header = (lines: string[], name: string) =>
  lines.find((l) => l.startsWith(`${name}:`))?.slice(name.length + 1).trim();

export function parseEmails(file: string): ParsedEmail[] {
  const emails: ParsedEmail[] = [];
  for (const chunk of file.split("#DIVIDER#")) {
    const lines = chunk.trim().split(/\r?\n/);
    const email = Number(lines[0]);
    const blankAt = lines.findIndex((l, i) => i > 0 && !l.trim());
    const headers = lines.slice(1, blankAt < 0 ? undefined : blankAt);
    const subject = header(headers, "Subject");
    if (subject === undefined || !Number.isInteger(email)) continue;
    // Body starts after the header block, so the Intent label is never sent to the model.
    const body = blankAt < 0 ? "" : lines.slice(blankAt + 1).join("\n").trim();
    emails.push({ email, text: `${subject}\n${body}`, label: header(headers, "Intent") });
  }
  return emails;
}
