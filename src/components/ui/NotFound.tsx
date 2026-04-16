import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

export default function NotFound() {
  const navigate = useNavigate();
  const [glitch, setGlitch] = useState(false);
  const [showCursor, setShowCursor] = useState(true);

  /* Periodic glitch burst */
  useEffect(() => {
    const glitchInterval = setInterval(() => {
      setGlitch(true);
      setTimeout(() => setGlitch(false), 180);
    }, 3500);
    return () => clearInterval(glitchInterval);
  }, []);

  /* Blinking cursor */
  useEffect(() => {
    const cursorInterval = setInterval(() => setShowCursor((v) => !v), 530);
    return () => clearInterval(cursorInterval);
  }, []);

  return (
    <div className="not-found-page">
      <div className="not-found-terminal">
        {/* Terminal chrome */}
        <div className="not-found-chrome">
          <div className="terminal-dots">
            <span className="dot dot-red"></span>
            <span className="dot dot-yellow"></span>
            <span className="dot dot-green"></span>
          </div>
          <span className="terminal-title">ghost@kali: ~/error</span>
        </div>

        {/* Terminal body */}
        <div className="not-found-body">
          <div className="nf-line output">$ locate --ghost</div>
          <div className="nf-line error">
            bash: ghost: <span className="nf-error-text">No such file or directory</span>
          </div>
          <div className="nf-line output">$ echo $?</div>
          <div className="nf-line cmd">127</div>

          <div className={`nf-404 ${glitch ? "glitch" : ""}`} data-text="404">
            404
          </div>

          <div className="nf-message">
            <span className="nf-label">GHOST_NOT_FOUND:</span> The page you're looking
            for dissolved into the void.
            <span className={`nf-cursor ${showCursor ? "visible" : ""}`}>▊</span>
          </div>

          <div className="nf-actions">
            <button className="btn btn-ghost nf-back-btn" onClick={() => navigate(-1)}>
              <span>←</span> Go back
            </button>
            <Link to="/" className="btn btn-primary">
              <span>⌂</span> Return to base
            </Link>
            <Link to="/writeups" className="btn btn-ghost">
              <span>$</span> Browse writeups
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
