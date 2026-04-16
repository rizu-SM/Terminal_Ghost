import { loadAllContent } from "../utils/loader";
import { Link } from "react-router-dom";

export default function Notes() {
  const all = loadAllContent();

  const notes = all.filter((i) => i.type === "note");

  return (
    <div>
      <h1>Notes</h1>

      {notes.map((n) => (
        <Link key={n.slug} to={`/notes/${n.slug}`}>
          <div className="note-card">
            <h3>{n.title}</h3>
            <p>
              {n.category} / {n.subcategory}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}