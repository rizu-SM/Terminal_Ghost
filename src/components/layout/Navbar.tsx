import { Link, useLocation } from "react-router-dom";
import { useState } from "react";

export default function Navbar() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    { to: "/", label: "Home" },
    { to: "/writeups", label: "Writeups" },
    { to: "/notes", label: "Notes" },
  ];

  const openSearch = () =>
    window.dispatchEvent(new Event("open-command-palette"));

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* Logo */}
        <Link to="/" className="navbar-logo">
          <span className="logo-bracket">[</span>
          <span className="logo-text">Terminal</span>
          <span className="logo-ghost">Ghost</span>
          <span className="logo-bracket">]</span>
          <span className="logo-cursor">_</span>
        </Link>

        {/* Desktop Nav Links */}
        <div className={`navbar-links ${mobileOpen ? "open" : ""}`}>
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`nav-link ${
                location.pathname === link.to ||
                (link.to !== "/" && location.pathname.startsWith(link.to))
                  ? "active"
                  : ""
              }`}
              onClick={() => setMobileOpen(false)}
            >
              <span className="nav-prefix">&gt;</span>
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right section */}
        <div className="navbar-right">
          {/* Search button */}
          <button
            className="navbar-search-btn"
            onClick={openSearch}
            aria-label="Open search (Ctrl+K)"
            title="Search (Ctrl+K)"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <span className="navbar-search-text">Search</span>
            <span className="navbar-search-kbd">
              <kbd>Ctrl</kbd><kbd>K</kbd>
            </span>
          </button>

          {/* Status dot */}
          <div className="navbar-status">
            <span className="status-dot"></span>
            <span className="status-text">online</span>
          </div>

          {/* Portfolio */}
          <a
            href="https://portfolio-final-mu-ten.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="navbar-social"
            title="Visit Portfolio"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </a>

          {/* GitHub */}
          <a
            href="https://github.com/rizu-SM/"
            target="_blank"
            rel="noopener noreferrer"
            className="navbar-social"
            title="Visit GitHub"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </a>
        </div>

        {/* Mobile toggle */}
        <button
          className="navbar-toggle"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation"
        >
          <span className={`hamburger ${mobileOpen ? "open" : ""}`}>
            <span></span>
            <span></span>
            <span></span>
          </span>
        </button>
      </div>
    </nav>
  );
}