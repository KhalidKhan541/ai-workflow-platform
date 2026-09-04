"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Plus, Search, Grid3X3, List, Filter, MoreHorizontal,
  Play, Pause, Trash2, Copy, Clock, CheckCircle, AlertCircle,
  Edit3, Tag, RefreshCw, ArrowUpDown, Workflow, SlidersHorizontal,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, BadgeStatus } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRelativeTime, type Workflow as WorkflowType, type TriggerType } from "@/lib/utils";

const mockWorkflows: WorkflowType[] = [
  { id: "1", name: "Email Campaign Automation", description: "Automated email sequences for marketing leads", status: "active", triggerType: "schedule", tags: ["marketing", "email"], stepsCount: 8, lastRun: new Date(Date.now() - 120000).toISOString(), createdAt: "2024-01-15", updatedAt: "2024-03-10", successRate: 99.2 },
  { id: "2", name: "Customer Onboarding", description: "Multi-step onboarding flow for new users", status: "active", triggerType: "event", tags: ["onboarding", "user"], stepsCount: 12, lastRun: new Date(Date.now() - 900000).toISOString(), createdAt: "2024-02-01", updatedAt: "2024-03-09", successRate: 97.8 },
  { id: "3", name: "Slack Alert System", description: "Monitor and alert via Slack on critical events", status: "error", triggerType: "webhook", tags: ["alerts", "slack"], stepsCount: 4, lastRun: new Date(Date.now() - 3600000).toISOString(), createdAt: "2024-01-20", updatedAt: "2024-03-08", successRate: 95.3 },
  { id: "4", name: "Data Sync Pipeline", description: "Bi-directional data sync between databases", status: "active", triggerType: "schedule", tags: ["data", "sync"], stepsCount: 6, lastRun: new Date(Date.now() - 1800000).toISOString(), createdAt: "2024-02-10", updatedAt: "2024-03-10", successRate: 98.5 },
  { id: "5", name: "Invoice Processing", description: "AI-powered invoice extraction and processing", status: "paused", triggerType: "manual", tags: ["finance", "ai"], stepsCount: 10, lastRun: new Date(Date.now() - 86400000).toISOString(), createdAt: "2024-01-25", updatedAt: "2024-03-05", successRate: 94.1 },
  { id: "6", name: "Social Media Scheduler", description: "Schedule and post content across platforms", status: "active", triggerType: "schedule", tags: ["social", "marketing"], stepsCount: 7, lastRun: new Date(Date.now() - 600000).toISOString(), createdAt: "2024-02-20", updatedAt: "2024-03-10", successRate: 99.8 },
  { id: "7", name: "Lead Scoring", description: "AI-based lead scoring and qualification", status: "draft", triggerType: "event", tags: ["leads", "ai"], stepsCount: 5, createdAt: "2024-03-01", updatedAt: "2024-03-08", successRate: 0 },
  { id: "8", name: "Deployment Pipeline", description: "CI/CD workflow with automated testing", status: "active", triggerType: "webhook", tags: ["devops", "ci-cd"], stepsCount: 14, lastRun: new Date(Date.now() - 300000).toISOString(), createdAt: "2024-01-10", updatedAt: "2024-03-10", successRate: 98.9 },
];

const allTags = [...new Set(mockWorkflows.flatMap((w) => w.tags))];
const triggerTypes: { value: string; label: string }[] = [
  { value: "all", label: "All Triggers" },
  { value: "manual", label: "Manual" },
  { value: "schedule", label: "Schedule" },
  { value: "webhook", label: "Webhook" },
  { value: "event", label: "Event" },
];

export default function WorkflowsPage() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [triggerFilter, setTriggerFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const filtered = useMemo(() => {
    return mockWorkflows.filter((w) => {
      const matchSearch = w.name.toLowerCase().includes(search.toLowerCase()) || w.description.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || w.status === statusFilter;
      const matchTrigger = triggerFilter === "all" || w.triggerType === triggerFilter;
      const matchTag = tagFilter === "all" || w.tags.includes(tagFilter);
      return matchSearch && matchStatus && matchTrigger && matchTag;
    });
  }, [search, statusFilter, triggerFilter, tagFilter]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => (prev.length === filtered.length ? [] : filtered.map((w) => w.id)));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]" role="status" aria-label="Loading workflows">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Workflows</h1>
          <p className="text-muted-foreground mt-1">{filtered.length} workflows total</p>
        </div>
        <Link href="/dashboard/workflows/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Workflow
          </Button>
        </Link>
      </div>

      {/* Filters Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search workflows..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                aria-label="Search workflows"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              aria-label="Filter by status"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="draft">Draft</option>
              <option value="error">Error</option>
            </select>
            <select
              value={triggerFilter}
              onChange={(e) => setTriggerFilter(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              aria-label="Filter by trigger type"
            >
              {triggerTypes.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              aria-label="Filter by tag"
            >
              <option value="all">All Tags</option>
              {allTags.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <div className="flex items-center gap-1 border rounded-md">
              <Button
                variant={view === "grid" ? "secondary" : "ghost"}
                size="icon"
                className="h-10 w-10"
                onClick={() => setView("grid")}
                aria-label="Grid view"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={view === "list" ? "secondary" : "ghost"}
                size="icon"
                className="h-10 w-10"
                onClick={() => setView("list")}
                aria-label="List view"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Bulk actions */}
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-3 mt-3 pt-3 border-t">
              <span className="text-sm text-muted-foreground">{selectedIds.length} selected</span>
              <Button variant="outline" size="sm">
                <Pause className="h-3 w-3 mr-1" /> Pause
              </Button>
              <Button variant="outline" size="sm">
                <Copy className="h-3 w-3 mr-1" /> Duplicate
              </Button>
              <Button variant="outline" size="sm" className="text-destructive">
                <Trash2 className="h-3 w-3 mr-1" /> Delete
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
                Clear selection
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grid View */}
      {view === "grid" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((wf) => (
            <Card key={wf.id} className={`hover:shadow-md transition-all ${selectedIds.includes(wf.id) ? "ring-2 ring-primary" : ""}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(wf.id)}
                      onChange={() => toggleSelect(wf.id)}
                      className="h-4 w-4 rounded border-gray-300"
                      aria-label={`Select ${wf.name}`}
                    />
                    <BadgeStatus status={wf.status} />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/dashboard/workflows/${wf.id}`}>Edit</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem>Duplicate</DropdownMenuItem>
                      <DropdownMenuItem>Export</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <Link href={`/dashboard/workflows/${wf.id}`} className="block group">
                  <CardTitle className="text-base group-hover:text-primary transition-colors">{wf.name}</CardTitle>
                </Link>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{wf.description}</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {wf.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Workflow className="h-3 w-3" /> {wf.stepsCount} steps
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {wf.lastRun ? formatRelativeTime(wf.lastRun) : "Never"}
                  </span>
                </div>
                {wf.successRate > 0 && (
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Success</span>
                    <div className="flex-1">
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${wf.successRate}%` }} />
                      </div>
                    </div>
                    <span className="font-medium">{wf.successRate}%</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* List View */}
      {view === "list" && (
        <Card>
          <CardContent className="p-0">
            <div className="border-b">
              <div className="grid grid-cols-[40px_1fr_100px_100px_120px_100px_60px] gap-4 items-center px-4 py-3 text-xs font-medium text-muted-foreground">
                <input type="checkbox" checked={selectedIds.length === filtered.length && filtered.length > 0} onChange={toggleSelectAll} className="h-4 w-4" aria-label="Select all" />
                <span>Name</span>
                <span>Status</span>
                <span>Trigger</span>
                <span>Last Run</span>
                <span>Success</span>
                <span></span>
              </div>
            </div>
            {filtered.map((wf) => (
              <div key={wf.id} className={`grid grid-cols-[40px_1fr_100px_100px_120px_100px_60px] gap-4 items-center px-4 py-3 border-b last:border-0 hover:bg-muted/50 transition-colors ${selectedIds.includes(wf.id) ? "bg-primary/5" : ""}`}>
                <input type="checkbox" checked={selectedIds.includes(wf.id)} onChange={() => toggleSelect(wf.id)} className="h-4 w-4" aria-label={`Select ${wf.name}`} />
                <div className="min-w-0">
                  <Link href={`/dashboard/workflows/${wf.id}`} className="text-sm font-medium hover:text-primary transition-colors truncate block">
                    {wf.name}
                  </Link>
                  <p className="text-xs text-muted-foreground truncate">{wf.description}</p>
                </div>
                <BadgeStatus status={wf.status} />
                <span className="text-xs capitalize">{wf.triggerType}</span>
                <span className="text-xs text-muted-foreground">{wf.lastRun ? formatRelativeTime(wf.lastRun) : "Never"}</span>
                <span className="text-xs font-medium">{wf.successRate > 0 ? `${wf.successRate}%` : "—"}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/dashboard/workflows/${wf.id}`}>View</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>Duplicate</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {filtered.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Workflow className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No workflows found</h3>
            <p className="text-sm text-muted-foreground mb-4">Try adjusting your filters or create a new workflow</p>
            <Link href="/dashboard/workflows/new">
              <Button><Plus className="h-4 w-4 mr-2" /> Create Workflow</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
