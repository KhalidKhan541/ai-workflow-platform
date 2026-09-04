import * as React from "react";
import { cn } from "@/lib/utils";
import { Send, Bot, User, Copy, Check, Loader2, Square, Paperclip, Mic, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MarkdownRenderer } from "./markdown-renderer";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  loading?: boolean;
  error?: string;
}

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  onStopGeneration?: () => void;
  onCopyMessage?: (content: string) => void;
  onRegenerate?: (messageId: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  showAvatar?: boolean;
  userAvatar?: string;
  assistantAvatar?: string;
  className?: string;
}

function ChatInterface({
  messages,
  onSendMessage,
  onStopGeneration,
  onCopyMessage,
  onRegenerate,
  isLoading = false,
  placeholder = "Type your message...",
  showAvatar = true,
  userAvatar,
  assistantAvatar,
  className,
}: ChatInterfaceProps) {
  const [input, setInput] = React.useState("");
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSendMessage(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCopy = async (content: string, id: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    onCopyMessage?.(content);
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Bot className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">How can I help you today?</p>
              <p className="text-sm text-muted-foreground mt-1">
                Ask me anything about your workflows, data, or processes.
              </p>
            </div>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3 group",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {message.role === "assistant" && showAvatar && (
                <Avatar size="sm" className="mt-0.5">
                  {assistantAvatar && <AvatarImage src={assistantAvatar} />}
                  <AvatarFallback>
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
              <div
                className={cn(
                  "max-w-[80%] rounded-xl px-4 py-3",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted",
                  message.error && "border border-destructive"
                )}
              >
                {message.role === "assistant" ? (
                  <MarkdownRenderer content={message.content} />
                ) : (
                  <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                )}
                {message.loading && (
                  <div className="flex items-center gap-2 mt-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-xs">Thinking...</span>
                  </div>
                )}
                {message.error && (
                  <p className="text-xs text-destructive mt-2">{message.error}</p>
                )}
                <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] text-muted-foreground">
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                  <button
                    onClick={() => handleCopy(message.content, message.id)}
                    className="rounded p-1 hover:bg-background/20 transition-colors"
                  >
                    {copiedId === message.id ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                  {message.role === "assistant" && !message.loading && onRegenerate && (
                    <button
                      onClick={() => onRegenerate(message.id)}
                      className="rounded p-1 hover:bg-background/20 transition-colors"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
              {message.role === "user" && showAvatar && (
                <Avatar size="sm" className="mt-0.5">
                  {userAvatar && <AvatarImage src={userAvatar} />}
                  <AvatarFallback>
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="border-t p-4">
        <div className="max-w-3xl mx-auto">
          <div className="relative flex items-end gap-2">
            <Button variant="ghost" size="icon" className="flex-shrink-0 mb-1">
              <Paperclip className="h-4 w-4" />
            </Button>
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              autoResize
              rows={1}
              className="min-h-[44px] max-h-[200px] resize-none pr-24"
            />
            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              {isLoading && onStopGeneration ? (
                <Button size="icon" variant="destructive" onClick={onStopGeneration}>
                  <Square className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  onClick={handleSubmit}
                  disabled={!input.trim() || isLoading}
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}

export { ChatInterface, type Message };
