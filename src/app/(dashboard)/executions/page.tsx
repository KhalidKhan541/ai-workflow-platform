"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  RefreshCw, Search, Filter, ChevronDown, ChevronRight, CheckCircle,
  AlertCircle, Clock, Play, XCircle, Loader2, ArrowUpDown, Download,
  RotateCcw, Eye, MoreHorizontal, Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, BadgeStatus } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRelativeTime, formatDate, type ExecutionStatus } from "@/lib/utils";

const mockExecutions = [
  { id: "exec-001", workflowId: "1", workflowName: "Email Campaign Automation", status: "success" as ExecutionStatus, startedAt: new Date(Date.now() - 120000).toISOString(), completedAt: new Date(Date.now() - 60000).toISOString(), duration: 5400, triggerType: "schedule", logs: ["Fetching leads...", "AI generating content...", "Sending emails...", "Completed successfully"] },
  { id: "exec-002", workflowId: "2", workflowName: "Customer Onboarding", status: "running" as ExecutionStatus, startedAt: new Date(Date.now() - 30000).toISOString(), triggerType: "event", logs: ["Triggered by new signup", "Creating user profile...", "Sending welcome email..."] },
  { id: "exec-003", workflowId: "3", workflowName: "Slack Alert System", status: "failed" as ExecutionStatus, startedAt: new Date(Date.now() - 3600000).toISOString(), completedAt: new Date(Date.now() - 3590000).toISOString(), duration: 10000, triggerType: "webhook", error: "Authentication failed: Invalid API token", logs: ["Received webhook event", "Processing alert...", "ERROR: Authentication failed"] },
  { id: "exec-004", workflowId: "4", workflowName: "Data Sync Pipeline", status: "success" as ExecutionStatus, startedAt: new Date(Date.now() - 1800000).toISOString(), completedAt: new Date(Date.now() - 1795000).toISOString(), duration: 5000, triggerType: "schedule", logs: ["Starting data sync...", "Syncing 1,200 records...", "Sync complete"] },
  { id: "exec-005", workflowId: "1", workflowName: "Email Campaign Automation", status: "pending" as ExecutionStatus, startedAt: new Date(Date.now() - 60000).toISOString(), triggerType: "manual", logs: ["Queued for execution..."] },
  { id: "exec-006", workflowId: "6", workflowName: "Social Media Scheduler", status: "success" as ExecutionStatus, startedAt: new Date(Date.now() - 7200000).toISOString(), completedAt: new Date(Date.now() - 7195000).toISOString(), duration: 5000, triggerType: "schedule", logs: ["Loading scheduled posts...", "Publishing to Twitter...", "Publishing to LinkedIn...", "Done"] },
  { id: "exec-007", workflowId: "5", workflowName: "Invoice Processing", status: "cancelled" as ExecutionStatus, startedAt: new Date(Date.now() - 86400000).toISOString(), triggerType: "manual", logs: ["Execution cancelled by user"] },
  { id: "exec-008", workflowId: "8", workflowName: "Deployment Pipeline", status: "success" as ExecutionStatus, startedAt: new Date(Date.now() - 300000).toISOString(), completedAt: new Date(Date.now() - 240000).toISOString(), duration: 60000, triggerType: "webhook", logs: ["Running tests...", "Building...", "Deploying to staging...", "Deployment successful"] },
];

const statusIcons: Record<string, React.ElementType> = {
  success: CheckCircle, failed: XCircle, running: Loader2, pending: Clock, cancelled: AlertCircle,
};
const statusColors: Record<string, string> = {
  success: "text-green-500", failed: "text-red-500", running: "text-blue-500", pending: "text-yellow-500", cancelled: "text-orange-500",
};

export default function ExecutionsPage() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [workflowFilter, setWorkflowFilter] = useState("all");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [executions, setExecutions] = useState(mockExecutions);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setExecutions((prev) =>
        prev.map((ex) => {
          if (ex.status === "running" && Math.random() > 0.7) {
            return { ...ex, status: "success", completedAt: new Date().toISOString(), duration: Math.floor(Math.random() * 10000) + 1000 };
          }
          return ex;
        })
      );
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const workflows = [...new Set(executions.map((e) => e.workflowName))];

  const filtered = useMemo(() => {
    return executions.filter((e) => {
      const matchSearch = e.workflowName.toLowerCase().includes(search.toLowerCase()) || e.id.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || e.status === statusFilter;
      const matchWorkflow = workflowFilter === "all" || e.workflowName === workflowFilter;
      return matchSearch && matchStatus && matchWorkflow;
    });
  }, [search, statusFilter, workflowFilter, executions]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: executions.length, success: 0, running: 0, failed: 0, pending: 0, cancelled: 0 };
    executions.forEach((e) => { if (counts[e.status] !== undefined) counts[e.status]++; });
    return counts;
  }, [executions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]" role="status" aria-label="Loading executions">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Executions</h1>
          <p className="text-muted-foreground mt-1">Monitor and manage workflow executions in real-time</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {(["success", "running", "failed", "pending", "cancelled"] as const).map((status) => {
          const Icon = statusIcons[status];
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(statusFilter === status ? "all" : status)}
              className={`p-4 rounded-lg border text-left transition-all ${statusFilter === status ? "bg-primary/10 border-primary" : "hover:bg-muted/50"}`}
              aria-label={`Filter by ${status}: ${statusCounts[status]} executions`}
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className={`h-5 w-5 ${statusColors[status]} ${status === "running" ? "animate-spin" : ""}`} />
                <span className="text-2xl font-bold">{statusCounts[status]}</span>
              </div>
              <p className="text-xs text-muted-foreground capitalize">{status}</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by workflow name or execution ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" aria-label="Search executions" />
            </div>
            <select value={workflowFilter} onChange={(e) => setWorkflowFilter(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm" aria-label="Filter by workflow">
              <option value="all">All Workflows</option>
              {workflows.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Executions List */}
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {filtered.map((ex) => {
              const Icon = statusIcons[ex.status];
              const isExpanded = expandedRow === ex.id;
              return (
                <div key={ex.id}>
                  <button
                    className="w-full flex items-center gap-4 px-4 py-4 text-left hover:bg-muted/50 transition-colors"
                    onClick={() => setExpandedRow(isExpanded ? null : ex.id)}
                    aria-expanded={isExpanded}
                    aria-label={`${ex.workflowName} execution ${ex.id} - ${ex.status}`}
                  >
                    <Icon className={`h-5 w-5 shrink-0 ${statusColors[ex.status]} ${ex.status === "running" ? "animate-spin" : ""}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{ex.workflowName}</p>
                      <p className="text-xs text-muted-foreground">{ex.id}</p>
                    </div>
                    <div className="hidden md:flex items-center gap-6 text-xs text-muted-foreground shrink-0">
                      <span className="capitalize">{ex.triggerType}</span>
                      <span>{formatRelativeTime(ex.startedAt)}</span>
                      {ex.duration && <span>{ex.duration}ms</span>}
                    </div>
                    <BadgeStatus status={ex.status} />
                    {ex.status === "failed" && (
                      <Button variant="outline" size="sm" className="shrink-0" onClick={(e) => { e.stopPropagation(); }}>
                        <RotateCcw className="h-3 w-3 mr-1" /> Retry
                      </Button>
                    )}
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t bg-muted/30 animate-in fade-in duration-200">
                      <div className="grid md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Started</p>
                          <p className="text-sm">{formatDate(ex.startedAt)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Completed</p>
                          <p className="text-sm">{ex.completedAt ? formatDate(ex.completedAt) : "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Duration</p>
                          <p className="text-sm">{ex.duration ? `${ex.duration}ms` : "—"}</p>
                        </div>
                      </div>
                      {ex.error && (
                        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
                          <p className="text-sm text-red-700 dark:text-red-400 font-medium mb-1">Error</p>
                          <p className="text-sm text-red-600 dark:text-red-300">{ex.error}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Execution Logs</p>
                        <div className="bg-background rounded-lg border p-3 font-mono text-xs space-y-1">
                          {ex.logs.map((log, i) => (
                            <div key={i} className="flex gap-2">
                              <span className="text-muted-foreground shrink-0">[{String(i + 1).padStart(2, "0")}]</span>
                              <span className={log.startsWith("ERROR") ? "text-red-500" : ""}>{log}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No executions found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
