import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { useState, useRef } from "react";

type Props = { content: string };

/* ── Copy button component ── */
function CopyButton({ preRef }: { preRef: React.RefObject<HTMLPreElement | null> }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = preRef.current?.textContent ?? "";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard not available */
    }
  };

  return (
    <button className={`code-copy-btn ${copied ? "copied" : ""}`} onClick={handleCopy}>
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}

/* ── Code block wrapper (pre level) ── */
function CodeBlockWrapper({ children, node }: { children: React.ReactNode; node?: any }) {
  const preRef = useRef<HTMLPreElement>(null);

  /* Extract language from the child <code> element's className */
  const codeNode = node?.children?.find((c: any) => c.tagName === "code");
  const classNames: string[] = codeNode?.properties?.className ?? [];
  const langMatch = classNames.join(" ").match(/language-(\w+)/);
  const lang = langMatch ? langMatch[1] : "code";

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span className="code-lang-label">{lang}</span>
        <CopyButton preRef={preRef} />
      </div>
      <pre ref={preRef}>{children}</pre>
    </div>
  );
}

export default function MarkdownRenderer({ content }: Props) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        /* Intercept <pre> to add copy button + language label */
        pre: ({ children, node, ...rest }) => (
          <CodeBlockWrapper node={node} {...rest}>
            {children}
          </CodeBlockWrapper>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}