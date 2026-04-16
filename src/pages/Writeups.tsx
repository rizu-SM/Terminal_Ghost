import { loadAllContent } from "../utils/loader";
import { Link } from "react-router-dom";
import { useState } from "react";

const categoryIcons: Record<string, string> = {
  web: "🌐",
  crypto: "🔐",
  reverse: "🔄",
  pwn: "💀",
  forensics: "🔍",
  misc: "🧩",
  default: "⚡",
};

export default function Writeups() {
  const all = loadAllContent();
  const writeups = all.filter((i) => i.type === "writeup");

  const categories = [
    "all",
    ...Array.from(new Set(writeups.map((w) => w.category))),
  ];

  const [activeCategory, setActiveCategory] = useState("all");

  const filtered =
    activeCategory === "all"
      ? writeups
      : writeups.filter((w) => w.category === activeCategory);

  const sorted = [...filtered].sort((a, b) =>
    (b.date || "").localeCompare(a.date || "")
  );

  return (
    <div className="writeups-page">
      {/* Page header */}
      <div className="page-header">
        <span className="section-tag">// archive</span>
        <h1>Writeups</h1>
        <p className="page-desc">
          {writeups.length} writeup{writeups.length !== 1 ? "s" : ""} across{" "}
          {categories.length - 1} categor{categories.length - 1 !== 1 ? "ies" : "y"}
        </p>
      </div>

      {/* Category filter tabs */}
      {categories.length > 2 && (
        <div className="filter-tabs">
          {categories.map((cat) => {
            const count =
              cat === "all"
                ? writeups.length
                : writeups.filter((w) => w.category === cat).length;
            return (
              <button
                key={cat}
                className={`filter-tab ${activeCategory === cat ? "filter-tab-active" : ""}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat !== "all" && (
                  <span className="filter-tab-icon">
                    {categoryIcons[cat] || categoryIcons.default}
                  </span>
                )}
                <span>{cat === "all" ? "All" : cat}</span>
                <span className="filter-tab-count">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Grid */}
      {sorted.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">👻</span>
          <p>No writeups found in this category.</p>
        </div>
      ) : (
        <div className="writeup-grid">
          {sorted.map((w, i) => (
            <Link
              key={w.slug}
              to={`/writeups/${w.slug}`}
              className="writeup-card"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="card-category">
                <span className="card-icon">
                  {categoryIcons[w.category] || categoryIcons.default}
                </span>
                <span>{w.category}</span>
              </div>

              <h3 className="card-title">{w.title}</h3>

              {w.date && <span className="card-date">{w.date}</span>}

              <div className="card-tags">
                {w.tags.slice(0, 3).map((t) => (
                  <span key={t} className="tag">
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