import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
  [key: string]: unknown;
}

interface BaseChartProps {
  data: ChartDataPoint[];
  title?: string;
  description?: string;
  height?: number;
  className?: string;
}

interface BarChartProps extends BaseChartProps {
  orientation?: "horizontal" | "vertical";
  showValues?: boolean;
  showGrid?: boolean;
  maxValue?: number;
  barClassName?: string;
}

function BarChart({
  data,
  title,
  description,
  height = 200,
  orientation = "vertical",
  showValues = true,
  showGrid = true,
  maxValue,
  barClassName,
  className,
}: BarChartProps) {
  const max = maxValue || Math.max(...data.map((d) => d.value), 1);
  const defaultColors = [
    "bg-primary",
    "bg-success",
    "bg-warning",
    "bg-destructive",
    "bg-info",
    "bg-purple-500",
    "bg-pink-500",
    "bg-orange-500",
  ];

  return (
    <Card className={className}>
      {title && (
        <CardHeader>
          <CardTitle className="text-sm">{title}</CardTitle>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardHeader>
      )}
      <CardContent>
        <div
          className={cn(
            "relative",
            orientation === "vertical" ? "space-y-2" : "flex items-end gap-2"
          )}
          style={{ height }}
        >
          {showGrid && orientation === "vertical" && (
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="border-t border-border/50 w-full" />
              ))}
            </div>
          )}
          {data.map((item, index) => {
            const percentage = (item.value / max) * 100;
            const color = item.color || defaultColors[index % defaultColors.length];

            if (orientation === "horizontal") {
              return (
                <div key={index} className="flex-1 flex flex-col items-center gap-1">
                  {showValues && (
                    <span className="text-[10px] font-medium">{item.value}</span>
                  )}
                  <div
                    className={cn("w-full rounded-t transition-all", color, barClassName)}
                    style={{ height: `${percentage}%` }}
                  />
                  <span className="text-[10px] text-muted-foreground truncate max-w-full">
                    {item.label}
                  </span>
                </div>
              );
            }

            return (
              <div key={index} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-20 text-right truncate shrink-0">
                  {item.label}
                </span>
                <div className="flex-1 relative">
                  <div className="h-6 rounded bg-muted/30" />
                  <div
                    className={cn(
                      "absolute inset-y-0 left-0 rounded transition-all",
                      color,
                      barClassName
                    )}
                    style={{ width: `${percentage}%` }}
                  />
                  {showValues && (
                    <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] font-medium">
                      {item.value}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

interface LineChartProps extends BaseChartProps {
  showDots?: boolean;
  showGrid?: boolean;
  smooth?: boolean;
  lineColor?: string;
  fillColor?: string;
}

function LineChart({
  data,
  title,
  description,
  height = 200,
  showDots = true,
  showGrid = true,
  smooth = false,
  lineColor = "hsl(var(--primary))",
  fillColor = "hsl(var(--primary) / 0.1)",
  className,
}: LineChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const padding = 40;
  const chartWidth = 600;
  const chartHeight = height - padding * 2;

  const points = data.map((item, index) => ({
    x: padding + (index / (data.length - 1 || 1)) * (chartWidth - padding * 2),
    y: padding + chartHeight - (item.value / max) * chartHeight,
  }));

  const pathD = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const areaD = `${pathD} L ${points[points.length - 1]?.x || 0} ${padding + chartHeight} L ${padding} ${padding + chartHeight} Z`;

  return (
    <Card className={className}>
      {title && (
        <CardHeader>
          <CardTitle className="text-sm">{title}</CardTitle>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardHeader>
      )}
      <CardContent>
        <svg viewBox={`0 0 ${chartWidth} ${height}`} className="w-full" style={{ height }}>
          {showGrid && (
            <g className="stroke-border/50" strokeWidth="1">
              {[...Array(5)].map((_, i) => {
                const y = padding + (i / 4) * chartHeight;
                return <line key={i} x1={padding} y1={y} x2={chartWidth - padding} y2={y} />;
              })}
            </g>
          )}
          <path d={areaD} fill={fillColor} />
          <path d={pathD} fill="none" stroke={lineColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {showDots && points.map((point, i) => (
            <circle key={i} cx={point.x} cy={point.y} r="4" fill={lineColor} stroke="white" strokeWidth="2" />
          ))}
          {points.map((point, i) => (
            <text key={i} x={point.x} y={padding + chartHeight + 16} textAnchor="middle" className="fill-muted-foreground text-[10px]">
              {data[i]?.label}
            </text>
          ))}
        </svg>
      </CardContent>
    </Card>
  );
}

interface PieChartProps extends BaseChartProps {
  innerRadius?: number;
  showLabels?: boolean;
  showLegend?: boolean;
}

function PieChart({
  data,
  title,
  description,
  height = 200,
  innerRadius = 0,
  showLabels = true,
  showLegend = true,
  className,
}: PieChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const defaultColors = [
    "hsl(221.2, 83.2%, 53.3%)",
    "hsl(142, 76%, 36%)",
    "hsl(38, 92%, 50%)",
    "hsl(0, 84.2%, 60.2%)",
    "hsl(199, 89%, 48%)",
    "hsl(270, 60%, 50%)",
    "hsl(330, 70%, 50%)",
    "hsl(25, 85%, 55%)",
  ];

  let currentAngle = -90;

  const slices = data.map((item, index) => {
    const percentage = (item.value / total) * 100;
    const angle = (item.value / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const x1 = 100 + 80 * Math.cos(startRad);
    const y1 = 100 + 80 * Math.sin(startRad);
    const x2 = 100 + 80 * Math.cos(endRad);
    const y2 = 100 + 80 * Math.sin(endRad);
    const largeArc = angle > 180 ? 1 : 0;

    let pathD: string;
    if (innerRadius > 0) {
      const ix1 = 100 + innerRadius * Math.cos(startRad);
      const iy1 = 100 + innerRadius * Math.sin(startRad);
      const ix2 = 100 + innerRadius * Math.cos(endRad);
      const iy2 = 100 + innerRadius * Math.sin(endRad);
      pathD = `M ${x1} ${y1} A 80 80 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1} Z`;
    } else {
      pathD = `M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArc} 1 ${x2} ${y2} Z`;
    }

    return {
      path: pathD,
      color: item.color || defaultColors[index % defaultColors.length],
      label: item.label,
      value: item.value,
      percentage,
    };
  });

  return (
    <Card className={className}>
      {title && (
        <CardHeader>
          <CardTitle className="text-sm">{title}</CardTitle>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardHeader>
      )}
      <CardContent>
        <div className="flex items-center gap-4">
          <svg viewBox="0 0 200 200" className="shrink-0" style={{ height }}>
            {slices.map((slice, i) => (
              <path key={i} d={slice.path} fill={slice.color} className="hover:opacity-80 transition-opacity" />
            ))}
            {innerRadius > 0 && (
              <text x="100" y="100" textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-lg font-bold">
                {total}
              </text>
            )}
          </svg>
          {showLegend && (
            <div className="space-y-1.5">
              {slices.map((slice, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: slice.color }} />
                  <span className="text-muted-foreground">{slice.label}</span>
                  <span className="font-medium ml-auto">{slice.percentage.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface AreaChartProps extends LineChartProps {}

function AreaChart({
  data,
  title,
  description,
  height = 200,
  showDots = false,
  showGrid = true,
  lineColor = "hsl(var(--primary))",
  fillColor = "hsl(var(--primary) / 0.2)",
  className,
}: AreaChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const padding = 40;
  const chartWidth = 600;
  const chartHeight = height - padding * 2;

  const points = data.map((item, index) => ({
    x: padding + (index / (data.length - 1 || 1)) * (chartWidth - padding * 2),
    y: padding + chartHeight - (item.value / max) * chartHeight,
  }));

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const areaPath = `${linePath} L ${points[points.length - 1]?.x || 0} ${padding + chartHeight} L ${padding} ${padding + chartHeight} Z`;

  return (
    <Card className={className}>
      {title && (
        <CardHeader>
          <CardTitle className="text-sm">{title}</CardTitle>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardHeader>
      )}
      <CardContent>
        <svg viewBox={`0 0 ${chartWidth} ${height}`} className="w-full" style={{ height }}>
          {showGrid && (
            <g className="stroke-border/50" strokeWidth="1">
              {[...Array(5)].map((_, i) => {
                const y = padding + (i / 4) * chartHeight;
                return <line key={i} x1={padding} y1={y} x2={chartWidth - padding} y2={y} />;
              })}
            </g>
          )}
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#areaGrad)" />
          <path d={linePath} fill="none" stroke={lineColor} strokeWidth="2" />
          {showDots && points.map((point, i) => (
            <circle key={i} cx={point.x} cy={point.y} r="3" fill={lineColor} />
          ))}
        </svg>
      </CardContent>
    </Card>
  );
}

export { BarChart, LineChart, PieChart, AreaChart, type ChartDataPoint };
