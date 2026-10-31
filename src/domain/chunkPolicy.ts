export interface Chunk {
  id: string;
  doc: string;
  section: string;
  text: string;
}

const isPageMarker = (l: string) => /^-- \d+ of \d+ --$/.test(l);

// PDF text has no font info, so detect headings by shape.
function isHeading(l: string): boolean {
  if (/[.:]$/.test(l)) return false;
  if (/^\d+\.\s+\S/.test(l)) return l.split(" ").length <= 8;
  const words = l.split(" ");
  return words.length <= 6 && !/[\d$]/.test(l) && words.every((w) => /^[A-Z]/.test(w));
}

// shortcut: one chunk per section, no splitting of long sections, no overlap; revisit when a policy has sections over ~400 tokens.
export function chunkPolicy(doc: string, text: string): Chunk[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !isPageMarker(l));
  const [title = doc, ...body] = lines;

  // lines before the first heading (if any) belong to a section named after the document title
  const sections: { section: string; lines: string[] }[] = [{ section: title, lines: [] }];
  for (const l of body) {
    if (isHeading(l)) sections.push({ section: l, lines: [] });
    else sections[sections.length - 1]!.lines.push(l);
  }
  if (!sections[0]!.lines.length) sections.shift();

  const chunks: Chunk[] = [];
  let carry: string[] = [];
  sections.forEach(({ section, lines }, i) => {
    const merged = [...carry, ...lines];
    const isLast = i === sections.length - 1;
    // a heading with no body, or only a lead-in ("...options:"), is meaningless alone: move it into the next chunk
    if (!isLast && (!lines.length || lines.at(-1)!.endsWith(":"))) {
      carry = [...carry, section, ...lines];
      return;
    }
    carry = [];
    if (merged.length) chunks.push({ id: `${doc}#${chunks.length + 1}`, doc, section, text: merged.join("\n") });
  });
  return chunks;
}
