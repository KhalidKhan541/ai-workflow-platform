import * as React from "react";
import { cn } from "@/lib/utils";
import { Search, GripVertical, Zap, Settings, GitBranch, Clock, Link, Bot, Mail, Database, Globe, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TooltipWrapper } from "@/components/ui/tooltip";

interface StepType {
  type: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: string;
}

const defaultStepTypes: StepType[] = [
  { type: "trigger", label: "Trigger", description: "Start the workflow", icon: <Zap className="h-5 w-5 text-blue-500" />, category: "Core" },
  { type: "action", label: "Action", description: "Perform an action", icon: <Settings className="h-5 w-5 text-green-500" />, category: "Core" },
  { type: "condition", label: "Condition", description: "Branch based on conditions", icon: <GitBranch className="h-5 w-5 text-yellow-500" />, category: "Core" },
  { type: "delay", label: "Delay", description: "Wait before proceeding", icon: <Clock className="h-5 w-5 text-purple-500" />, category: "Core" },
  { type: "webhook", label: "Webhook", description: "Call a webhook", icon: <Link className="h-5 w-5 text-orange-500" />, category: "Integration" },
  { type: "ai", label: "AI Step", description: "AI-powered processing", icon: <Bot className="h-5 w-5 text-indigo-500" />, category: "AI" },
  { type: "email", label: "Send Email", description: "Send an email", icon: <Mail className="h-5 w-5 text-cyan-500" />, category: "Integration" },
  { type: "database", label: "Database", description: "Query or update database", icon: <Database className="h-5 w-5 text-emerald-500" />, category: "Integration" },
  { type: "http", label: "HTTP Request", description: "Make HTTP request", icon: <Globe className="h-5 w-5 text-rose-500" />, category: "Integration" },
  { type: "transform", label: "Transform", description: "Transform data", icon: <RefreshCw className="h-5 w-5 text-violet-500" />, category: "Data" },
];

interface StepPaletteProps {
  stepTypes?: StepType[];
  onStepDrag?: (stepType: string) => void;
  className?: string;
}

function StepPalette({ stepTypes = defaultStepTypes, onStepDrag, className }: StepPaletteProps) {
  const [search, setSearch] = React.useState("");
  const [expandedCategory, setExpandedCategory] = React.useState<string | null>("Core");

  const filteredTypes = React.useMemo(() => {
    if (!search) return stepTypes;
    return stepTypes.filter(
      (st) =>
        st.label.toLowerCase().includes(search.toLowerCase()) ||
        st.description.toLowerCase().includes(search.toLowerCase())
    );
  }, [stepTypes, search]);

  const categories = React.useMemo(() => {
    const cats: Record<string, StepType[]> = {};
    filteredTypes.forEach((st) => {
      if (!cats[st.category]) cats[st.category] = [];
      cats[st.category].push(st);
    });
    return cats;
  }, [filteredTypes]);

  const handleDragStart = (e: React.DragEvent, stepType: string) => {
    e.dataTransfer.setData("stepType", stepType);
    e.dataTransfer.effectAllowed = "copy";
    onStepDrag?.(stepType);
  };

  return (
    <div className={cn("flex flex-col h-full bg-card border-l", className)}>
      <div className="p-3 border-b">
        <h3 className="text-sm font-semibold mb-2">Step Palette</h3>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search steps..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2">
          {Object.entries(categories).map(([category, steps]) => (
            <div key={category} className="mb-2">
              <button
                onClick={() =>
                  setExpandedCategory(expandedCategory === category ? null : category)
                }
                className="flex items-center justify-between w-full px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>{category}</span>
                <span className="text-[10px]">{steps.length}</span>
              </button>
              {expandedCategory === category && (
                <div className="space-y-1 mt-1">
                  {steps.map((step) => (
                    <TooltipWrapper key={step.type} content={step.description} side="right">
                      <div
                        draggable
                        onDragStart={(e) => handleDragStart(e, step.type)}
                        className="flex items-center gap-2 rounded-md px-2 py-2 cursor-grab active:cursor-grabbing hover:bg-accent transition-colors group"
                      >
                        <GripVertical className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        <span className="flex-shrink-0">{step.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{step.label}</p>
                        </div>
                      </div>
                    </TooltipWrapper>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export { StepPalette, type StepType, defaultStepTypes };
