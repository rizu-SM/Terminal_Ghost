import { loadAllContent } from "../utils/loader";
import { Link, useParams } from "react-router-dom";

const categoryIcons: Record<string, string> = {
  web: "🌐",
  crypto: "🔐",
  reverse: "🔄",
  pwn: "💀",
  forensics: "🔍",
  misc: "🧩",
  default: "⚡",
};

export default function Tags() {
  const { tag } = useParams<{ tag?: string }>();
  const all = loadAllContent();

  if (tag) {
    const decoded = decodeURIComponent(tag);
    const filtered = all.filter((item) => item.tags.includes(decoded));
    const sorted = [...filtered].sort((a, b) =>
      (b.date || "").localeCompare(a.date || "")
    );

    return (
      <div className="tags-page">
        <div className="page-header">
          <span className="section-tag">// tag</span>
          <h1>
            <span className="tag-page-hash">#</span>
            {decoded}
          </h1>
          <p className="page-desc">
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>

        <Link to="/tags" className="tag-back-link">
          ← all tags
        </Link>

        {sorted.length === 0 ? (
          <div className="empty-state" style={{ marginTop: "var(--space-xl)" }}>
            <span className="empty-icon">👻</span>
            <p>No posts with this tag.</p>
          </div>
        ) : (
          <div className="writeup-grid" style={{ marginTop: "var(--space-xl)" }}>
            {sorted.map((item, i) => (
              <Link
                key={item.slug}
                to={`/${item.type === "writeup" ? "writeups" : "notes"}/${item.slug}`}
                className="writeup-card"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="card-category">
                  <span className="card-icon">
                    {categoryIcons[item.category] || categoryIcons.default}
                  </span>
                  <span>{item.category}</span>
                  <span className="card-type-pill">
                    {item.type === "writeup" ? "writeup" : "note"}
                  </span>
                </div>
                <h3 className="card-title">{item.title}</h3>
                {item.date && <span className="card-date">{item.date}</span>}
                <div className="card-tags">
                  {item.tags.slice(0, 3).map((t) => (
                    <span
                      key={t}
                      className={`tag${t === decoded ? " tag-highlighted" : ""}`}
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <div className="card-arrow">→</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  // All tags view
  const tagMap = new Map<string, number>();
  for (const item of all) {
    for (const t of item.tags) {
      tagMap.set(t, (tagMap.get(t) ?? 0) + 1);
    }
  }

  const tags = Array.from(tagMap.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <div className="tags-page">
      <div className="page-header">
        <span className="section-tag">// index</span>
        <h1>Tags</h1>
        <p className="page-desc">
          {tags.length} unique tag{tags.length !== 1 ? "s" : ""} across {all.length} post
          {all.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="tags-cloud">
        {tags.map(([t, count]) => (
          <Link
            key={t}
            to={`/tags/${encodeURIComponent(t)}`}
            className="tag-cloud-item"
          >
            <span className="tag-cloud-hash">#</span>
            <span className="tag-cloud-name">{t}</span>
            <span className="tag-cloud-count">{count}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
