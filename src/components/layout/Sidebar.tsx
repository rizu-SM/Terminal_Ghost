import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { loadAllContent } from "../../utils/loader";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const { pathname } = useLocation();
  const all = loadAllContent();
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  /* ── Context-aware: show writeups or notes depending on current route ── */
  const isWriteupsRoute = pathname.startsWith("/writeups");
  const items = isWriteupsRoute
    ? all.filter((i) => i.type === "writeup")
    : all.filter((i) => i.type === "note");

  const sectionTitle = isWriteupsRoute ? "Writeups" : "Notes";

  /* Group by category → subcategory */
  const tree = items.reduce(
    (acc: Record<string, Record<string, typeof items>>, item) => {
      const cat = item.category;
      const sub = item.subcategory || "_root";
      if (!acc[cat]) acc[cat] = {};
      if (!acc[cat][sub]) acc[cat][sub] = [];
      acc[cat][sub].push(item);
      return acc;
    },
    {}
  );

  const getLinkPath = (item: (typeof items)[0]) =>
    `/${item.type}s/${item.slug}`;

  const isActive = (item: (typeof items)[0]) => pathname === getLinkPath(item);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="sidebar-overlay"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar ${isOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-header">
          <h3>
            <span className="sidebar-header-prefix">~/</span>
            {sectionTitle}
          </h3>
          {onClose && (
            <button
              className="sidebar-close-btn"
              onClick={onClose}
              aria-label="Close sidebar"
            >
              ×
            </button>
          )}
        </div>

        {Object.keys(tree).length === 0 ? (
          <div className="sidebar-empty">No content yet.</div>
        ) : (
          Object.entries(tree).map(([category, subcats]) => {
            const isExpanded = expandedCategories[category] !== false;
            return (
              <div key={category} className="category">
                <button
                  className="category-toggle"
                  onClick={() => toggleCategory(category)}
                  aria-expanded={isExpanded}
                  aria-label={`${isExpanded ? "Collapse" : "Expand"} ${category}`}
                >
                  <span className="category-indicator">
                    {isExpanded ? "▾" : "▸"}
                  </span>
                  <h4>{category}</h4>
                </button>

                {isExpanded && (
                  <>
                    {Object.entries(subcats).map(([subcategory, notes]) => (
                      <div key={subcategory} className="subcategory">
                        {subcategory !== "_root" && <p>{subcategory}</p>}
                        <ul>
                          {notes.map((note) => {
                            const to = getLinkPath(note);
                            const active = isActive(note);
                            return (
                              <li key={note.slug}>
                                <Link
                                  to={to}
                                  className={active ? "sidebar-link-active" : ""}
                                  onClick={onClose}
                                >
                                  {active && (
                                    <span className="sidebar-active-indicator">
                                      ▶
                                    </span>
                                  )}
                                  {note.title}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </>
                )}
              </div>
            );
          })
        )}
      </aside>
    </>
  );
}