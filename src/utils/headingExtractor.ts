/* ── Extract headings from markdown content ── */

export interface Heading {
  id: string;
  level: number;
  text: string;
}

export function extractHeadings(content: string): Heading[] {
  const headingRegex = /^(#{2,3})\s+(.+)$/gm;
  const headings: Heading[] = [];
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length; // ## = 2, ### = 3, etc.
    const text = match[2].trim();
    const id = slugify(text);

    headings.push({ level, text, id });
  }

  return headings;
}

/* ── Convert text to URL-friendly ID ── */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, "") // Remove special chars
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .trim();
}
