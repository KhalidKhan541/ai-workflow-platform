"use client";

import React, { useState, useMemo } from "react";
import {
  Search, Plus, Check, ExternalLink, Settings, RefreshCw, Zap,
  Mail, MessageSquare, Database, Cloud, Shield, BarChart3, Code,
  GitBranch, FileText, Users, Globe, Bell, Bot, Link2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, BadgeStatus } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: React.ElementType;
  connected: boolean;
  status: "active" | "inactive" | "error";
  popular: boolean;
  configFields: string[];
}

const integrations: Integration[] = [
  { id: "slack", name: "Slack", description: "Send messages, create channels, and manage Slack workspace", category: "Communication", icon: MessageSquare, connected: true, status: "active", popular: true, configFields: ["Bot Token", "Workspace ID"] },
  { id: "gmail", name: "Gmail", description: "Send and receive emails via Gmail API", category: "Communication", icon: Mail, connected: true, status: "active", popular: true, configFields: ["OAuth Token", "Sender Email"] },
  { id: "github", name: "GitHub", description: "Manage repositories, issues, and pull requests", category: "Development", icon: GitBranch, connected: false, status: "inactive", popular: true, configFields: ["Personal Access Token"] },
  { id: "postgres", name: "PostgreSQL", description: "Connect to PostgreSQL databases", category: "Database", icon: Database, connected: true, status: "active", popular: true, configFields: ["Connection String", "Database Name"] },
  { id: "aws-s3", name: "AWS S3", description: "Store and manage files in S3 buckets", category: "Cloud", icon: Cloud, connected: false, status: "inactive", popular: false, configFields: ["Access Key", "Secret Key", "Region", "Bucket"] },
  { id: "jira", name: "Jira", description: "Create and manage Jira issues and projects", category: "Project Management", icon: FileText, connected: false, status: "inactive", popular: true, configFields: ["API Token", "Email", "Domain"] },
  { id: "stripe", name: "Stripe", description: "Process payments and manage subscriptions", category: "Finance", icon: BarChart3, connected: true, status: "error", popular: false, configFields: ["Secret Key", "Publishable Key"] },
  { id: "sendgrid", name: "SendGrid", description: "Send transactional and marketing emails", category: "Communication", icon: SendIcon, connected: false, status: "inactive", popular: false, configFields: ["API Key"] },
  { id: "airtable", name: "Airtable", description: "Connect to Airtable bases and records", category: "Database", icon: Database, connected: true, status: "active", popular: false, configFields: ["API Key", "Base ID"] },
  { id: "hubspot", name: "HubSpot", description: "CRM, marketing, and sales automation", category: "CRM", icon: Users, connected: false, status: "inactive", popular: true, configFields: ["API Key"] },
  { id: "openai", name: "OpenAI", description: "GPT-4, DALL-E, and Whisper AI models", category: "AI", icon: Bot, connected: true, status: "active", popular: true, configFields: ["API Key", "Organization ID"] },
  { id: "twilio", name: "Twilio", description: "Send SMS and make phone calls", category: "Communication", icon: Bell, connected: false, status: "inactive", popular: false, configFields: ["Account SID", "Auth Token"] },
];

const categories = ["All", "Communication", "Development", "Database", "Cloud", "Project Management", "Finance", "CRM", "AI"];

function SendIcon(props: React.SVGProps<SVGSVGElement>) {
  return <Mail {...props} />;
}

export default function IntegrationsPage() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [setupModal, setSetupModal] = useState<string | null>(null);
  const [setupStep, setSetupStep] = useState(0);

  React.useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const filtered = useMemo(() => {
    return integrations.filter((i) => {
      const matchSearch = i.name.toLowerCase().includes(search.toLowerCase()) || i.description.toLowerCase().includes(search.toLowerCase());
      const matchCategory = category === "All" || i.category === category;
      return matchSearch && matchCategory;
    });
  }, [search, category]);

  const connectedCount = integrations.filter((i) => i.connected).length;

  const openSetup = (id: string) => {
    setSetupModal(id);
    setSetupStep(0);
  };

  const closeSetup = () => {
    setSetupModal(null);
    setSetupStep(0);
  };

  const setupIntegration = integrations.find((i) => i.id === setupModal);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]" role="status" aria-label="Loading integrations">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground mt-1">{connectedCount} of {integrations.length} integrations connected</p>
        </div>
        <div className="flex items-center gap-2">
          <Progress value={(connectedCount / integrations.length) * 100} className="w-32" />
          <span className="text-sm text-muted-foreground">{Math.round((connectedCount / integrations.length) * 100)}%</span>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search integrations..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" aria-label="Search integrations" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${category === cat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                aria-label={`Filter by ${cat}`}
                aria-pressed={category === cat}
              >
                {cat}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Integrations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((integration) => {
          const Icon = integration.icon;
          return (
            <Card key={integration.id} className="hover:shadow-md transition-all">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{integration.name}</CardTitle>
                        {integration.popular && <Badge variant="secondary" className="text-xs">Popular</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground capitalize">{integration.category}</p>
                    </div>
                  </div>
                  {integration.connected && (
                    <div className="flex items-center gap-1">
                      <div className={`h-2 w-2 rounded-full ${integration.status === "active" ? "bg-green-500" : integration.status === "error" ? "bg-red-500" : "bg-gray-400"}`} />
                      <span className="text-xs text-muted-foreground capitalize">{integration.status}</span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{integration.description}</p>
                <div className="flex items-center gap-2">
                  {integration.connected ? (
                    <>
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => openSetup(integration.id)}>
                        <Settings className="h-3 w-3 mr-1" /> Configure
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive">
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" className="flex-1" onClick={() => openSetup(integration.id)}>
                      <Link2 className="h-3 w-3 mr-1" /> Connect
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No integrations found</h3>
            <p className="text-sm text-muted-foreground">Try adjusting your search or filters</p>
          </CardContent>
        </Card>
      )}

      {/* Setup Wizard Modal */}
      {setupIntegration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeSetup} role="dialog" aria-modal="true" aria-label={`Setup ${setupIntegration.name}`}>
          <div className="bg-background rounded-xl shadow-xl max-w-lg w-full mx-4 p-6 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                  <setupIntegration.icon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Connect {setupIntegration.name}</h2>
                  <p className="text-sm text-muted-foreground">Step {setupStep + 1} of 3</p>
                </div>
              </div>
              <button onClick={closeSetup} className="p-2 hover:bg-accent rounded-lg" aria-label="Close setup wizard">
                <span className="text-xl">&times;</span>
              </button>
            </div>

            {/* Progress */}
            <div className="flex gap-2 mb-6">
              {[0, 1, 2].map((s) => (
                <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= setupStep ? "bg-primary" : "bg-muted"}`} />
              ))}
            </div>

            {setupStep === 0 && (
              <div className="space-y-4">
                <h3 className="font-medium">Authorization</h3>
                <p className="text-sm text-muted-foreground">Click the button below to authorize AutoFlow to access your {setupIntegration.name} account.</p>
                <Button className="w-full" onClick={() => setSetupStep(1)}>
                  <ExternalLink className="h-4 w-4 mr-2" /> Authorize {setupIntegration.name}
                </Button>
              </div>
            )}

            {setupStep === 1 && (
              <div className="space-y-4">
                <h3 className="font-medium">Configuration</h3>
                {setupIntegration.configFields.map((field) => (
                  <div key={field}>
                    <label className="text-sm font-medium mb-1 block">{field}</label>
                    <Input placeholder={`Enter ${field}`} type={field.toLowerCase().includes("key") || field.toLowerCase().includes("token") ? "password" : "text"} />
                  </div>
                ))}
                <Button className="w-full" onClick={() => setSetupStep(2)}>Test Connection</Button>
              </div>
            )}

            {setupStep === 2 && (
              <div className="space-y-4 text-center py-4">
                <div className="h-16 w-16 rounded-full bg-green-50 dark:bg-green-950 flex items-center justify-center mx-auto">
                  <Check className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="font-medium text-lg">Connection Successful!</h3>
                <p className="text-sm text-muted-foreground">{setupIntegration.name} has been connected to your workspace.</p>
                <Button className="w-full" onClick={closeSetup}>Done</Button>
              </div>
            )}

            {setupStep < 2 && (
              <div className="flex justify-between mt-6">
                <Button variant="outline" onClick={() => setupStep > 0 ? setSetupStep(setupStep - 1) : closeSetup()}>
                  {setupStep > 0 ? "Back" : "Cancel"}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
