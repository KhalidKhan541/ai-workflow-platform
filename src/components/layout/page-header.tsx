import * as React from "react";
import { cn } from "@/lib/utils";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
  backLink?: { href: string; label?: string };
  className?: string;
}

function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  backLink,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb items={breadcrumbs} />
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          {backLink && (
            <a
              href={backLink.href}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
            >
              ← {backLink.label || "Back"}
            </a>
          )}
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

interface PageHeaderTabProps {
  tabs: {
    label: string;
    value: string;
    icon?: React.ReactNode;
    count?: number;
  }[];
  activeTab: string;
  onTabChange: (value: string) => void;
  className?: string;
}

function PageHeaderTab({ tabs, activeTab, onTabChange, className }: PageHeaderTabProps) {
  return (
    <div className={cn("flex items-center gap-1 border-b -mb-px", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onTabChange(tab.value)}
          className={cn(
            "inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
            activeTab === tab.value
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          )}
        >
          {tab.icon}
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                activeTab === tab.value
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export { PageHeader, PageHeaderTab };
