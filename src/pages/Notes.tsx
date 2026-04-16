import { loadAllContent } from "../utils/loader";
import { Link } from "react-router-dom";

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

  return (
    <div className="notes-page">
      {/* Page header */}
      <div className="page-header">
        <span className="section-tag">// knowledge base</span>
        <h1>Notes &amp; Cheatsheets</h1>
        <p className="page-desc">
          {notes.length} note{notes.length !== 1 ? "s" : ""} across{" "}
          {Object.keys(tree).length} categor
          {Object.keys(tree).length !== 1 ? "ies" : "y"}
        </p>
      </div>

      {/* Per-category sections */}
      {notes.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">👻</span>
          <p>No notes yet.</p>
        </div>
      ) : (
        Object.entries(tree).map(([category, items]) => (
          <section key={category} className="notes-category-section">
            <div className="notes-category-header">
              <span className="notes-category-label">
                $ ls ./{category}/
              </span>
              <span className="notes-category-count">
                {items.length} file{items.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="notes-grid">
              {items.map((n, i) => (
                <Link
                  key={n.slug}
                  to={`/notes/${n.slug}`}
                  className="note-card"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="note-icon">📄</div>
                  <div className="note-info">
                    <h4>{n.title}</h4>
                    <span className="note-path">
                      {n.category}
                      {n.subcategory ? ` / ${n.subcategory}` : ""}
                    </span>
                  </div>
                  <span className="note-arrow">→</span>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}