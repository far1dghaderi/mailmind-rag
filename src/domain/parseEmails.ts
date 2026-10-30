export interface ParsedEmail {
  email: number;
  text: string;
}

export function parseEmails(file: string): ParsedEmail[] {
  const emails: ParsedEmail[] = [];
  for (const chunk of file.split("#DIVIDER#")) {
    const lines = chunk.trim().split(/\r?\n/);
    const subjectAt = lines.findIndex((l) => l.startsWith("Subject:"));
    const email = Number(lines[0]);
    if (subjectAt < 0 || !Number.isInteger(email)) continue;
    const subject = lines[subjectAt]!.slice("Subject:".length).trim();
    const body = lines.slice(subjectAt + 1).join("\n").trim();
    emails.push({ email, text: `${subject}\n${body}` });
  }
  return emails;
}
