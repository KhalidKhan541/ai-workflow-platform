"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Workflow, Play, CheckCircle, Bot, TrendingUp, TrendingDown,
  Plus, ArrowRight, Clock, AlertCircle, Activity, Zap,
  BarChart3, MoreHorizontal, RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, BadgeStatus } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatRelativeTime } from "@/lib/utils";

const statsCards = [
  { title: "Active Workflows", value: "24", change: "+3", trend: "up", icon: Workflow, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950" },
  { title: "Total Executions", value: "12,847", change: "+1,240", trend: "up", icon: Play, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950" },
  { title: "Success Rate", value: "98.7%", change: "+0.3%", trend: "up", icon: CheckCircle, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950" },
  { title: "AI Actions", value: "3,421", change: "-120", trend: "down", icon: Bot, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950" },
];

const recentActivity = [
  { id: "1", type: "success", message: "Email Campaign workflow completed", time: "2m ago", icon: CheckCircle },
  { id: "2", type: "error", message: "Slack notification workflow failed", time: "15m ago", icon: AlertCircle },
  { id: "3", type: "running", message: "Data Sync pipeline is running", time: "1m ago", icon: Activity },
  { id: "4", type: "success", message: "Customer Onboarding flow completed", time: "30m ago", icon: CheckCircle },
  { id: "5", type: "success", message: "Report Generation executed", time: "1h ago", icon: CheckCircle },
  { id: "6", type: "running", message: "AI Content Generator in progress", time: "5m ago", icon: Bot },
];

const quickActions = [
  { label: "New Workflow", icon: Plus, href: "/dashboard/workflows?create=true", color: "bg-primary text-primary-foreground" },
  { label: "Run Execution", icon: Play, href: "/dashboard/executions?run=true", color: "bg-green-600 text-white" },
  { label: "Add Integration", icon: Zap, href: "/dashboard/integrations", color: "bg-orange-500 text-white" },
  { label: "AI Assistant", icon: Bot, href: "/dashboard/ai", color: "bg-purple-600 text-white" },
];

const chartData = [
  { day: "Mon", executions: 1200, success: 1176, failed: 24 },
  { day: "Tue", executions: 1400, success: 1380, failed: 20 },
  { day: "Wed", executions: 1100, success: 1085, failed: 15 },
  { day: "Thu", executions: 1600, success: 1570, failed: 30 },
  { day: "Fri", executions: 1800, success: 1780, failed: 20 },
  { day: "Sat", executions: 800, success: 795, failed: 5 },
  { day: "Sun", executions: 600, success: 598, failed: 2 },
];

const topWorkflows = [
  { name: "Email Campaign", executions: 3420, successRate: 99.2, status: "active" },
  { name: "Customer Onboarding", executions: 2100, successRate: 97.8, status: "active" },
  { name: "Data Sync Pipeline", executions: 1850, successRate: 98.5, status: "active" },
  { name: "Slack Notifications", executions: 1200, successRate: 95.3, status: "error" },
  { name: "Report Generator", executions: 890, successRate: 100, status: "active" },
];

const activityColors: Record<string, string> = {
  success: "text-green-500",
  error: "text-red-500",
  running: "text-blue-500",
};

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]" role="status" aria-label="Loading dashboard">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back, John. Here&apos;s what&apos;s happening.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Link href="/dashboard/workflows?create=true">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Workflow
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat) => (
          <Card key={stat.title} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                  <div className="flex items-center gap-1 mt-2">
                    {stat.trend === "up" ? (
                      <TrendingUp className="h-3 w-3 text-green-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-500" />
                    )}
                    <span className={`text-xs font-medium ${stat.trend === "up" ? "text-green-500" : "text-red-500"}`}>
                      {stat.change}
                    </span>
                    <span className="text-xs text-muted-foreground">vs last week</span>
                  </div>
                </div>
                <div className={`p-3 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {quickActions.map((action) => (
              <Link key={action.label} href={action.href}>
                <div className={`flex items-center gap-3 rounded-lg p-4 ${action.color} hover:opacity-90 transition-opacity cursor-pointer`}>
                  <action.icon className="h-5 w-5" />
                  <span className="text-sm font-medium">{action.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Execution Overview</CardTitle>
              <CardDescription>Daily executions over the past week</CardDescription>
            </div>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {chartData.map((d) => (
                <div key={d.day} className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground w-8">{d.day}</span>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 bg-muted rounded-full h-6 overflow-hidden">
                      <div
                        className="h-full bg-primary/80 rounded-full transition-all duration-500"
                        style={{ width: `${(d.executions / 2000) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium w-12 text-right">{d.executions.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-6 mt-4 pt-4 border-t text-xs text-muted-foreground">
              <div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full bg-primary/80" /> Executions</div>
              <div>Total: 8,500 this week</div>
            </div>
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Activity</CardTitle>
            <Link href="/dashboard/executions" className="text-sm text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <activity.icon className={`h-4 w-4 mt-0.5 shrink-0 ${activityColors[activity.type] || "text-muted-foreground"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-tight">{activity.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Workflows */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Top Workflows</CardTitle>
            <CardDescription>Most active workflows this month</CardDescription>
          </div>
          <Link href="/dashboard/workflows">
            <Button variant="ghost" size="sm">
              View all <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {topWorkflows.map((wf, i) => (
              <div key={wf.name} className="flex items-center gap-4">
                <span className="text-sm font-medium text-muted-foreground w-6">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{wf.name}</p>
                  <p className="text-xs text-muted-foreground">{wf.executions.toLocaleString()} executions</p>
                </div>
                <BadgeStatus status={wf.status} />
                <div className="text-right w-20">
                  <span className="text-sm font-medium">{wf.successRate}%</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
