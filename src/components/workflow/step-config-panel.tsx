import * as React from "react";
import { cn } from "@/lib/utils";
import { X, Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { WorkflowStep as WorkflowStepType } from "@/hooks/use-workflow-builder";

interface StepConfigPanelProps {
  step: WorkflowStepType;
  onChange: (step: WorkflowStepType) => void;
  onClose?: () => void;
  onDelete?: () => void;
  className?: string;
}

interface ConfigField {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "switch" | "number" | "json";
  options?: { label: string; value: string }[];
  required?: boolean;
  placeholder?: string;
  description?: string;
}

const stepConfigs: Record<string, ConfigField[]> = {
  trigger: [
    { key: "event", label: "Event Type", type: "select", options: [
      { label: "Manual", value: "manual" },
      { label: "Schedule", value: "schedule" },
      { label: "Webhook", value: "webhook" },
      { label: "Event", value: "event" },
    ], required: true },
    { key: "schedule", label: "Schedule (cron)", type: "text", placeholder: "0 * * * *" },
    { key: "webhookPath", label: "Webhook Path", type: "text", placeholder: "/api/webhook" },
  ],
  action: [
    { key: "actionType", label: "Action Type", type: "select", options: [
      { label: "HTTP Request", value: "http" },
      { label: "Database Query", value: "database" },
      { label: "Send Email", value: "email" },
      { label: "Transform Data", value: "transform" },
    ], required: true },
    { key: "url", label: "URL", type: "text", placeholder: "https://api.example.com" },
    { key: "method", label: "Method", type: "select", options: [
      { label: "GET", value: "GET" },
      { label: "POST", value: "POST" },
      { label: "PUT", value: "PUT" },
      { label: "DELETE", value: "DELETE" },
    ]},
    { key: "headers", label: "Headers (JSON)", type: "textarea", placeholder: '{"Content-Type": "application/json"}' },
    { key: "body", label: "Body", type: "textarea" },
    { key: "timeout", label: "Timeout (ms)", type: "number" },
  ],
  condition: [
    { key: "field", label: "Field", type: "text", required: true, placeholder: "data.status" },
    { key: "operator", label: "Operator", type: "select", options: [
      { label: "Equals", value: "eq" },
      { label: "Not Equals", value: "neq" },
      { label: "Contains", value: "contains" },
      { label: "Greater Than", value: "gt" },
      { label: "Less Than", value: "lt" },
      { label: "Is Empty", value: "empty" },
    ], required: true },
    { key: "value", label: "Value", type: "text" },
  ],
  delay: [
    { key: "duration", label: "Duration", type: "number", required: true, description: "Delay in milliseconds" },
    { key: "unit", label: "Unit", type: "select", options: [
      { label: "Milliseconds", value: "ms" },
      { label: "Seconds", value: "s" },
      { label: "Minutes", value: "m" },
      { label: "Hours", value: "h" },
    ]},
  ],
  ai: [
    { key: "model", label: "AI Model", type: "select", options: [
      { label: "GPT-4", value: "gpt-4" },
      { label: "GPT-3.5", value: "gpt-3.5-turbo" },
      { label: "Claude 3", value: "claude-3" },
    ], required: true },
    { key: "prompt", label: "Prompt", type: "textarea", required: true, placeholder: "Enter your prompt..." },
    { key: "temperature", label: "Temperature", type: "number", placeholder: "0.7" },
    { key: "maxTokens", label: "Max Tokens", type: "number" },
    { key: "systemMessage", label: "System Message", type: "textarea" },
  ],
  email: [
    { key: "to", label: "To", type: "text", required: true, placeholder: "user@example.com" },
    { key: "subject", label: "Subject", type: "text", required: true },
    { key: "body", label: "Body", type: "textarea", required: true },
    { key: "isHtml", label: "HTML Email", type: "switch" },
  ],
  webhook: [
    { key: "url", label: "URL", type: "text", required: true, placeholder: "https://api.example.com" },
    { key: "method", label: "Method", type: "select", options: [
      { label: "GET", value: "GET" },
      { label: "POST", value: "POST" },
      { label: "PUT", value: "PUT" },
      { label: "DELETE", value: "DELETE" },
    ]},
    { key: "headers", label: "Headers", type: "textarea" },
    { key: "body", label: "Body", type: "textarea" },
  ],
  database: [
    { key: "connection", label: "Connection", type: "text", required: true, placeholder: "default" },
    { key: "query", label: "Query", type: "textarea", required: true, placeholder: "SELECT * FROM users" },
    { key: "params", label: "Parameters", type: "json" },
  ],
  http: [
    { key: "url", label: "URL", type: "text", required: true },
    { key: "method", label: "Method", type: "select", options: [
      { label: "GET", value: "GET" },
      { label: "POST", value: "POST" },
    ]},
    { key: "headers", label: "Headers", type: "textarea" },
    { key: "body", label: "Body", type: "textarea" },
  ],
  transform: [
    { key: "expression", label: "Expression", type: "textarea", required: true, placeholder: "data.map(item => item.name)" },
    { key: "outputField", label: "Output Field", type: "text" },
  ],
};

function StepConfigPanel({ step, onChange, onClose, onDelete, className }: StepConfigPanelProps) {
  const [expandedSections, setExpandedSections] = React.useState<string[]>(["general", "config"]);
  const configFields = stepConfigs[step.type] || [];

  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  const updateField = (key: string, value: unknown) => {
    onChange({
      ...step,
      config: { ...step.config, [key]: value },
    });
  };

  return (
    <div className={cn("flex flex-col h-full bg-card border-l", className)}>
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="text-sm font-semibold">Configure Step</h3>
        <div className="flex items-center gap-1">
          {onDelete && (
            <Button variant="ghost" size="icon-sm" onClick={onDelete} className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          {onClose && (
            <Button variant="ghost" size="icon-sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="p-3 space-y-3">
          {/* General Section */}
          <Section title="General" expanded={expandedSections.includes("general")} onToggle={() => toggleSection("general")}>
            <div className="space-y-3">
              <Input
                label="Step Name"
                value={step.name}
                onChange={(e) => onChange({ ...step, name: e.target.value })}
                placeholder="Enter step name"
              />
              <Textarea
                label="Description"
                value={step.description || ""}
                onChange={(e) => onChange({ ...step, description: e.target.value })}
                placeholder="Enter description"
                autoResize
              />
            </div>
          </Section>

          <Separator />

          {/* Config Section */}
          {configFields.length > 0 && (
            <Section title="Configuration" expanded={expandedSections.includes("config")} onToggle={() => toggleSection("config")}>
              <div className="space-y-3">
                {configFields.map((field) => (
                  <div key={field.key}>
                    {field.type === "text" && (
                      <Input
                        label={field.label}
                        value={String(step.config?.[field.key] || "")}
                        onChange={(e) => updateField(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        required={field.required}
                        helperText={field.description}
                      />
                    )}
                    {field.type === "textarea" && (
                      <Textarea
                        label={field.label}
                        value={String(step.config?.[field.key] || "")}
                        onChange={(e) => updateField(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        required={field.required}
                        autoResize
                      />
                    )}
                    {field.type === "number" && (
                      <Input
                        label={field.label}
                        type="number"
                        value={String(step.config?.[field.key] || "")}
                        onChange={(e) => updateField(field.key, Number(e.target.value))}
                        placeholder={field.placeholder}
                        required={field.required}
                        helperText={field.description}
                      />
                    )}
                    {field.type === "select" && field.options && (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium">{field.label}{field.required && <span className="text-destructive ml-1">*</span>}</label>
                        <Select
                          value={String(step.config?.[field.key] || "")}
                          onValueChange={(value) => updateField(field.key, value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            {field.options.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {field.type === "switch" && (
                      <Switch
                        label={field.label}
                        checked={Boolean(step.config?.[field.key])}
                        onCheckedChange={(checked) => updateField(field.key, checked)}
                      />
                    )}
                    {field.type === "json" && (
                      <Textarea
                        label={field.label}
                        value={typeof step.config?.[field.key] === "string" ? String(step.config[field.key]) : JSON.stringify(step.config?.[field.key] || {}, null, 2)}
                        onChange={(e) => {
                          try {
                            updateField(field.key, JSON.parse(e.target.value));
                          } catch {
                            updateField(field.key, e.target.value);
                          }
                        }}
                        placeholder="{}"
                        required={field.required}
                        autoResize
                      />
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full py-1 text-sm font-medium"
      >
        <span>{title}</span>
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {expanded && <div className="mt-2">{children}</div>}
    </div>
  );
}

export { StepConfigPanel };
