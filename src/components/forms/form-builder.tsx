import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Checkbox, CheckboxGroup } from "@/components/ui/checkbox";
import { RadioGroupWithOptions } from "@/components/ui/radio";
import { Slider } from "@/components/ui/slider";
import { DatePicker } from "@/components/ui/date-picker";
import { Plus, Trash2, GripVertical } from "lucide-react";

interface FormField {
  name: string;
  label: string;
  type: "text" | "email" | "password" | "number" | "textarea" | "select" | "switch" | "checkbox" | "radio" | "slider" | "date" | "file" | "color" | "custom";
  placeholder?: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
  defaultValue?: unknown;
  options?: { label: string; value: string }[];
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    patternMessage?: string;
  };
  render?: (props: { value: unknown; onChange: (value: unknown) => void; field: FormField }) => React.ReactNode;
  className?: string;
}

interface FormSection {
  title?: string;
  description?: string;
  fields: FormField[];
}

interface FormBuilderProps {
  sections: FormSection[];
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
  onSubmit?: (values: Record<string, unknown>) => void;
  errors?: Record<string, string>;
  layout?: "vertical" | "horizontal";
  submitLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  loading?: boolean;
  className?: string;
}

function FormBuilder({
  sections,
  values,
  onChange,
  onSubmit,
  errors = {},
  layout = "vertical",
  submitLabel = "Save",
  cancelLabel = "Cancel",
  onCancel,
  loading = false,
  className,
}: FormBuilderProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.(values);
  };

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-6", className)}>
      {sections.map((section, sIndex) => (
        <div key={sIndex} className="space-y-4">
          {section.title && (
            <div>
              <h3 className="text-lg font-medium">{section.title}</h3>
              {section.description && (
                <p className="text-sm text-muted-foreground mt-1">{section.description}</p>
              )}
            </div>
          )}
          <div className="grid gap-4">
            {section.fields.map((field) => (
              <FormFieldRenderer
                key={field.name}
                field={field}
                value={values[field.name]}
                onChange={(value) => onChange(field.name, value)}
                error={errors[field.name]}
                layout={layout}
              />
            ))}
          </div>
        </div>
      ))}
      {(onSubmit || onCancel) && (
        <div className="flex items-center justify-end gap-2 pt-4 border-t">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              {cancelLabel}
            </Button>
          )}
          {onSubmit && (
            <Button type="submit" loading={loading}>
              {submitLabel}
            </Button>
          )}
        </div>
      )}
    </form>
  );
}

interface FormFieldRendererProps {
  field: FormField;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  layout?: "vertical" | "horizontal";
}

function FormFieldRenderer({ field, value, onChange, error, layout = "vertical" }: FormFieldRendererProps) {
  if (field.render) {
    return (
      <div className={cn(field.className)}>
        {field.render({ value, onChange, field })}
        {error && <p className="text-sm text-destructive mt-1">{error}</p>}
      </div>
    );
  }

  const inputProps = {
    label: field.label,
    placeholder: field.placeholder,
    error,
    helperText: field.description,
    required: field.required,
    disabled: field.disabled,
    className: field.className,
  };

  switch (field.type) {
    case "text":
    case "email":
    case "password":
      return (
        <Input
          {...inputProps}
          type={field.type}
          value={String(value || "")}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "number":
      return (
        <Input
          {...inputProps}
          type="number"
          value={String(value || "")}
          onChange={(e) => onChange(Number(e.target.value))}
          min={field.validation?.min}
          max={field.validation?.max}
        />
      );
    case "textarea":
      return (
        <Textarea
          {...inputProps}
          value={String(value || "")}
          onChange={(e) => onChange(e.target.value)}
          autoResize
          maxLength={field.validation?.maxLength}
          showCount={!!field.validation?.maxLength}
        />
      );
    case "select":
      return (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </label>
          <Select value={String(value || "")} onValueChange={onChange}>
            <SelectTrigger error={!!error}>
              <SelectValue placeholder={field.placeholder || "Select..."} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {field.description && !error && (
            <p className="text-sm text-muted-foreground">{field.description}</p>
          )}
        </div>
      );
    case "switch":
      return (
        <Switch
          label={field.label}
          description={field.description}
          checked={Boolean(value)}
          onCheckedChange={onChange}
          disabled={field.disabled}
        />
      );
    case "checkbox":
      return (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{field.label}</label>
          <CheckboxGroup
            options={field.options || []}
            value={Array.isArray(value) ? value as string[] : []}
            onValueChange={(v) => onChange(v)}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      );
    case "radio":
      return (
        <RadioGroupWithOptions
          options={field.options || []}
          value={String(value || "")}
          onValueChange={(v) => onChange(v)}
          label={field.label}
          error={error}
        />
      );
    case "slider":
      return (
        <Slider
          label={field.label}
          value={[Number(value || 0)]}
          onValueChange={([v]) => onChange(v)}
          min={field.validation?.min || 0}
          max={field.validation?.max || 100}
          showValue
        />
      );
    case "file":
      return (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </label>
          <Input
            type="file"
            onChange={(e) => onChange(e.target.files?.[0] || null)}
            disabled={field.disabled}
            className={cn(error && "border-destructive")}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          {field.description && !error && (
            <p className="text-sm text-muted-foreground">{field.description}</p>
          )}
        </div>
      );
    case "color":
      return (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{field.label}</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={String(value || "#000000")}
              onChange={(e) => onChange(e.target.value)}
              className="h-10 w-10 rounded border cursor-pointer"
              disabled={field.disabled}
            />
            <Input
              value={String(value || "#000000")}
              onChange={(e) => onChange(e.target.value)}
              className="w-28"
              disabled={field.disabled}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      );
    default:
      return null;
  }
}

interface DynamicFormProps {
  fields: FormField[];
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
  errors?: Record<string, string>;
  className?: string;
}

function DynamicForm({ fields, values, onChange, errors, className }: DynamicFormProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {fields.map((field) => (
        <FormFieldRenderer
          key={field.name}
          field={field}
          value={values[field.name]}
          onChange={(value) => onChange(field.name, value)}
          error={errors?.[field.name]}
        />
      ))}
    </div>
  );
}

export { FormBuilder, DynamicForm, FormFieldRenderer, type FormField, type FormSection };
