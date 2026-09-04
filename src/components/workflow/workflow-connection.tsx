import * as React from "react";
import { cn } from "@/lib/utils";

interface WorkflowConnectionProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
  animated?: boolean;
  onRemove?: () => void;
  className?: string;
}

function WorkflowConnection({
  from,
  to,
  animated = false,
  onRemove,
  className,
}: WorkflowConnectionProps) {
  const [hovered, setHovered] = React.useState(false);

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const midX = from.x + dx / 2;

  const path = `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;

  return (
    <g
      className={cn("pointer-events-auto", className)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <path
        d={path}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        markerEnd="url(#arrowhead)"
        className={cn(
          "transition-all",
          hovered && "stroke-destructive"
        )}
        style={animated ? {
          strokeDasharray: "8,4",
          animation: "flow 1s linear infinite",
        } : undefined}
      />
      {hovered && onRemove && (
        <>
          <circle
            cx={from.x + dx / 2}
            cy={from.y + dy / 2}
            r="10"
            className="fill-destructive cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          />
          <text
            x={from.x + dx / 2}
            y={from.y + dy / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-white text-xs pointer-events-none"
          >
            ×
          </text>
        </>
      )}
    </g>
  );
}

interface WorkflowConnectionLineProps {
  points: { x: number; y: number }[];
  color?: string;
  animated?: boolean;
  className?: string;
}

function WorkflowConnectionLine({
  points,
  color = "hsl(var(--primary))",
  animated = false,
  className,
}: WorkflowConnectionLineProps) {
  if (points.length < 2) return null;

  const pathData = points.reduce((acc, point, i) => {
    if (i === 0) return `M ${point.x} ${point.y}`;
    const prev = points[i - 1];
    const cpx1 = prev.x + (point.x - prev.x) / 2;
    const cpy1 = prev.y;
    const cpx2 = prev.x + (point.x - prev.x) / 2;
    const cpy2 = point.y;
    return `${acc} C ${cpx1} ${cpy1}, ${cpx2} ${cpy2}, ${point.x} ${point.y}`;
  }, "");

  return (
    <g className={cn("pointer-events-none", className)}>
      <path
        d={pathData}
        fill="none"
        stroke={color}
        strokeWidth="2"
        markerEnd="url(#arrowhead)"
        style={animated ? {
          strokeDasharray: "8,4",
          animation: "flow 1s linear infinite",
        } : undefined}
      />
    </g>
  );
}

export { WorkflowConnection, WorkflowConnectionLine };
