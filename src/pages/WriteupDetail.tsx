import { useParams } from "react-router-dom";
import { loadAllContent } from "../utils/loader";
import MarkdownRenderer from "../components/markdown/MarkdownRenderer";

export default function WriteupDetail() {
  const { "*": slug } = useParams();

  const all = loadAllContent();

  const item = all.find((w) => w.slug === slug);

  if (!item) {
    return <div>Writeup not found</div>;
  }

  return (
    <div className="writeup-page">
      <h1>{item.title}</h1>

      <div className="meta">
        <span>{item.date}</span>
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