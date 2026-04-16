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
              className={`nav-link ${location.pathname === link.to ? "active" : ""}`}
              onClick={() => setMobileOpen(false)}
            >
              <span className="nav-prefix">&gt;</span>
              {link.label}
            </Link>
          ))}
        </div>

        {/* Status indicator */}
        <div className="navbar-status">
          <span className="status-dot"></span>
          <span className="status-text">online</span>
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