import matter from "gray-matter";

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

// ---------- LOAD ALL MARKDOWN FILES ----------
const modules = import.meta.glob("../content/**/*.md", {
  eager: true,
  as: "raw",
});

// ---------- MAIN LOADER ----------
export function loadAllContent(): ContentItem[] {
  const items: ContentItem[] = [];

  Object.entries(modules).forEach(([path, rawContent]) => {
    const file = rawContent as string;

    // Parse frontmatter — gracefully handle files without valid frontmatter
    let data: Record<string, unknown> = {};
    let content: string = file;
    try {
      const parsed = matter(file);
      data = parsed.data;
      content = parsed.content;
    } catch {
      // If gray-matter fails, treat the entire file as content (no frontmatter)
      data = {};
      content = file;
    }

    // Clean path → slug
    const cleanedPath = path
      .replace("../content/", "")
      .replace(".md", "");

    const parts = cleanedPath.split("/");

    /*
      Examples:

      writeups/web/file.md
      → [writeups, web, file]

      notes/web/sqlinjection/basic.md
      → [notes, web, sqlinjection, basic]
    */

    const type = parts[0]; // writeups | notes
    const category = parts[1];
    const subcategory = parts.length > 3 ? parts[2] : undefined;

    // Slug without the type prefix (writeups/ or notes/)
    const slug = parts.slice(1).join("/");

    items.push({
      slug,
      title: data.title || parts[parts.length - 1],
      date: data.date || "",
      tags: data.tags || [],
      content,

      type: type === "writeups" ? "writeup" : "note",
      category,
      subcategory,
    });
  });

  return items;
}