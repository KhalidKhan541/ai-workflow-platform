import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
    label?: string;
  };
  delta?: {
    value: number;
    isPositive: boolean;
    label?: string;
  };
  format?: "number" | "currency" | "percent" | "bytes" | "duration";
  prefix?: string;
  suffix?: string;
  loading?: boolean;
  className?: string;
}

function formatValue(value: string | number, format?: string, prefix?: string, suffix?: string): string {
  let formatted = String(value);

  switch (format) {
    case "number":
      formatted = new Intl.NumberFormat("en-US").format(Number(value));
      break;
    case "currency":
      formatted = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value));
      break;
    case "percent":
      formatted = `${Number(value).toFixed(1)}%`;
      break;
    case "bytes": {
      const bytes = Number(value);
      if (bytes < 1024) formatted = `${bytes} B`;
      else if (bytes < 1024 * 1024) formatted = `${(bytes / 1024).toFixed(1)} KB`;
      else if (bytes < 1024 * 1024 * 1024) formatted = `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      else formatted = `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
      break;
    }
    case "duration": {
      const ms = Number(value);
      if (ms < 1000) formatted = `${ms}ms`;
      else if (ms < 60000) formatted = `${(ms / 1000).toFixed(1)}s`;
      else formatted = `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
      break;
    }
  }

  if (prefix) formatted = `${prefix}${formatted}`;
  if (suffix) formatted = `${formatted}${suffix}`;
  return formatted;
}

function StatCard({
  title,
  value,
  description,
  icon,
  trend,
  delta,
  format,
  prefix,
  suffix,
  loading = false,
  className,
}: StatCardProps) {
  const trendData = trend || delta;

  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {loading ? (
              <div className="h-8 w-24 animate-pulse rounded bg-muted" />
            ) : (
              <p className="text-2xl font-bold tracking-tight">
                {formatValue(value, format, prefix, suffix)}
              </p>
            )}
            {description && !trendData && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {icon && (
            <div className="rounded-lg bg-primary/10 p-2 text-primary">{icon}</div>
          )}
        </div>
        {trendData && (
          <div className="flex items-center gap-1 mt-3">
            {trendData.isPositive ? (
              <TrendingUp className="h-3 w-3 text-success" />
            ) : trendData.value === 0 ? (
              <Minus className="h-3 w-3 text-muted-foreground" />
            ) : (
              <TrendingDown className="h-3 w-3 text-destructive" />
            )}
            <span
              className={cn(
                "text-xs font-medium",
                trendData.isPositive ? "text-success" : trendData.value === 0 ? "text-muted-foreground" : "text-destructive"
              )}
            >
              {trendData.isPositive ? "+" : ""}
              {trendData.value}%
            </span>
            {trendData.label && (
              <span className="text-xs text-muted-foreground">{trendData.label}</span>
            )}
            {description && trendData && (
              <span className="text-xs text-muted-foreground ml-1">{description}</span>
            )}
          </div>
        )}
        {/* Decorative background gradient */}
        <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/5 blur-2xl" />
      </CardContent>
    </Card>
  );
}

interface StatGridProps {
  stats: StatCardProps[];
  columns?: 2 | 3 | 4;
  className?: string;
}

function StatGrid({ stats, columns = 4, className }: StatGridProps) {
  const gridCols = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div className={cn("grid gap-4", gridCols[columns], className)}>
      {stats.map((stat, i) => (
        <StatCard key={i} {...stat} />
      ))}
    </div>
  );
}

interface MiniStatProps {
  label: string;
  value: string | number;
  change?: number;
  className?: string;
}

function MiniStat({ label, value, change, className }: MiniStatProps) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{value}</span>
        {change !== undefined && (
          <span
            className={cn(
              "text-xs font-medium",
              change > 0 ? "text-success" : change < 0 ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {change > 0 ? "+" : ""}{change}%
          </span>
        )}
      </div>
    </div>
  );
}

export { StatCard, StatGrid, MiniStat };
