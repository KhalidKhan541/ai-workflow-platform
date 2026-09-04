"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft, Save, Play, CheckCircle, ZoomIn, ZoomOut, Maximize,
  Plus, Trash2, Settings, GripVertical, Bot, Zap, Clock, Filter,
  GitBranch, Database, Mail, Bell, Code, ChevronRight, X, AlertCircle,
  RefreshCw, Undo, Redo, AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, BadgeStatus } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface BuilderStep {
  id: string;
  name: string;
  type: string;
  icon: React.ElementType;
  color: string;
  x: number;
  y: number;
  config: Record<string, string>;
  connectedTo?: string[];
}

const stepPalette = [
  { type: "trigger", name: "Schedule", icon: Clock, color: "bg-yellow-100 border-yellow-300 text-yellow-700 dark:bg-yellow-950 dark:border-yellow-700 dark:text-yellow-400" },
  { type: "trigger", name: "Webhook", icon: Zap, color: "bg-yellow-100 border-yellow-300 text-yellow-700 dark:bg-yellow-950 dark:border-yellow-700 dark:text-yellow-400" },
  { type: "action", name: "HTTP Request", icon: Code, color: "bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-950 dark:border-blue-700 dark:text-blue-400" },
  { type: "action", name: "Send Email", icon: Mail, color: "bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-950 dark:border-blue-700 dark:text-blue-400" },
  { type: "action", name: "Database Query", icon: Database, color: "bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-950 dark:border-blue-700 dark:text-blue-400" },
  { type: "condition", name: "If/Else", icon: GitBranch, color: "bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-950 dark:border-purple-700 dark:text-purple-400" },
  { type: "ai", name: "AI Generate", icon: Bot, color: "bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-950 dark:border-emerald-700 dark:text-emerald-400" },
  { type: "action", name: "Notification", icon: Bell, color: "bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-950 dark:border-blue-700 dark:text-blue-400" },
  { type: "delay", name: "Wait/Delay", icon: Clock, color: "bg-orange-100 border-orange-300 text-orange-700 dark:bg-orange-950 dark:border-orange-700 dark:text-orange-400" },
  { type: "action", name: "Filter", icon: Filter, color: "bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-950 dark:border-blue-700 dark:text-blue-400" },
];

const initialSteps: BuilderStep[] = [
  { id: "step-1", name: "Schedule Trigger", type: "trigger", icon: Clock, color: stepPalette[0].color, x: 100, y: 80, config: { schedule: "0 9 * * 1-5" }, connectedTo: ["step-2"] },
  { id: "step-2", name: "Fetch Data", type: "action", icon: Database, color: stepPalette[4].color, x: 100, y: 200, config: { url: "/api/data" }, connectedTo: ["step-3"] },
  { id: "step-3", name: "AI Analysis", type: "ai", icon: Bot, color: stepPalette[6].color, x: 100, y: 320, config: { prompt: "Analyze this data" }, connectedTo: ["step-4", "step-5"] },
  { id: "step-4", name: "Send Report", type: "action", icon: Mail, color: stepPalette[3].color, x: -100, y: 440, config: { to: "team@company.com" }, connectedTo: [] },
  { id: "step-5", name: "Notify Slack", type: "action", icon: Bell, color: stepPalette[7].color, x: 200, y: 440, config: { channel: "#alerts" }, connectedTo: [] },
];

export default function WorkflowBuilderPage() {
  const params = useParams();
  const id = params.id as string;
  const [loading, setLoading] = useState(true);
  const [steps, setSteps] = useState<BuilderStep[]>(initialSteps);
  const [selectedStep, setSelectedStep] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [sidebarTab, setSidebarTab] = useState<"palette" | "properties">("palette");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.1, 2));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.1, 0.3));
  const handleReset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains("canvas-bg")) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleCanvasMouseUp = () => setIsDragging(false);

  const addStepFromPalette = (paletteItem: typeof stepPalette[0]) => {
    const newStep: BuilderStep = {
      id: `step-${Date.now()}`,
      name: paletteItem.name,
      type: paletteItem.type,
      icon: paletteItem.icon,
      color: paletteItem.color,
      x: 100,
      y: steps.length * 120 + 80,
      config: {},
      connectedTo: [],
    };
    setSteps([...steps, newStep]);
  };

  const removeStep = (stepId: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== stepId).map((s) => ({
      ...s, connectedTo: s.connectedTo?.filter((c) => c !== stepId),
    })));
    if (selectedStep === stepId) setSelectedStep(null);
  };

  const validateWorkflow = (): string[] => {
    const errors: string[] = [];
    const triggers = steps.filter((s) => s.type === "trigger");
    if (triggers.length === 0) errors.push("Workflow must have at least one trigger step");
    if (triggers.length > 1) errors.push("Workflow can only have one trigger step");
    const disconnected = steps.filter((s) => s.type !== "trigger" && !steps.some((p) => p.connectedTo?.includes(s.id)));
    if (disconnected.length > 0) errors.push(`${disconnected.length} step(s) are not connected`);
    return errors;
  };

  const handleSave = async () => {
    const errors = validateWorkflow();
    setValidationErrors(errors);
    if (errors.length > 0) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 1000));
    setSaving(false);
  };

  const selected = steps.find((s) => s.id === selectedStep);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]" role="status" aria-label="Loading workflow builder">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/workflows/${id}`} className="p-2 hover:bg-accent rounded-lg transition-colors" aria-label="Back to workflow">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-bold">Workflow Builder</h1>
          <Badge variant="secondary">{steps.length} steps</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 border rounded-lg px-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomOut} aria-label="Zoom out">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs font-medium w-12 text-center">{Math.round(zoom * 100)}%</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomIn} aria-label="Zoom in">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleReset} aria-label="Reset view">
              <Maximize className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button size="sm">
            <Play className="h-4 w-4 mr-2" /> Execute
          </Button>
        </div>
      </div>

      {validationErrors.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <div className="flex items-center gap-2 text-destructive text-sm font-medium mb-1">
            <AlertTriangle className="h-4 w-4" /> Validation Errors
          </div>
          <ul className="text-sm text-destructive/80 space-y-1 ml-6 list-disc">
            {validationErrors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      <div className="flex gap-0 h-[calc(100vh-200px)] border rounded-xl overflow-hidden">
        {/* Step Palette Sidebar */}
        <div className="w-64 border-r bg-card flex flex-col shrink-0">
          <Tabs value={sidebarTab} onValueChange={(v) => setSidebarTab(v as "palette" | "properties")} className="flex flex-col h-full">
            <TabsList className="mx-3 mt-3">
              <TabsTrigger value="palette" className="flex-1">Steps</TabsTrigger>
              <TabsTrigger value="properties" className="flex-1">Properties</TabsTrigger>
            </TabsList>
            <TabsContent value="palette" className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin m-0">
              {stepPalette.map((item, i) => {
                const Icon = item.icon;
                return (
                  <button
                    key={i}
                    onClick={() => addStepFromPalette(item)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left hover:shadow-md transition-all cursor-grab active:cursor-grabbing ${item.color}`}
                    draggable
                    aria-label={`Add ${item.name} step`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs opacity-70 capitalize">{item.type}</p>
                    </div>
                  </button>
                );
              })}
            </TabsContent>
            <TabsContent value="properties" className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin m-0">
              {selected ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Name</label>
                    <Input value={selected.name} onChange={(e) => {
                      setSteps((prev) => prev.map((s) => s.id === selected.id ? { ...s, name: e.target.value } : s));
                    }} className="mt-1 h-8 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Type</label>
                    <p className="text-sm capitalize mt-1">{selected.type}</p>
                  </div>
                  {Object.entries(selected.config).map(([key, val]) => (
                    <div key={key}>
                      <label className="text-xs font-medium text-muted-foreground capitalize">{key}</label>
                      <Input value={val} onChange={(e) => {
                        setSteps((prev) => prev.map((s) => s.id === selected.id ? { ...s, config: { ...s.config, [key]: e.target.value } } : s));
                      }} className="mt-1 h-8 text-sm" />
                    </div>
                  ))}
                  <Button variant="destructive" size="sm" className="w-full" onClick={() => removeStep(selected.id)}>
                    <Trash2 className="h-4 w-4 mr-2" /> Remove Step
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Settings className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Select a step to configure</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Canvas */}
        <div
          ref={canvasRef}
          className="flex-1 overflow-hidden bg-muted/20 canvas-bg relative cursor-grab active:cursor-grabbing"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
        >
          <div
            className="absolute inset-0"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}
          >
            {/* Grid pattern */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-border" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>

            {/* Connection Lines */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
              {steps.map((step) =>
                (step.connectedTo || []).map((targetId) => {
                  const target = steps.find((s) => s.id === targetId);
                  if (!target) return null;
                  const x1 = step.x + 140;
                  const y1 = step.y + 30;
                  const x2 = target.x + 140;
                  const y2 = target.y;
                  const midY = (y1 + y2) / 2;
                  return (
                    <path
                      key={`${step.id}-${targetId}`}
                      d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="2"
                      strokeDasharray="6 3"
                      opacity="0.5"
                    />
                  );
                })
              )}
            </svg>

            {/* Steps */}
            {steps.map((step) => {
              const Icon = step.icon;
              const isSelected = selectedStep === step.id;
              return (
                <div
                  key={step.id}
                  className={`absolute w-[280px] rounded-xl border-2 shadow-sm cursor-pointer transition-all hover:shadow-md ${step.color} ${isSelected ? "ring-2 ring-primary ring-offset-2" : ""}`}
                  style={{ left: step.x, top: step.y }}
                  onClick={() => { setSelectedStep(step.id); setSidebarTab("properties"); }}
                  role="button"
                  aria-label={`${step.name} step`}
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { setSelectedStep(step.id); setSidebarTab("properties"); } }}
                >
                  <div className="flex items-center gap-3 p-3">
                    <GripVertical className="h-4 w-4 opacity-40 shrink-0 cursor-grab" />
                    <div className="h-8 w-8 rounded-lg bg-white/50 dark:bg-black/20 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{step.name}</p>
                      <p className="text-xs opacity-70 capitalize">{step.type}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeStep(step.id); }}
                      className="h-6 w-6 rounded-md hover:bg-black/10 flex items-center justify-center opacity-50 hover:opacity-100"
                      aria-label={`Remove ${step.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
