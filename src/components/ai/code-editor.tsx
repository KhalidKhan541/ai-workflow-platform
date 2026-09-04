import * as React from "react";
import { cn } from "@/lib/utils";
import { Copy, Check, Download, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { TooltipWrapper } from "@/components/ui/tooltip";

interface CodeEditorProps {
  code: string;
  language?: string;
  readOnly?: boolean;
  onChange?: (code: string) => void;
  showLineNumbers?: boolean;
  showCopy?: boolean;
  showDownload?: boolean;
  maxHeight?: number;
  filename?: string;
  className?: string;
}

const languageColors: Record<string, string> = {
  javascript: "bg-yellow-400",
  typescript: "bg-blue-500",
  python: "bg-green-500",
  html: "bg-orange-500",
  css: "bg-blue-400",
  json: "bg-yellow-300",
  bash: "bg-gray-500",
  sql: "bg-blue-600",
  yaml: "bg-pink-400",
  markdown: "bg-gray-400",
  jsx: "bg-cyan-400",
  tsx: "bg-cyan-500",
  go: "bg-cyan-600",
  rust: "bg-orange-600",
  java: "bg-red-500",
  ruby: "bg-red-600",
};

function highlightSyntax(code: string, language: string): string {
  const keywords: Record<string, string[]> = {
    javascript: ["const", "let", "var", "function", "return", "if", "else", "for", "while", "do", "switch", "case", "break", "continue", "class", "extends", "import", "export", "default", "from", "async", "await", "try", "catch", "finally", "throw", "new", "this", "typeof", "instanceof", "in", "of", "null", "undefined", "true", "false"],
    typescript: ["const", "let", "var", "function", "return", "if", "else", "for", "while", "do", "switch", "case", "break", "continue", "class", "extends", "import", "export", "default", "from", "async", "await", "try", "catch", "finally", "throw", "new", "this", "typeof", "instanceof", "in", "of", "null", "undefined", "true", "false", "interface", "type", "enum", "implements", "abstract", "readonly", "private", "protected", "public", "static", "as", "is", "keyof", "infer"],
    python: ["def", "class", "return", "if", "elif", "else", "for", "while", "break", "continue", "import", "from", "as", "try", "except", "finally", "raise", "with", "lambda", "pass", "yield", "global", "nonlocal", "assert", "del", "in", "is", "not", "and", "or", "None", "True", "False", "self", "async", "await"],
    sql: ["SELECT", "FROM", "WHERE", "INSERT", "UPDATE", "DELETE", "CREATE", "ALTER", "DROP", "TABLE", "INDEX", "JOIN", "LEFT", "RIGHT", "INNER", "OUTER", "ON", "AND", "OR", "NOT", "NULL", "IN", "LIKE", "BETWEEN", "ORDER", "BY", "GROUP", "HAVING", "LIMIT", "OFFSET", "UNION", "ALL", "DISTINCT", "AS", "INTO", "VALUES", "SET", "CASCADE", "RESTRICT", "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "DEFAULT", "CHECK", "UNIQUE", "INDEX"],
  };

  const langKeywords = keywords[language] || keywords.javascript || [];

  let result = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  result = result.replace(/(\/\/.*$|\/\*[\s\S]*?\*\/)/gm, '<span class="text-muted-foreground italic">$1</span>');
  result = result.replace(/(#.*$)/gm, '<span class="text-muted-foreground italic">$1</span>');

  result = result.replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, '<span class="text-green-500">$1</span>');

  result = result.replace(/\b(\d+\.?\d*)\b/g, '<span class="text-orange-400">$1</span>');

  langKeywords.forEach((keyword) => {
    const regex = new RegExp(`\\b(${keyword})\\b`, "g");
    result = result.replace(regex, '<span class="text-purple-500 font-medium">$1</span>');
  });

  result = result.replace(/\b([a-zA-Z_]\w*)\s*(?=\()/g, '<span class="text-blue-400">$1</span>');

  return result;
}

function CodeEditor({
  code,
  language = "typescript",
  readOnly = false,
  onChange,
  showLineNumbers = true,
  showCopy = true,
  showDownload = false,
  maxHeight = 400,
  filename,
  className,
}: CodeEditorProps) {
  const [copied, setCopied] = React.useState(false);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const lines = code.split("\n");

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || `code.${language === "typescript" ? "ts" : language === "javascript" ? "js" : language}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const highlighted = highlightSyntax(code, language);

  return (
    <div className={cn("rounded-lg border bg-card overflow-hidden", className)}>
      <div className="flex items-center justify-between border-b px-4 py-2 bg-muted/50">
        <div className="flex items-center gap-2">
          <span className={cn("h-3 w-3 rounded-full", languageColors[language] || "bg-gray-400")} />
          {filename && <span className="text-sm font-medium">{filename}</span>}
          {!filename && (
            <Select value={language}>
              <SelectTrigger className="h-7 w-32 text-xs border-0">
                <SelectValue />
              </SelectTrigger>
            </Select>
          )}
        </div>
        <div className="flex items-center gap-1">
          {showDownload && (
            <TooltipWrapper content="Download">
              <Button variant="ghost" size="icon-sm" onClick={handleDownload}>
                <Download className="h-4 w-4" />
              </Button>
            </TooltipWrapper>
          )}
          {showCopy && (
            <TooltipWrapper content={copied ? "Copied!" : "Copy"}>
              <Button variant="ghost" size="icon-sm" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </Button>
            </TooltipWrapper>
          )}
          <TooltipWrapper content={isExpanded ? "Collapse" : "Expand"}>
            <Button variant="ghost" size="icon-sm" onClick={() => setIsExpanded(!isExpanded)}>
              {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </TooltipWrapper>
        </div>
      </div>
      <div
        className="overflow-auto scrollbar-thin"
        style={{ maxHeight: isExpanded ? "none" : maxHeight }}
      >
        <div className="flex">
          {showLineNumbers && (
            <div className="flex-shrink-0 border-r bg-muted/30 py-3 pl-3 pr-2">
              {lines.map((_, i) => (
                <div key={i} className="text-xs text-muted-foreground/60 text-right min-w-[2rem] leading-6">
                  {i + 1}
                </div>
              ))}
            </div>
          )}
          <pre className="flex-1 overflow-x-auto p-3">
            <code
              className="text-sm leading-6 font-mono"
              dangerouslySetInnerHTML={{ __html: highlighted }}
            />
          </pre>
        </div>
      </div>
    </div>
  );
}

export { CodeEditor };
