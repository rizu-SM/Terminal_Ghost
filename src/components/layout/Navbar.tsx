import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="logo">
        <Link to="/">CTF Writeups</Link>
      </div>

      <div className="nav-links">
        <Link to="/writeups">Writeups</Link>
        <Link to="/notes">Notes</Link>
      </div>
    </nav>
  );
}