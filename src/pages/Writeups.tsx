import { loadAllContent } from "../utils/loader";
import { Link } from "react-router-dom";

export default function Writeups() {
  const all = loadAllContent();

  const writeups = all.filter((i) => i.type === "writeup");

  return (
    <div>
      <h1>Writeups</h1>

      <div className="grid">
        {writeups.map((w) => (
          <Link
            key={w.slug}
            to={`/${w.slug}`}
            className="card"
          >
            <h3>{w.title}</h3>
            <p>{w.category}</p>

            <div className="tags">
              {w.tags.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}