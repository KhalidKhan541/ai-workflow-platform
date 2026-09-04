"use client";

import React, { useState } from "react";
import {
  Building2, Users, CreditCard, Key, Bell, Shield, RefreshCw,
  Plus, Trash2, Copy, Eye, EyeOff, Save, Check, Mail, Globe,
  Lock, ChevronRight, AlertTriangle, Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const teamMembers = [
  { id: "1", name: "John Doe", email: "john@company.com", role: "owner", lastActive: "2024-03-10" },
  { id: "2", name: "Sarah Chen", email: "sarah@company.com", role: "admin", lastActive: "2024-03-10" },
  { id: "3", name: "Mike Johnson", email: "mike@company.com", role: "member", lastActive: "2024-03-09" },
  { id: "4", name: "Emily Davis", email: "emily@company.com", role: "viewer", lastActive: "2024-03-07" },
];

const apiKeys = [
  { id: "1", name: "Production API Key", key: "sk_live_••••••••••••4f3a", createdAt: "2024-01-15", lastUsed: "2024-03-10", scopes: ["read", "write", "execute"] },
  { id: "2", name: "Staging API Key", key: "sk_test_••••••••••••b7c2", createdAt: "2024-02-01", lastUsed: "2024-03-08", scopes: ["read", "write"] },
  { id: "3", name: "Read-Only Key", key: "sk_ro_••••••••••••9e1d", createdAt: "2024-03-01", lastUsed: "2024-03-05", scopes: ["read"] },
];

const roleLabels: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("org");
  const [showApiKey, setShowApiKey] = useState<string | null>(null);
  const [notifications, setNotifications] = useState({
    email: true,
    slack: false,
    executionSuccess: true,
    executionFailure: true,
    weeklyReport: true,
    billingAlerts: true,
  });

  React.useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]" role="status" aria-label="Loading settings">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your organization, team, and preferences</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="org"><Building2 className="h-4 w-4 mr-1 inline" /> Organization</TabsTrigger>
          <TabsTrigger value="team"><Users className="h-4 w-4 mr-1 inline" /> Team</TabsTrigger>
          <TabsTrigger value="billing"><CreditCard className="h-4 w-4 mr-1 inline" /> Billing</TabsTrigger>
          <TabsTrigger value="api"><Key className="h-4 w-4 mr-1 inline" /> API Keys</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="h-4 w-4 mr-1 inline" /> Notifications</TabsTrigger>
          <TabsTrigger value="security"><Shield className="h-4 w-4 mr-1 inline" /> Security</TabsTrigger>
        </TabsList>

        {/* Organization */}
        <TabsContent value="org" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Organization Settings</CardTitle>
              <CardDescription>Manage your organization profile and settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium mb-2 block">Organization Name</label>
                  <Input defaultValue="Acme Corporation" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Website</label>
                  <Input defaultValue="https://acme.com" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Contact Email</label>
                  <Input defaultValue="admin@acme.com" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Timezone</label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" defaultValue="UTC-5">
                    <option>UTC-8 (Pacific)</option>
                    <option>UTC-5 (Eastern)</option>
                    <option>UTC+0 (GMT)</option>
                    <option>UTC+1 (CET)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Default Workflow Execution Timeout</label>
                <Input defaultValue="300" type="number" className="w-48" />
                <p className="text-xs text-muted-foreground mt-1">Maximum execution time in seconds</p>
              </div>
              <Button><Save className="h-4 w-4 mr-2" /> Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team */}
        <TabsContent value="team" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Team Members</CardTitle>
                <CardDescription>{teamMembers.length} members in your organization</CardDescription>
              </div>
              <Button size="sm"><Plus className="h-4 w-4 mr-2" /> Invite Member</Button>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {teamMembers.map((member) => (
                  <div key={member.id} className="flex items-center gap-4 py-4">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>{member.name.split(" ").map((n) => n[0]).join("")}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    </div>
                    <Badge variant={member.role === "owner" ? "default" : "secondary"}>{roleLabels[member.role]}</Badge>
                    <span className="text-xs text-muted-foreground hidden md:block">Last active: {member.lastActive}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Manage ${member.name}`}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing */}
        <TabsContent value="billing" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Current Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold">Professional Plan</h3>
                    <Badge>$99/month</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Unlimited workflows, 50K executions/mo, AI workspace</p>
                </div>
                <Button variant="outline">Manage Subscription</Button>
              </div>
              <div className="grid md:grid-cols-3 gap-4 mt-6">
                <div>
                  <p className="text-sm text-muted-foreground">Workflows</p>
                  <p className="font-bold">24 / Unlimited</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Executions This Month</p>
                  <p className="font-bold">12,847 / 50,000</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Team Members</p>
                  <p className="font-bold">4 / Unlimited</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment Method</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 p-4 border rounded-lg">
                <CreditCard className="h-8 w-8 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Visa ending in 4242</p>
                  <p className="text-xs text-muted-foreground">Expires 12/2025</p>
                </div>
                <Button variant="outline" size="sm">Update</Button>
              </div>
              <div className="mt-4">
                <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-2" /> Download Invoices</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Keys */}
        <TabsContent value="api" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">API Keys</CardTitle>
                <CardDescription>Manage API keys for external integrations</CardDescription>
              </div>
              <Button size="sm"><Plus className="h-4 w-4 mr-2" /> Generate Key</Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {apiKeys.map((key) => (
                  <div key={key.id} className="flex items-center gap-4 p-4 border rounded-lg">
                    <Key className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{key.name}</p>
                        <div className="flex gap-1">
                          {key.scopes.map((s) => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <code className="text-xs text-muted-foreground font-mono">{key.key}</code>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowApiKey(showApiKey === key.id ? null : key.id)} aria-label="Toggle key visibility">
                          {showApiKey === key.id ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Copy key">
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Created: {key.createdAt} &middot; Last used: {key.lastUsed}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label={`Delete ${key.name}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notification Preferences</CardTitle>
              <CardDescription>Configure how and when you receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-sm font-medium mb-3">Channels</h3>
                <div className="space-y-3">
                  {[
                    { key: "email" as const, label: "Email Notifications", icon: Mail },
                    { key: "slack" as const, label: "Slack Notifications", icon: Globe },
                  ].map(({ key, label, icon: Icon }) => (
                    <div key={key} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm font-medium">{label}</span>
                      </div>
                      <Switch checked={notifications[key]} onCheckedChange={(v) => setNotifications((prev) => ({ ...prev, [key]: v }))} />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-3">Events</h3>
                <div className="space-y-3">
                  {[
                    { key: "executionSuccess" as const, label: "Workflow execution succeeded" },
                    { key: "executionFailure" as const, label: "Workflow execution failed" },
                    { key: "weeklyReport" as const, label: "Weekly usage report" },
                    { key: "billingAlerts" as const, label: "Billing and usage alerts" },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between p-3 rounded-lg border">
                      <span className="text-sm">{label}</span>
                      <Switch checked={notifications[key]} onCheckedChange={(v) => setNotifications((prev) => ({ ...prev, [key]: v }))} />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Security Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="text-sm font-medium">Two-Factor Authentication</p>
                  <p className="text-xs text-muted-foreground">Add an extra layer of security to your account</p>
                </div>
                <Button variant="outline" size="sm">Enable</Button>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="text-sm font-medium">SSO / SAML</p>
                  <p className="text-xs text-muted-foreground">Single sign-on for enterprise teams</p>
                </div>
                <Badge variant="secondary">Enterprise</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="text-sm font-medium">Session Timeout</p>
                  <p className="text-xs text-muted-foreground">Automatically log out inactive users</p>
                </div>
                <select className="h-8 rounded-md border border-input bg-background px-2 text-sm" defaultValue="30">
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="120">2 hours</option>
                </select>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="text-sm font-medium">IP Allowlist</p>
                  <p className="text-xs text-muted-foreground">Restrict access to specific IP addresses</p>
                </div>
                <Button variant="outline" size="sm">Configure</Button>
              </div>
              <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                <div className="flex items-center gap-2 text-destructive mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  <p className="text-sm font-medium">Danger Zone</p>
                </div>
                <p className="text-sm text-muted-foreground mb-3">Permanently delete your organization and all data. This action cannot be undone.</p>
                <Button variant="destructive" size="sm">Delete Organization</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MoreHorizontal(props: React.SVGProps<SVGSVGElement>) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>;
}
