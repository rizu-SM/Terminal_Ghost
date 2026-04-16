import { Link } from "react-router-dom";
import { loadAllContent } from "../../utils/loader";

export default function Sidebar() {
  const all = loadAllContent();
  const tree = all.reduce((acc: any, note: any) => {
    if (!acc[note.category]) acc[note.category] = {};
    if (!acc[note.category][note.subcategory]) acc[note.category][note.subcategory] = [];
    acc[note.category][note.subcategory].push(note);
    return acc;
  }, {});

  return (
    <aside className="sidebar">
      <h3>Notes</h3>

      {Object.entries(tree).map(([category, subcats]) => (
        <div key={category} className="category">
          <h4>{category}</h4>

          {Object.entries(subcats as any).map(
            ([subcategory, notes]: [string, any]) => (
              <div key={subcategory} className="subcategory">
                <p>{subcategory}</p>

                <ul>
                  {(notes as any).map((note: any) => (
                    <li key={note.slug}>
                      <Link to={`/${note.type}s/${note.slug}`}>
                        {note.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )
          )}
        </div>
      ))}
    </aside>
  );
}