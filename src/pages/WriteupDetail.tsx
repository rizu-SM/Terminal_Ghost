import { useParams } from "react-router-dom";
import { loadAllContent } from "../utils/loader";
import MarkdownRenderer from "../components/markdown/MarkdownRenderer";
import NotFound from "../components/ui/NotFound";

export default function WriteupDetail() {
  const { "*": slug } = useParams();

  const all = loadAllContent();
  const item = all.find((w) => w.slug === slug);

  if (!item) {
    return <NotFound />;
  }

  return (
    <div className="writeup-page">
      <h1>{item.title}</h1>

      <div className="meta">
        {item.date && <span>{item.date}</span>}
        <span className="meta-sep">·</span>
        <span className="meta-category">{item.category}</span>
        {item.subcategory && (
          <>
            <span className="meta-sep">/</span>
            <span className="meta-category">{item.subcategory}</span>
          </>
        )}
        <div className="tags">
          {item.tags.map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </div>
      </div>

      <MarkdownRenderer content={item.content} />
    </div>
  );
}