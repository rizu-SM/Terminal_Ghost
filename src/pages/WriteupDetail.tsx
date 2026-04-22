import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { loadAllContent } from "../utils/loader";
import { extractHeadings } from "../utils/headingExtractor";
import MarkdownRenderer from "../components/markdown/MarkdownRenderer";
import TableOfContents from "../components/markdown/TableOfContents";
import NotFound from "../components/ui/NotFound";

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

  return (
    <div className="writeup-page">
      <div className="writeup-container">
        {/* Main content */}
        <div className="writeup-main">
          <h1>{item.title}</h1>

          <div className="meta">
            {item.date && <span>{item.date}</span>}
            <span className="meta-sep">·</span>
            <span className="meta-category">{item.category}</span>
            {item.subcategory && (
              <>
                <span className="meta-sep">/</span>
                <span className="meta-category">{item.subcategory}</span>
              </>
            )}
            <div className="tags">
              {item.tags.map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
            </div>
          </div>

          <MarkdownRenderer content={item.content} />
        </div>
      </div>

      {/* TOC Toggle Button */}
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

          {/* TOC Drawer/Modal */}
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