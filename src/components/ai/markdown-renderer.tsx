import * as React from "react";
import { cn } from "@/lib/utils";
import { CodeEditor } from "./code-editor";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const renderInlineCode = (text: string) => {
    const parts = text.split(/(`[^`]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code
            key={i}
            className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono text-pink-500"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return <span key={i}>{renderInlineFormatting(part)}</span>;
    });
  };

  const renderInlineFormatting = (text: string) => {
    let result: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      const italicMatch = remaining.match(/\*(.+?)\*/);
      const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);

      const matches = [
        boldMatch && { type: "bold", match: boldMatch },
        italicMatch && { type: "italic", match: italicMatch },
        linkMatch && { type: "link", match: linkMatch },
      ].filter(Boolean);

      if (matches.length === 0) {
        result.push(remaining);
        break;
      }

      const firstMatch = matches.reduce((closest, m) => {
        if (!m) return closest;
        if (!closest) return m;
        return m.match.index < closest.match.index ? m : closest;
      }, null as { type: string; match: RegExpMatchArray } | null);

      if (!firstMatch) {
        result.push(remaining);
        break;
      }

      const index = firstMatch.match.index;
      if (index > 0) {
        result.push(remaining.slice(0, index));
      }

      if (firstMatch.type === "bold") {
        result.push(
          <strong key={key++} className="font-semibold">
            {firstMatch.match[1]}
          </strong>
        );
        remaining = remaining.slice(index + firstMatch.match[0].length);
      } else if (firstMatch.type === "italic") {
        result.push(
          <em key={key++} className="italic">
            {firstMatch.match[1]}
          </em>
        );
        remaining = remaining.slice(index + firstMatch.match[0].length);
      } else if (firstMatch.type === "link") {
        result.push(
          <a
            key={key++}
            href={firstMatch.match[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:text-primary/80"
          >
            {firstMatch.match[1]}
          </a>
        );
        remaining = remaining.slice(index + firstMatch.match[0].length);
      }
    }

    return result;
  };

  const parseMarkdown = (md: string): React.ReactNode[] => {
    const lines = md.split("\n");
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      if (line.startsWith("```")) {
        const language = line.slice(3).trim();
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].startsWith("```")) {
          codeLines.push(lines[i]);
          i++;
        }
        elements.push(
          <div key={`code-${elements.length}`} className="my-3">
            <CodeEditor
              code={codeLines.join("\n")}
              language={language || "text"}
              showLineNumbers={false}
            />
          </div>
        );
        i++;
        continue;
      }

      if (line.startsWith("# ")) {
        elements.push(
          <h1 key={`h1-${elements.length}`} className="text-2xl font-bold mt-6 mb-3">
            {renderInlineCode(line.slice(2))}
          </h1>
        );
      } else if (line.startsWith("## ")) {
        elements.push(
          <h2 key={`h2-${elements.length}`} className="text-xl font-semibold mt-5 mb-2">
            {renderInlineCode(line.slice(3))}
          </h2>
        );
      } else if (line.startsWith("### ")) {
        elements.push(
          <h3 key={`h3-${elements.length}`} className="text-lg font-medium mt-4 mb-2">
            {renderInlineCode(line.slice(4))}
          </h3>
        );
      } else if (line.startsWith("- ") || line.startsWith("* ")) {
        const listItems: string[] = [];
        while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) {
          listItems.push(lines[i].slice(2));
          i++;
        }
        elements.push(
          <ul key={`ul-${elements.length}`} className="list-disc list-inside space-y-1 my-2 text-sm">
            {listItems.map((item, j) => (
              <li key={j}>{renderInlineCode(item)}</li>
            ))}
          </ul>
        );
        continue;
      } else if (/^\d+\.\s/.test(line)) {
        const listItems: string[] = [];
        while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
          listItems.push(lines[i].replace(/^\d+\.\s/, ""));
          i++;
        }
        elements.push(
          <ol key={`ol-${elements.length}`} className="list-decimal list-inside space-y-1 my-2 text-sm">
            {listItems.map((item, j) => (
              <li key={j}>{renderInlineCode(item)}</li>
            ))}
          </ol>
        );
        continue;
      } else if (line.startsWith("> ")) {
        elements.push(
          <blockquote
            key={`quote-${elements.length}`}
            className="border-l-4 border-primary/30 pl-4 italic text-muted-foreground my-2 text-sm"
          >
            {renderInlineCode(line.slice(2))}
          </blockquote>
        );
      } else if (line.startsWith("---")) {
        elements.push(
          <hr key={`hr-${elements.length}`} className="my-4 border-t" />
        );
      } else if (line.startsWith("|")) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].startsWith("|")) {
          tableLines.push(lines[i]);
          i++;
        }
        if (tableLines.length >= 2) {
          const headers = tableLines[0]
            .split("|")
            .filter((c) => c.trim())
            .map((c) => c.trim());
          const rows = tableLines.slice(2).map((row) =>
            row
              .split("|")
              .filter((c) => c.trim())
              .map((c) => c.trim())
          );
          elements.push(
            <div key={`table-${elements.length}`} className="my-3 overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {headers.map((h, j) => (
                      <th key={j} className="px-3 py-2 text-left font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, j) => (
                    <tr key={j} className="border-b last:border-0">
                      {row.map((cell, k) => (
                        <td key={k} className="px-3 py-2">
                          {renderInlineCode(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        continue;
      } else if (line.trim() === "") {
        elements.push(<div key={`space-${elements.length}`} className="h-2" />);
      } else {
        elements.push(
          <p key={`p-${elements.length}`} className="text-sm leading-relaxed my-1">
            {renderInlineCode(line)}
          </p>
        );
      }
      i++;
    }

    return elements;
  };

  return (
    <div className={cn("prose prose-sm dark:prose-invert max-w-none", className)}>
      {parseMarkdown(content)}
    </div>
  );
}

export { MarkdownRenderer };
