import * as React from "react";
import { cn } from "@/lib/utils";
import { useWorkflowBuilder, WorkflowStep as WorkflowStepType } from "@/hooks/use-workflow-builder";
import { WorkflowStep } from "./workflow-step";
import { WorkflowConnection } from "./workflow-connection";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize, Undo2, Redo2, Trash2 } from "lucide-react";
import { TooltipWrapper } from "@/components/ui/tooltip";

interface WorkflowCanvasProps {
  steps: WorkflowStepType[];
  connections: { from: string; to: string }[];
  selectedStepId?: string | null;
  onStepSelect?: (stepId: string | null) => void;
  onStepMove?: (stepId: string, x: number, y: number) => void;
  onStepAdd?: (stepType: string, x: number, y: number) => void;
  onConnectionAdd?: (from: string, to: string) => void;
  onConnectionRemove?: (from: string, to: string) => void;
  readOnly?: boolean;
  className?: string;
}

function WorkflowCanvas({
  steps,
  connections,
  selectedStepId,
  onStepSelect,
  onStepMove,
  onStepAdd,
  onConnectionAdd,
  onConnectionRemove,
  readOnly = false,
  className,
}: WorkflowCanvasProps) {
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = React.useState(false);
  const [panStart, setPanStart] = React.useState({ x: 0, y: 0 });
  const [dragStep, setDragStep] = React.useState<string | null>(null);
  const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 });
  const [connecting, setConnecting] = React.useState<{ from: string; mousePos: { x: number; y: number } } | null>(null);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (readOnly) return;
    if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains("canvas-bg")) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      onStepSelect?.(null);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
    if (dragStep && onStepMove) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const x = (e.clientX - rect.left - pan.x) / zoom - dragOffset.x;
        const y = (e.clientY - rect.top - pan.y) / zoom - dragOffset.y;
        onStepMove(dragStep, Math.round(x), Math.round(y));
      }
    }
    if (connecting) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        setConnecting({
          ...connecting,
          mousePos: {
            x: (e.clientX - rect.left - pan.x) / zoom,
            y: (e.clientY - rect.top - pan.y) / zoom,
          },
        });
      }
    }
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
    setDragStep(null);
    if (connecting) {
      setConnecting(null);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.min(Math.max(z + delta, 0.25), 2));
  };

  const handleStepMouseDown = (stepId: string, e: React.MouseEvent) => {
    if (readOnly) return;
    e.stopPropagation();
    const step = steps.find((s) => s.id === stepId);
    if (!step) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const x = (e.clientX - rect.left - pan.x) / zoom;
      const y = (e.clientY - rect.top - pan.y) / zoom;
      setDragOffset({ x: x - step.x, y: y - step.y });
      setDragStep(stepId);
    }
    onStepSelect?.(stepId);
  };

  const handleStepConnect = (stepId: string) => {
    if (readOnly) return;
    setConnecting({ from: stepId, mousePos: { x: 0, y: 0 } });
  };

  const handleDrop = (e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    const stepType = e.dataTransfer.getData("stepType");
    if (!stepType || !onStepAdd) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const x = (e.clientX - rect.left - pan.x) / zoom;
      const y = (e.clientY - rect.top - pan.y) / zoom;
      onStepAdd(stepType, Math.round(x), Math.round(y));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  return (
    <div className="relative flex flex-col h-full overflow-hidden rounded-lg border bg-background">
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-card border rounded-md p-1 shadow-sm">
        <TooltipWrapper content="Zoom in">
          <Button variant="ghost" size="icon-sm" onClick={() => setZoom((z) => Math.min(z + 0.1, 2))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </TooltipWrapper>
        <span className="text-xs text-muted-foreground px-1 min-w-[3rem] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <TooltipWrapper content="Zoom out">
          <Button variant="ghost" size="icon-sm" onClick={() => setZoom((z) => Math.max(z - 0.1, 0.25))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
        </TooltipWrapper>
        <TooltipWrapper content="Reset view">
          <Button variant="ghost" size="icon-sm" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>
            <Maximize className="h-4 w-4" />
          </Button>
        </TooltipWrapper>
      </div>
      <div
        ref={canvasRef}
        className={cn(
          "flex-1 overflow-hidden cursor-grab active:cursor-grabbing",
          className
        )}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
        onWheel={handleWheel}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <div className="canvas-bg absolute inset-0" />
        <svg className="absolute inset-0 h-full w-full pointer-events-none">
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--primary))" />
            </marker>
          </defs>
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {connections.map((conn) => {
              const fromStep = steps.find((s) => s.id === conn.from);
              const toStep = steps.find((s) => s.id === conn.to);
              if (!fromStep || !toStep) return null;
              return (
                <WorkflowConnection
                  key={`${conn.from}-${conn.to}`}
                  from={{ x: fromStep.x + 100, y: fromStep.y + 40 }}
                  to={{ x: toStep.x, y: toStep.y + 40 }}
                  onRemove={() => onConnectionRemove?.(conn.from, conn.to)}
                />
              );
            })}
            {connecting && (
              <line
                x1={connecting.from ? steps.find((s) => s.id === connecting.from)?.x! + 100 : 0}
                y1={connecting.from ? steps.find((s) => s.id === connecting.from)?.y! + 40 : 0}
                x2={connecting.mousePos.x}
                y2={connecting.mousePos.y}
                stroke="hsl(var(--primary))"
                strokeWidth="2"
                strokeDasharray="5,5"
                markerEnd="url(#arrowhead)"
              />
            )}
          </g>
        </svg>
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
          {steps.map((step) => (
            <WorkflowStep
              key={step.id}
              step={step}
              selected={step.id === selectedStepId}
              onMouseDown={(e) => handleStepMouseDown(step.id, e)}
              onConnect={() => handleStepConnect(step.id)}
              readOnly={readOnly}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export { WorkflowCanvas };
