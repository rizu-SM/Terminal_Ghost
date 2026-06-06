export type ContentItem = {
  slug: string;
  title: string;
  date: string;
  tags: string[];
  content: string;

  type: "writeup" | "note";
  category: string;
  subcategory?: string;

  difficulty?: "easy" | "medium" | "hard" | "insane";
  ctf?: string;
  year?: string;
  points?: number;
};