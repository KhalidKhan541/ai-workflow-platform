"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft, Play, Pause, Settings, Activity, Clock, CheckCircle,
  AlertCircle, ChevronRight, Workflow, Copy, Trash2, Download,
  RefreshCw, Plus, MoreHorizontal, Zap, Bot,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, BadgeStatus } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRelativeTime, formatDate } from "@/lib/utils";

const workflowData: Record<string, {
  id: string; name: string; description: string; status: string;
  triggerType: string; tags: string[]; stepsCount: number;
  lastRun?: string; createdAt: string; updatedAt: string; successRate: number;
  steps: { id: string; name: string; type: string; status: string; duration?: number }[];
  executions: { id: string; status: string; startedAt: string; completedAt?: string; duration?: number }[];
  activityLog: { id: string; action: string; user: string; timestamp: string }[];
}> = {
  "1": {
    id: "1", name: "Email Campaign Automation", description: "Automated email sequences for marketing leads",
    status: "active", triggerType: "schedule", tags: ["marketing", "email"],
    stepsCount: 8, lastRun: new Date(Date.now() - 120000).toISOString(),
    createdAt: "2024-01-15", updatedAt: "2024-03-10", successRate: 99.2,
    steps: [
      { id: "s1", name: "Trigger: Schedule", type: "trigger", status: "success", duration: 0 },
      { id: "s2", name: "Fetch Leads", type: "action", status: "success", duration: 1200 },
      { id: "s3", name: "Filter Active", type: "condition", status: "success", duration: 50 },
      { id: "s4", name: "Generate Content (AI)", type: "ai", status: "success", duration: 3200 },
      { id: "s5", name: "Send Email", type: "action", status: "success", duration: 800 },
      { id: "s6", name: "Update CRM", type: "action", status: "success", duration: 450 },
      { id: "s7", name: "Wait 24h", type: "delay", status: "success", duration: 0 },
      { id: "s8", name: "Send Follow-up", type: "action", status: "success", duration: 900 },
    ],
    executions: [
      { id: "e1", status: "success", startedAt: new Date(Date.now() - 120000).toISOString(), completedAt: new Date(Date.now() - 60000).toISOString(), duration: 5400 },
      { id: "e2", status: "success", startedAt: new Date(Date.now() - 86400000).toISOString(), completedAt: new Date(Date.now() - 86340000).toISOString(), duration: 5200 },
      { id: "e3", status: "failed", startedAt: new Date(Date.now() - 172800000).toISOString(), completedAt: new Date(Date.now() - 172790000).toISOString(), duration: 10000 },
      { id: "e4", status: "success", startedAt: new Date(Date.now() - 259200000).toISOString(), completedAt: new Date(Date.now() - 259195000).toISOString(), duration: 5100 },
      { id: "e5", status: "success", startedAt: new Date(Date.now() - 345600000).toISOString(), completedAt: new Date(Date.now() - 345594000).toISOString(), duration: 6000 },
    ],
    activityLog: [
      { id: "a1", action: "Workflow executed successfully", user: "System", timestamp: new Date(Date.now() - 120000).toISOString() },
      { id: "a2", action: "Step 'Generate Content' updated", user: "John Doe", timestamp: new Date(Date.now() - 86400000).toISOString() },
      { id: "a3", action: "Workflow enabled", user: "John Doe", timestamp: new Date(Date.now() - 604800000).toISOString() },
      { id: "a4", action: "Webhook URL configured", user: "John Doe", timestamp: new Date(Date.now() - 1209600000).toISOString() },
    ],
  },
};

const stepIcons: Record<string, React.ElementType> = {
  trigger: Zap, action: Play, condition: ChevronRight, ai: Bot, delay: Clock, error: AlertCircle,
};

export default function WorkflowDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [loading, setLoading] = useState(true);
  const wf = workflowData[id] || workflowData["1"];

  React.useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]" role="status" aria-label="Loading workflow details">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Breadcrumb & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/workflows" className="p-2 hover:bg-accent rounded-lg transition-colors" aria-label="Back to workflows">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{wf.name}</h1>
              <BadgeStatus status={wf.status} />
            </div>
            <p className="text-muted-foreground mt-1">{wf.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm">
            <Copy className="h-4 w-4 mr-2" /> Duplicate
          </Button>
          <Link href={`/dashboard/workflows/${id}/builder`}>
            <Button size="sm">
              <Edit3Icon className="h-4 w-4 mr-2" /> Edit
            </Button>
          </Link>
          <Button size="sm" variant={wf.status === "active" ? "secondary" : "default"}>
            {wf.status === "active" ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            {wf.status === "active" ? "Pause" : "Activate"}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="steps">Steps</TabsTrigger>
          <TabsTrigger value="executions">Execution History</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Steps</p>
                <p className="text-2xl font-bold">{wf.stepsCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">{wf.successRate}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Total Executions</p>
                <p className="text-2xl font-bold">{wf.executions.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Trigger</p>
                <p className="text-2xl font-bold capitalize">{wf.triggerType}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Workflow Visual */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Workflow Steps</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {wf.steps.map((step, i) => {
                    const Icon = stepIcons[step.type] || Play;
                    return (
                      <div key={step.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 shrink-0">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{step.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{step.type}</p>
                        </div>
                        {step.duration !== undefined && (
                          <span className="text-xs text-muted-foreground">{step.duration}ms</span>
                        )}
                        <BadgeStatus status={step.status} />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Recent Executions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Executions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {wf.executions.map((ex) => (
                    <div key={ex.id} className="flex items-center gap-3 p-3 rounded-lg border">
                      {ex.status === "success" ? (
                        <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">Execution {ex.id}</p>
                        <p className="text-xs text-muted-foreground">{formatRelativeTime(ex.startedAt)}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{ex.duration}ms</span>
                      <BadgeStatus status={ex.status} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Steps Tab */}
        <TabsContent value="steps">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Step Configuration</CardTitle>
              <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Add Step</Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {wf.steps.map((step, i) => {
                  const Icon = stepIcons[step.type] || Play;
                  return (
                    <div key={step.id} className="flex items-center gap-4 p-4 rounded-lg border">
                      <span className="text-xs text-muted-foreground w-6">#{i + 1}</span>
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 shrink-0">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{step.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">Type: {step.type}</p>
                      </div>
                      {step.duration !== undefined && (
                        <span className="text-xs text-muted-foreground">{step.duration}ms</span>
                      )}
                      <BadgeStatus status={step.status} />
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Executions Tab */}
        <TabsContent value="executions">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Execution History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {wf.executions.map((ex) => (
                  <div key={ex.id} className="flex items-center gap-4 p-4 rounded-lg border">
                    {ex.status === "success" ? (
                      <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium">Execution {ex.id}</p>
                      <p className="text-xs text-muted-foreground">Started: {formatDate(ex.startedAt)}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">Duration: {ex.duration}ms</span>
                    <BadgeStatus status={ex.status} />
                    {ex.status === "failed" && (
                      <Button variant="outline" size="sm">
                        <RefreshCw className="h-3 w-3 mr-1" /> Retry
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity Log</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {wf.activityLog.map((log, i) => (
                  <div key={log.id} className="flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      <div className="h-3 w-3 rounded-full bg-primary" />
                      {i < wf.activityLog.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                    </div>
                    <div className="pb-4">
                      <p className="text-sm font-medium">{log.action}</p>
                      <p className="text-xs text-muted-foreground">by {log.user} &middot; {formatRelativeTime(log.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workflow Settings</CardTitle>
              <CardDescription>Configure your workflow settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium mb-2 block">Workflow Name</label>
                  <input type="text" defaultValue={wf.name} className="w-full h-10 rounded-md border px-3 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Description</label>
                  <input type="text" defaultValue={wf.description} className="w-full h-10 rounded-md border px-3 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {wf.tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}
                    <Button variant="outline" size="sm"><Plus className="h-3 w-3 mr-1" /> Add</Button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Status</label>
                  <BadgeStatus status={wf.status} />
                </div>
              </div>
              <div className="flex gap-3">
                <Button>Save Changes</Button>
                <Button variant="destructive">
                  <Trash2 className="h-4 w-4 mr-2" /> Delete Workflow
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Edit3Icon(props: React.SVGProps<SVGSVGElement>) {
  return <Edit3 {...props} />;
}
