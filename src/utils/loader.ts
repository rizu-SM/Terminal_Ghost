// ---------- TYPES ----------

export type ContentItem = {
  slug: string;
  title: string;
  date?: string;
  tags: string[];
  content: string;

  type: "writeup" | "note";
  category: string;
  subcategory?: string;
};

type Frontmatter = {
  title?: unknown;
  date?: unknown;
  tags?: unknown;
};

type ParsedMarkdown = {
  data: Frontmatter;
  content: string;
};

function getStringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function getTagsValue(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((tag): tag is string => typeof tag === "string")
    : [];
}

function parseInlineTags(value: string): string[] {
  const normalized = value.trim();

  if (!normalized.startsWith("[") || !normalized.endsWith("]")) {
    return [];
  }

  return normalized
    .slice(1, -1)
    .split(",")
    .map((tag) => tag.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
}

function parseFrontmatter(file: string): ParsedMarkdown {
  const normalizedFile = file.replace(/\r\n/g, "\n");

  if (!normalizedFile.startsWith("---\n")) {
    return { data: {}, content: file };
  }

  const lines = normalizedFile.split("\n");
  const closingOffset = lines.slice(1).findIndex((line) => line.trim() === "---");

  if (closingOffset === -1) {
    return { data: {}, content: file };
  }

  const closingIndex = closingOffset + 1;
  const frontmatterLines = lines.slice(1, closingIndex);
  const content = lines.slice(closingIndex + 1).join("\n");
  const data: Frontmatter = {};

  for (let index = 0; index < frontmatterLines.length; index += 1) {
    const trimmedLine = frontmatterLines[index].trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf(":");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const rawValue = trimmedLine.slice(separatorIndex + 1).trim();

    if (key === "tags") {
      if (rawValue) {
        data.tags = parseInlineTags(rawValue);
        continue;
      }

      const tags: string[] = [];
      let lookahead = index + 1;

      while (lookahead < frontmatterLines.length) {
        const tagLine = frontmatterLines[lookahead].trim();

        if (!tagLine.startsWith("- ")) {
          break;
        }

        const tag = tagLine.slice(2).trim().replace(/^['"]|['"]$/g, "");
        if (tag) {
          tags.push(tag);
        }

        lookahead += 1;
      }

      data.tags = tags;
      index = lookahead - 1;
      continue;
    }

    const cleanedValue = rawValue.replace(/^['"]|['"]$/g, "");

    if (key === "title") {
      data.title = cleanedValue;
    }

    if (key === "date") {
      data.date = cleanedValue;
    }
  }

  return { data, content };
}

// ---------- LOAD ALL MARKDOWN FILES ----------
const modules = import.meta.glob<string>("../content/**/*.md", {
  eager: true,
  import: "default",
  query: "?raw",
});

// ---------- MAIN LOADER ----------
export function loadAllContent(): ContentItem[] {
  const items: ContentItem[] = [];

  Object.entries(modules).forEach(([path, rawContent]) => {
    const file = rawContent as string;

    let data: Frontmatter = {};
    let content: string = file;

    try {
      const parsed = parseFrontmatter(file);
      data = parsed.data;
      content = parsed.content;
    } catch {
      data = {};
      content = file;
    }

    const cleanedPath = path
      .replace("../content/", "")
      .replace(".md", "");

    const parts = cleanedPath.split("/");

    /*
      Examples:

      writeups/web/file.md
      -> [writeups, web, file]

      notes/web/sqlinjection/basic.md
      -> [notes, web, sqlinjection, basic]
    */

    const type = parts[0];
    const category = parts[1];
    const subcategory = parts.length > 3 ? parts[2] : undefined;
    const slug = parts.slice(1).join("/");

    items.push({
      slug,
      title: getStringValue(data.title, parts[parts.length - 1]),
      date: getStringValue(data.date),
      tags: getTagsValue(data.tags),
      content,
      type: type === "writeups" ? "writeup" : "note",
      category,
      subcategory,
    });
  });

  return items;
}
