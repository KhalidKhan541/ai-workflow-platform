"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Bot, Send, RefreshCw, Plus, BookOpen, BarChart3, Settings,
  Sparkles, Copy, Trash2, Save, ChevronDown, MessageSquare,
  Lightbulb, Code, FileText, Wand2, Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface PromptTemplate {
  id: string;
  name: string;
  category: string;
  prompt: string;
  description: string;
  usageCount: number;
}

const promptTemplates: PromptTemplate[] = [
  { id: "1", name: "Summarize Text", category: "Content", prompt: "Summarize the following text in 3 bullet points:", description: "Condense long text into key points", usageCount: 342 },
  { id: "2", name: "Generate Email", category: "Communication", prompt: "Write a professional email with the following context:", description: "Draft professional emails quickly", usageCount: 256 },
  { id: "3", name: "Code Review", category: "Development", prompt: "Review the following code and suggest improvements:", description: "AI-powered code review", usageCount: 189 },
  { id: "4", name: "Extract Data", category: "Data", prompt: "Extract structured data from the following text:", description: "Parse unstructured text to structured format", usageCount: 145 },
  { id: "5", name: "Translate", category: "Content", prompt: "Translate the following text to {language}:", description: "Multi-language translation", usageCount: 278 },
  { id: "6", name: "Classify Intent", category: "Analysis", prompt: "Classify the intent of the following message:", description: "Categorize user messages automatically", usageCount: 167 },
];

const mockChatHistory: ChatMessage[] = [
  { id: "1", role: "user", content: "Analyze the performance of my email campaign workflow and suggest improvements.", timestamp: new Date(Date.now() - 300000) },
  { id: "2", role: "assistant", content: "Based on the analysis of your Email Campaign Automation workflow:\n\n**Performance Summary:**\n- Total executions: 3,420 (last 30 days)\n- Success rate: 99.2%\n- Average duration: 5.4s\n\n**Suggestions for improvement:**\n1. **Add error retry logic** - 8 failures were due to temporary SMTP errors. Adding a 3-retry mechanism could recover ~95% of these.\n2. **Implement rate limiting** - During peak hours, email delivery slows down. Consider batching sends.\n3. **A/B test subject lines** - Your open rate (24%) is below industry average (28%). AI-generated subject lines could help.\n\nShall I implement any of these suggestions?", timestamp: new Date(Date.now() - 299000) },
];

const aiUsageStats = {
  totalTokens: 245678,
  tokensLimit: 1000000,
  modelsUsed: ["GPT-4o", "GPT-4o-mini", "Claude 3.5"],
  avgLatency: "1.2s",
  totalRequests: 4521,
  costThisMonth: 47.82,
};

const agentConfigs = [
  { id: "1", name: "Data Analyst", model: "GPT-4o", status: "active", tasks: 156, description: "Analyzes workflow data and generates insights" },
  { id: "2", name: "Code Assistant", model: "GPT-4o", status: "active", tasks: 89, description: "Helps build and debug workflow steps" },
  { id: "3", name: "Content Writer", model: "GPT-4o-mini", status: "active", tasks: 234, description: "Generates content for email and marketing workflows" },
  { id: "4", name: "Support Agent", model: "Claude 3.5", status: "paused", tasks: 45, description: "Handles customer support ticket routing" },
];

export default function AIWorkspacePage() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("chat");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(mockChatHistory);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: input, timestamp: new Date() };
    setChatMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    await new Promise((r) => setTimeout(r, 1500));
    const assistantMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "I've analyzed your request. Here's what I found:\n\nBased on the workflow data, I can see several optimization opportunities. The main areas for improvement are in error handling and processing efficiency.\n\nWould you like me to create a detailed report or implement changes directly?",
      timestamp: new Date(),
    };
    setChatMessages((prev) => [...prev, assistantMsg]);
    setIsTyping(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]" role="status" aria-label="Loading AI workspace">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">AI Workspace</h1>
          <p className="text-muted-foreground mt-1">Build, chat, and manage AI agents for your workflows</p>
        </div>
      </div>

      {/* Usage Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Tokens Used</p>
            <p className="text-2xl font-bold">{(aiUsageStats.totalTokens / 1000).toFixed(1)}K</p>
            <Progress value={(aiUsageStats.totalTokens / aiUsageStats.tokensLimit) * 100} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">of {(aiUsageStats.tokensLimit / 1000).toFixed(0)}K limit</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Requests</p>
            <p className="text-2xl font-bold">{aiUsageStats.totalRequests.toLocaleString()}</p>
            <p className="text-xs text-green-500 mt-2">+12% vs last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Avg Latency</p>
            <p className="text-2xl font-bold">{aiUsageStats.avgLatency}</p>
            <p className="text-xs text-muted-foreground mt-2">across all models</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Cost This Month</p>
            <p className="text-2xl font-bold">${aiUsageStats.costThisMonth}</p>
            <p className="text-xs text-muted-foreground mt-2">Budget: $200/mo</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="chat"><MessageSquare className="h-4 w-4 mr-1 inline" /> Chat</TabsTrigger>
          <TabsTrigger value="agents"><Bot className="h-4 w-4 mr-1 inline" /> Agents</TabsTrigger>
          <TabsTrigger value="prompts"><BookOpen className="h-4 w-4 mr-1 inline" /> Prompt Library</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart3 className="h-4 w-4 mr-1 inline" /> Analytics</TabsTrigger>
        </TabsList>

        {/* Chat Tab */}
        <TabsContent value="chat" className="mt-6">
          <Card className="h-[calc(100vh-380px)] min-h-[400px] flex flex-col">
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-xl px-4 py-3 ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    {msg.role === "assistant" && (
                      <div className="flex items-center gap-2 mb-2">
                        <Bot className="h-4 w-4" />
                        <span className="text-xs font-medium">AI Assistant</span>
                      </div>
                    )}
                    <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                    <p className="text-xs opacity-70 mt-2">{msg.timestamp.toLocaleTimeString()}</p>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4" />
                      <div className="flex gap-1">
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </CardContent>
            <div className="border-t p-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Ask AI anything about your workflows..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  aria-label="Chat input"
                />
                <Button onClick={sendMessage} disabled={!input.trim() || isTyping}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Agents Tab */}
        <TabsContent value="agents" className="mt-6">
          <div className="flex justify-end mb-4">
            <Button><Plus className="h-4 w-4 mr-2" /> Create Agent</Button>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {agentConfigs.map((agent) => (
              <Card key={agent.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Bot className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{agent.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">{agent.model}</p>
                      </div>
                    </div>
                    <Badge variant={agent.status === "active" ? "default" : "secondary"}>{agent.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">{agent.description}</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{agent.tasks} tasks completed</span>
                    <Button variant="ghost" size="sm">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Prompts Tab */}
        <TabsContent value="prompts" className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium">Prompt Templates</h3>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Template</Button>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {promptTemplates.map((pt) => (
              <Card key={pt.id} className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-sm">{pt.name}</CardTitle>
                      <Badge variant="secondary" className="text-xs mt-1">{pt.category}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{pt.usageCount} uses</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-3">{pt.description}</p>
                  <div className="bg-muted rounded-lg p-2 text-xs font-mono text-muted-foreground line-clamp-2">
                    {pt.prompt}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button variant="outline" size="sm" className="flex-1">
                      <Copy className="h-3 w-3 mr-1" /> Use
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="mt-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Token Usage by Model</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { name: "GPT-4o", tokens: 156000, percentage: 63.5 },
                    { name: "GPT-4o-mini", tokens: 67000, percentage: 27.3 },
                    { name: "Claude 3.5", tokens: 22678, percentage: 9.2 },
                  ].map((m) => (
                    <div key={m.name}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium">{m.name}</span>
                        <span className="text-muted-foreground">{(m.tokens / 1000).toFixed(1)}K ({m.percentage}%)</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${m.percentage}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Request Volume (Last 7 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[680, 720, 590, 810, 750, 420, 550].map((val, i) => {
                    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-8">{days[i]}</span>
                        <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden">
                          <div className="h-full bg-primary/70 rounded-full flex items-center pl-2" style={{ width: `${(val / 900) * 100}%` }}>
                            <span className="text-xs font-medium text-primary-foreground">{val}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
