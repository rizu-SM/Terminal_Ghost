import { useEffect, useState } from "react";
import type { Heading } from "../../utils/headingExtractor";

interface TableOfContentsProps {
  headings: Heading[];
}

export default function TableOfContents({ headings }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>("");

  /* ── Scroll spy: track which heading is in view ── */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
    );

    /* Observe all heading elements */
    headings.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [headings]);

  const handleClick = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
      setActiveId(id);
    }
  };

  if (headings.length === 0) return null;

  return (
    <nav className="table-of-contents">
      <div className="toc-header">
        <h4>Contents</h4>
      </div>
      <ul className="toc-list">
        {headings.map(({ id, level, text }) => (
          <li
            key={id}
            className={`toc-item level-${level} ${activeId === id ? "active" : ""}`}
          >
            <button
              onClick={() => handleClick(id)}
              className="toc-link"
              aria-current={activeId === id ? "location" : undefined}
            >
              {text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
