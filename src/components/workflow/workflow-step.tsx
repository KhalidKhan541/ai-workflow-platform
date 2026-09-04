import * as React from "react";
import { cn } from "@/lib/utils";
import { WorkflowStep as WorkflowStepType } from "@/hooks/use-workflow-builder";
import { GripVertical, Link, MoreHorizontal, Trash2, Copy, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown";

interface WorkflowStepNodeProps {
  step: WorkflowStepType;
  selected?: boolean;
  onMouseDown?: (e: React.MouseEvent) => void;
  onConnect?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onConfigure?: () => void;
  readOnly?: boolean;
  className?: string;
}

const stepTypeStyles: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  trigger: { color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", icon: "⚡" },
  action: { color: "text-green-600", bg: "bg-green-50", border: "border-green-200", icon: "⚙️" },
  condition: { color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-200", icon: "🔀" },
  delay: { color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200", icon: "⏰" },
  webhook: { color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200", icon: "🔗" },
  ai: { color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200", icon: "🤖" },
  email: { color: "text-cyan-600", bg: "bg-cyan-50", border: "border-cyan-200", icon: "📧" },
  database: { color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", icon: "🗄️" },
  http: { color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200", icon: "🌐" },
  transform: { color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200", icon: "🔄" },
};

function WorkflowStepNode({
  step,
  selected,
  onMouseDown,
  onConnect,
  onDuplicate,
  onDelete,
  onConfigure,
  readOnly = false,
  className,
}: WorkflowStepNodeProps) {
  const styles = stepTypeStyles[step.type] || stepTypeStyles.action;

  return (
    <div
      className={cn(
        "absolute select-none",
        className
      )}
      style={{ left: step.x, top: step.y }}
    >
      <div
        className={cn(
          "relative w-[200px] rounded-lg border-2 bg-card shadow-sm transition-shadow hover:shadow-md",
          styles.border,
          selected && "ring-2 ring-primary ring-offset-2",
          readOnly ? "cursor-default" : "cursor-move"
        )}
        onMouseDown={onMouseDown}
      >
        <div className={cn("flex items-center gap-2 rounded-t-[6px] px-3 py-2", styles.bg)}>
          <span className="text-lg">{styles.icon}</span>
          <div className="flex-1 min-w-0">
            <p className={cn("text-xs font-medium uppercase", styles.color)}>
              {step.type}
            </p>
          </div>
          {!readOnly && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="h-6 w-6" onClick={(e) => e.stopPropagation()}>
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onConfigure}>
                  <Settings className="h-4 w-4 mr-2" /> Configure
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDuplicate}>
                  <Copy className="h-4 w-4 mr-2" /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className="px-3 py-2.5">
          <p className="text-sm font-medium truncate">{step.name}</p>
          {step.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {step.description}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between border-t px-3 py-1.5">
          <span className="text-[10px] text-muted-foreground">
            {step.status === "running" ? "Running..." : step.status === "completed" ? "Completed" : "Ready"}
          </span>
          {!readOnly && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onConnect?.();
              }}
              className="rounded p-0.5 hover:bg-muted transition-colors"
              title="Connect to next step"
            >
              <Link className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>
        {/* Connection points */}
        <div className="absolute -left-2 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-2 border-primary bg-background" />
        <div className="absolute -right-2 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-2 border-primary bg-background" />
      </div>
    </div>
  );
}

export { WorkflowStepNode, stepTypeStyles };
