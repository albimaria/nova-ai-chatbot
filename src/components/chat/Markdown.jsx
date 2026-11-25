import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { Check, Copy } from "lucide-react";

import "katex/dist/katex.min.css";
import "highlight.js/styles/github-dark.css";

function textOf(node) {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (node?.props?.children) return textOf(node.props.children);
  return "";
}

function CodeBlock({ language, children }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(textOf(children).replace(/\n$/, ""));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked; nothing to do.
    }
  };

  return (
    <div className="code-block">
      <div className="code-header">
        <span>{language || "code"}</span>
        <button type="button" onClick={copy} aria-label="Copy code">
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>
        <code className={language ? `hljs language-${language}` : "hljs"}>{children}</code>
      </pre>
    </div>
  );
}

const components = {
  pre: ({ children }) => children,
  code({ className, children, node, ...props }) {
    const match = /language-([\w+#-]+)/.exec(className || "");
    const isBlock = match || String(textOf(children)).includes("\n");

    if (!isBlock) {
      return (
        <code className="inline-code" {...props}>
          {children}
        </code>
      );
    }

    return <CodeBlock language={match?.[1]}>{children}</CodeBlock>;
  },
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="table-wrap">
      <table>{children}</table>
    </div>
  ),
};

function Markdown({ content }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, [rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default memo(Markdown);
