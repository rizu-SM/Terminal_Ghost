import { Link } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { loadAllContent } from "../utils/loader";

/* ── Terminal typing hook ── */
function useTypingEffect(lines: string[], speed = 40, lineDelay = 800) {
  const [displayed, setDisplayed] = useState<string[]>([]);
  const [currentLine, setCurrentLine] = useState(0);
  const [currentChar, setCurrentChar] = useState(0);
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    const cursorInterval = setInterval(() => setShowCursor((v) => !v), 530);
    return () => clearInterval(cursorInterval);
  }, []);

  useEffect(() => {
    if (currentLine >= lines.length) return;

    const line = lines[currentLine];

    if (currentChar < line.length) {
      const timeout = setTimeout(() => {
        setDisplayed((prev) => {
          const copy = [...prev];
          copy[currentLine] = (copy[currentLine] || "") + line[currentChar];
          return copy;
        });
        setCurrentChar((c) => c + 1);
      }, speed);
      return () => clearTimeout(timeout);
    } else {
      const timeout = setTimeout(() => {
        setCurrentLine((l) => l + 1);
        setCurrentChar(0);
      }, lineDelay);
      return () => clearTimeout(timeout);
    }
  }, [currentLine, currentChar, lines, speed, lineDelay]);

  return { displayed, showCursor, isDone: currentLine >= lines.length };
}

/* ── Animated counter ── */
function AnimatedCounter({ target, duration = 1500, label }: { target: number; duration?: number; label: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = Date.now();
          const tick = () => {
            const elapsed = Date.now() - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);

  return (
    <div className="stat-card" ref={ref}>
      <span className="stat-number">{count}+</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

/* ── Category icon mapping ── */
const categoryIcons: Record<string, string> = {
  web: "🌐",
  crypto: "🔐",
  reverse: "🔄",
  pwn: "💀",
  forensics: "🔍",
  misc: "🧩",
  default: "⚡",
};

/* ── MAIN HOME COMPONENT ── */
export default function Home() {
  const all = loadAllContent();
  const writeups = all.filter((i) => i.type === "writeup");
  const notes = all.filter((i) => i.type === "note");

  /* Collect unique categories */
  const categories = Array.from(new Set(writeups.map((w) => w.category)));

  /* Recent writeups (sorted by date) */
  const recent = [...writeups]
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .slice(0, 4);

  /* Terminal lines */
  const terminalLines = [
    "$ ssh Sami@terminal-Sami.dev",
    "Connecting to secure server...",
    "Authentication successful.",
    "$ cat /etc/motd",
    `Welcome to Terminal Samo v2.0`,
    `Writeups loaded: ${writeups.length}`,
    `Notes indexed: ${notes.length}`,
    "$ echo 'Ready to hack.'",
    "Ready to hack.",
  ];

  const { displayed, showCursor, isDone } = useTypingEffect(terminalLines, 35, 530);

  return (
    <div className="home-page">
      {/* ── HERO ── */}
      <section className="hero">
        <div className="hero-bg-grid"></div>

        <div className="hero-content">
          <div className="hero-left">
            <div className="hero-badge">
              <span className="badge-dot"></span>
              <span>Cybersecurity Research</span>
            </div>

            <h1 className="hero-title">
              <span className="title-line">Decode.</span>
              <span className="title-line">Exploit.</span>
              <span className="title-line title-accent">Document.</span>
            </h1>

            <p className="hero-desc">
              CTF writeups, vulnerability research, and security notes —
              built from real competitions and real exploits.
              Fast access. Zero fluff.
            </p>

            <div className="hero-actions">
              <Link to="/writeups" className="btn btn-primary">
                <span className="btn-icon">→</span>
                Explore Writeups
              </Link>
              <Link to="/notes" className="btn btn-ghost">
                <span className="btn-icon">$</span>
                Quick Notes
              </Link>
            </div>

            {/* Keyboard shortcut hint */}
            <div className="hero-hint">
              <kbd>Ctrl</kbd> + <kbd>K</kbd> to search anywhere
            </div>
          </div>

          {/* ── Terminal Widget ── */}
          <div className="hero-right">
            <div className="terminal-widget">
              <div className="terminal-chrome">
                <div className="terminal-dots">
                  <span className="dot dot-red"></span>
                  <span className="dot dot-yellow"></span>
                  <span className="dot dot-green"></span>
                </div>
                <span className="terminal-title">ghost@kali:~</span>
              </div>

              <div className="terminal-screen">
                {displayed.map((line, i) => (
                  <div key={i} className={`terminal-line ${line.startsWith("$") ? "cmd" : "output"}`}>
                    {line}
                  </div>
                ))}
                {!isDone && (
                  <span className={`terminal-cursor ${showCursor ? "visible" : ""}`}>▊</span>
                )}
              </div>
            </div>

            {/* Connection status */}
            <div className="connection-status">
              <span className="conn-dot"></span>
              <span className="conn-text">Secure connection established</span>
              <span className="conn-proto">TLS 1.3</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section className="stats-bar">
        <AnimatedCounter target={writeups.length} label="Writeups" />
        <AnimatedCounter target={categories.length} label="Categories" />
        <AnimatedCounter target={notes.length} label="Notes" />
        <AnimatedCounter target={writeups.reduce((acc, w) => acc + w.tags.length, 0)} label="Tags" />
      </section>

      {/* ── RECENT WRITEUPS ── */}
      {recent.length > 0 && (
        <section className="section recent-section">
          <div className="section-header">
            <div>
              <span className="section-tag">// latest</span>
              <h2>Recent Writeups</h2>
            </div>
            <Link to="/writeups" className="see-all">
              View all <span>→</span>
            </Link>
          </div>

          <div className="writeup-grid">
            {recent.map((w, i) => (
              <Link
                key={w.slug}
                to={`/${w.slug}`}
                className="writeup-card"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="card-category">
                  <span className="card-icon">{categoryIcons[w.category] || categoryIcons.default}</span>
                  <span>{w.category}</span>
                </div>

                <h3 className="card-title">{w.title}</h3>

                {w.date && <span className="card-date">{w.date}</span>}

                <div className="card-tags">
                  {w.tags.slice(0, 3).map((t) => (
                    <span key={t} className="tag">{t}</span>
                  ))}
                </div>

                <div className="card-arrow">→</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── CATEGORIES ── */}
      {categories.length > 0 && (
        <section className="section categories-section">
          <div className="section-header">
            <div>
              <span className="section-tag">// explore</span>
              <h2>Categories</h2>
            </div>
          </div>

          <div className="categories-grid">
            {categories.map((cat, i) => {
              const count = writeups.filter((w) => w.category === cat).length;
              return (
                <Link
                  key={cat}
                  to={`/writeups?cat=${cat}`}
                  className="category-card"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <span className="cat-icon">{categoryIcons[cat] || categoryIcons.default}</span>
                  <span className="cat-name">{cat}</span>
                  <span className="cat-count">{count} writeup{count !== 1 ? "s" : ""}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── QUICK NOTES ── */}
      {notes.length > 0 && (
        <section className="section notes-section">
          <div className="section-header">
            <div>
              <span className="section-tag">// quick access</span>
              <h2>Cheatsheets & Notes</h2>
            </div>
            <Link to="/notes" className="see-all">
              Browse all <span>→</span>
            </Link>
          </div>

          <div className="notes-grid">
            {notes.slice(0, 6).map((n, i) => (
              <Link
                key={n.slug}
                to={`/${n.slug}`}
                className="note-card"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="note-icon">📄</div>
                <div className="note-info">
                  <h4>{n.title}</h4>
                  <span className="note-path">
                    {n.category}{n.subcategory ? ` / ${n.subcategory}` : ""}
                  </span>
                </div>
                <span className="note-arrow">→</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── FOOTER ── */}
      <footer className="site-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <span className="footer-logo">
              [Terminal<span className="text-green">Ghost</span>]
            </span>
            <p>Built for hackers, by a hacker.</p>
          </div>
          <div className="footer-links">
            <Link to="/writeups">Writeups</Link>
            <Link to="/notes">Notes</Link>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span className="font-mono text-muted">
            © {new Date().getFullYear()} Terminal Ghost — All rights reserved.
          </span>
        </div>
      </footer>
    </div>
  );
}