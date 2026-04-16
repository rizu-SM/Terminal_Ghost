import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="home">

      {/* HERO */}
      <section className="hero">
        <div className="hero-left">

          <span className="badge">Cybersecurity Blog</span>

          <h1>
            Security Writeups <br /> and Research
          </h1>

          <p>
            Explore CTF writeups, vulnerability breakdowns, and
            practical security notes built from real challenges.
          </p>

          <div className="buttons">
            <Link to="/writeups" className="btn primary">
              Explore Writeups
            </Link>

            <Link to="/notes" className="btn secondary">
              View Notes
            </Link>
          </div>

        </div>

        {/* RIGHT PANEL (terminal style like your image) */}
        <div className="hero-right">

          <div className="terminal">
            <div className="terminal-header">
              <span className="dot red"></span>
              <span className="dot yellow"></span>
              <span className="dot green"></span>
              <span className="title">overview</span>
            </div>

            <div className="terminal-body">
              <p>Backend security notes, practical writeups, and clear walkthroughs.</p>

              <p className="muted">
                Initializing secure connection... SUCCESS<br />
                Loading CTF knowledge base...
              </p>
            </div>
          </div>

          <div className="status">
            ⚡ Active Knowledge Base
          </div>

        </div>
      </section>

    </div>
  );
}