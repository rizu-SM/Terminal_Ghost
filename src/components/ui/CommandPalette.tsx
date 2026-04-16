import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { loadAllContent } from "../../utils/loader";
import type { ContentItem } from "../../utils/loader";

const typeIcon = (type: string) => (type === "writeup" ? "✍️" : "📄");

function highlight(text: string, query: string) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="cp-highlight">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const navigate = useNavigate();

  const all = loadAllContent();

  const filtered =
    query.length === 0
      ? all.slice(0, 8)
      : all
          .filter(
            (item) =>
              item.title.toLowerCase().includes(query.toLowerCase()) ||
              item.category.toLowerCase().includes(query.toLowerCase()) ||
              item.tags.some((t) => t.toLowerCase().includes(query.toLowerCase()))
          )
          .slice(0, 8);

  /* ── Open / close via global events + keyboard ── */
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKey);
    window.addEventListener("open-command-palette", handleOpen);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("open-command-palette", handleOpen);
    };
  }, []);

  /* ── Focus input when opened ── */
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [isOpen]);

  /* ── Reset selected index on query change ── */
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = useCallback(
    (item: ContentItem) => {
      navigate(`/${item.type}s/${item.slug}`);
      setIsOpen(false);
    },
    [navigate]
  );

  /* ── In-palette keyboard navigation ── */
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setIsOpen(false); return; }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[selectedIndex]) handleSelect(filtered[selectedIndex]);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, filtered, selectedIndex, handleSelect]);

  /* ── Scroll active item into view ── */
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="cp-overlay" onClick={() => setIsOpen(false)}>
      <div className="cp-modal" onClick={(e) => e.stopPropagation()}>
        {/* Input */}
        <div className="cp-input-wrap">
          <span className="cp-prompt">$</span>
          <input
            ref={inputRef}
            className="cp-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search writeups, notes, tags..."
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="cp-esc-key">ESC</kbd>
        </div>

        {/* Results */}
        {filtered.length > 0 ? (
          <ul className="cp-results" ref={listRef}>
            {filtered.map((item, i) => (
              <li
                key={item.slug}
                className={`cp-result ${i === selectedIndex ? "cp-result-active" : ""}`}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <span className="cp-result-icon">{typeIcon(item.type)}</span>
                <div className="cp-result-info">
                  <span className="cp-result-title">
                    {highlight(item.title, query)}
                  </span>
                  <span className="cp-result-meta">
                    {item.type} · {item.category}
                    {item.subcategory ? ` / ${item.subcategory}` : ""}
                  </span>
                </div>
                <div className="cp-result-tags">
                  {item.tags.slice(0, 2).map((t) => (
                    <span key={t} className="tag">{t}</span>
                  ))}
                </div>
                <span className="cp-result-arrow">→</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="cp-empty">
            <span className="cp-empty-icon">👻</span>
            <span>
              No results for <strong>"{query}"</strong>
            </span>
          </div>
        )}

        {/* Footer hints */}
        <div className="cp-footer">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>ESC</kbd> close</span>
          <span className="cp-footer-count">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
        </div>
      </div>
    </div>
  );
}
