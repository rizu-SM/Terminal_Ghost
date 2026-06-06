import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { loadAllContent } from "../utils/loader";
import { extractHeadings } from "../utils/headingExtractor";
import MarkdownRenderer from "../components/markdown/MarkdownRenderer";
import TableOfContents from "../components/markdown/TableOfContents";
import NotFound from "../components/ui/NotFound";
import ReadingProgress from "../components/ui/ReadingProgress";

function readTime(content: string): number {
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

const difficultyLabel: Record<string, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  insane: "Insane",
};

export default function WriteupDetail() {
  const { "*": slug } = useParams();
  const [headings, setHeadings] = useState<ReturnType<typeof extractHeadings>>([]);
  const [tocOpen, setTocOpen] = useState(false);

  const all = loadAllContent();
  const item = all.find((w) => w.slug === slug);

  useEffect(() => {
    if (item?.content) {
      setHeadings(extractHeadings(item.content));
    }
  }, [item?.content]);

  const handleTocLinkClick = () => {
    setTocOpen(false);
  };

  if (!item) {
    return <NotFound />;
  }

  const mins = readTime(item.content);

  return (
    <div className="writeup-page">
      <ReadingProgress />

      <div className="writeup-container">
        <div className="writeup-main">
          <h1>{item.title}</h1>

          <div className="meta">
            {item.date && <span>{item.date}</span>}
            {item.date && <span className="meta-sep">·</span>}
            <span className="meta-readtime">{mins} min read</span>
            <span className="meta-sep">·</span>
            <span className="meta-category">{item.category}</span>
            {item.subcategory && (
              <>
                <span className="meta-sep">/</span>
                <span className="meta-category">{item.subcategory}</span>
              </>
            )}
            {item.difficulty && (
              <span className={`difficulty-badge difficulty-${item.difficulty}`}>
                {difficultyLabel[item.difficulty] ?? item.difficulty}
              </span>
            )}
            {item.ctf && (
              <span className="meta-ctf">
                {item.ctf}
                {item.year ? ` ${item.year}` : ""}
              </span>
            )}
            {item.points !== undefined && (
              <span className="meta-points">{item.points} pts</span>
            )}
            <div className="tags">
              {item.tags.map((t) => (
                <Link key={t} to={`/tags/${encodeURIComponent(t)}`} className="tag tag-link">
                  {t}
                </Link>
              ))}
            </div>
          </div>

          <MarkdownRenderer content={item.content} />
        </div>
      </div>

      {headings.length > 0 && (
        <>
          <button
            className="writeup-toc-toggle-btn"
            onClick={() => setTocOpen(!tocOpen)}
            aria-label="Toggle table of contents"
            title="Show headings"
          >
            <span className="toc-btn-icon">📑</span>
          </button>

          {tocOpen && (
            <>
              <div
                className="writeup-toc-overlay"
                onClick={() => setTocOpen(false)}
                aria-hidden="true"
              />
              <aside className="writeup-toc-drawer">
                <div className="toc-drawer-header">
                  <p className="toc-heading">Headings</p>
                  <button
                    className="toc-drawer-close"
                    onClick={() => setTocOpen(false)}
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
                <div className="toc-drawer-content">
                  <div onClick={handleTocLinkClick}>
                    <TableOfContents headings={headings} />
                  </div>
                </div>
              </aside>
            </>
          )}
        </>
      )}
    </div>
  );
}
