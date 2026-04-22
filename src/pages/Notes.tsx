import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { loadAllContent } from "../utils/loader";

/* ─────────────────────────────────────────────────────────────
   Utility — slugify category name for anchor IDs
   ───────────────────────────────────────────────────────────── */
function slugify(str: string) {
  return str.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export default function Notes() {
  const all = loadAllContent();
  const notes = all.filter((i) => i.type === "note");

  /* Group by category */
  const tree = notes.reduce(
    (acc: Record<string, typeof notes>, note) => {
      const cat = note.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(note);
      return acc;
    },
    {}
  );

  const categories = Object.keys(tree);

  /* ── Active category tracking (scroll spy) ── */
  const [activeCategory, setActiveCategory] = useState<string>(
    categories[0] ?? ""
  );
  const [tocOpen, setTocOpen] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveCategory(entry.target.getAttribute("data-category") ?? "");
          }
        });
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
    );

    Object.values(sectionRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [categories.join(",")]);

  const handleTocLinkClick = () => {
    setTocOpen(false);
  };

  return (
    <div className="notes-page-editorial">

      {/* ── Dot-grid background decoration ── */}
      <div className="notes-bg-dots" aria-hidden="true" />

      {/* ── Page header ── */}
      <header className="notes-header-editorial">
        <span className="notes-eyebrow">// knowledge base</span>
        <h1 className="notes-title-editorial">Notes &amp; Cheatsheets</h1>
        <p className="notes-subtitle-editorial">
          {notes.length} note{notes.length !== 1 ? "s" : ""} across{" "}
          {categories.length} categor{categories.length !== 1 ? "ies" : "y"} —
          personal reference sheets, CTF techniques, and deep dives.
        </p>
      </header>

      {/* ── Two-column layout ── */}
      <div className="notes-editorial-body">

        {/* ────── Main: full-width content ────── */}
        <main className="notes-main-col">
          {notes.length === 0 ? (
            <div className="notes-empty-state">
              <span className="notes-empty-icon">👻</span>
              <p>No notes yet. Start writing!</p>
            </div>
          ) : (
            categories.map((category) => {
              const items = tree[category];
              const catId = slugify(category);
              return (
                <section
                  key={category}
                  id={catId}
                  data-category={category}
                  className="notes-category-block"
                  ref={(el) => { sectionRefs.current[category] = el; }}
                >
                  {/* Category divider header */}
                  <div className="notes-section-divider">
                    <span className="notes-section-label">
                      <span className="notes-section-slash">//</span>
                      {category}
                    </span>
                    <span className="notes-section-count">
                      {items.length} {items.length === 1 ? "note" : "notes"}
                    </span>
                  </div>

                  {/* Note rows */}
                  <ul className="notes-row-list">
                    {items.map((n, i) => (
                      <li key={n.slug} style={{ animationDelay: `${i * 55}ms` }}>
                        <Link
                          to={`/notes/${n.slug}`}
                          className="note-row-link"
                        >
                          <span className="note-row-dot" aria-hidden="true" />
                          <span className="note-row-body">
                            <span className="note-row-title">{n.title}</span>
                            <span className="note-row-path">
                              {n.category}
                              {n.subcategory ? ` / ${n.subcategory}` : ""}
                            </span>
                          </span>
                          <span className="note-row-arrow" aria-hidden="true">
                            →
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })
          )}
        </main>
      </div>

      {/* ── TOC Toggle Button (Sticky) ── */}
      {categories.length > 0 && (
        <>
          <button
            className="notes-toc-toggle-btn"
            onClick={() => setTocOpen(!tocOpen)}
            aria-label="Toggle table of contents"
            title="Show categories"
          >
            <span className="toc-btn-icon">📑</span>
          </button>

          {/* ── TOC Drawer/Modal ── */}
          {tocOpen && (
            <>
              <div
                className="notes-toc-overlay"
                onClick={() => setTocOpen(false)}
                aria-hidden="true"
              />
              <aside className="notes-toc-drawer">
                <div className="toc-drawer-header">
                  <p className="toc-heading">Navigate</p>
                  <button
                    className="toc-drawer-close"
                    onClick={() => setTocOpen(false)}
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
                <nav className="toc-nav">
                  {categories.map((cat) => (
                    <a
                      key={cat}
                      href={`#${slugify(cat)}`}
                      className={`toc-link ${activeCategory === cat ? "toc-link-active" : ""}`}
                      onClick={handleTocLinkClick}
                    >
                      <span className="toc-link-dot" aria-hidden="true" />
                      <span className="toc-link-label">{cat}</span>
                      <span className="toc-link-count">{tree[cat].length}</span>
                    </a>
                  ))}
                </nav>
              </aside>
            </>
          )}
        </>
      )}
    </div>
  );
}