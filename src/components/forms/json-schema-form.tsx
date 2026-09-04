import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { RadioGroupWithOptions } from "@/components/ui/radio";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, AlertCircle } from "lucide-react";

interface JSONSchema {
  type?: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  items?: JSONSchema;
  additionalProperties?: boolean | JSONSchema;
  oneOf?: JSONSchema[];
  anyOf?: JSONSchema[];
  allOf?: JSONSchema[];
  if?: JSONSchema;
  then?: JSONSchema;
  else?: JSONSchema;
  [key: string]: unknown;
}

interface JSONSchemaFormProps {
  schema: JSONSchema;
  uiSchema?: Record<string, unknown>;
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  onSubmit?: (values: Record<string, unknown>) => void;
  errors?: Record<string, string>;
  submitLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  loading?: boolean;
  className?: string;
}

function JSONSchemaForm({
  schema,
  uiSchema = {},
  values,
  onChange,
  onSubmit,
  errors = {},
  submitLabel = "Submit",
  cancelLabel = "Cancel",
  onCancel,
  loading = false,
  className,
}: JSONSchemaFormProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.(values);
  };

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-4", className)}>
      {schema.title && <h2 className="text-lg font-semibold">{schema.title}</h2>}
      {schema.description && <p className="text-sm text-muted-foreground">{schema.description}</p>}
      {schema.properties && (
        <SchemaFields
          schema={schema}
          uiSchema={uiSchema}
          values={values}
          onChange={onChange}
          errors={errors}
          path=""
        />
      )}
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

interface SchemaFieldsProps {
  schema: JSONSchema;
  uiSchema: Record<string, unknown>;
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  errors: Record<string, string>;
  path: string;
}

function SchemaFields({ schema, uiSchema, values, onChange, errors, path }: SchemaFieldsProps) {
  if (!schema.properties) return null;

  return (
    <div className="space-y-4">
      {Object.entries(schema.properties).map(([key, fieldSchema]) => {
        const fieldPath = path ? `${path}.${key}` : key;
        const isRequired = schema.required?.includes(key) || false;
        const value = values[key];
        const error = errors[fieldPath];

        return (
          <SchemaFieldRenderer
            key={key}
            name={key}
            schema={fieldSchema}
            uiSchema={(uiSchema[key] as Record<string, unknown>) || {}}
            value={value}
            onChange={(newValue) => onChange({ ...values, [key]: newValue })}
            error={error}
            required={isRequired}
            path={fieldPath}
          />
        );
      })}
    </div>
  );
}

interface SchemaFieldRendererProps {
  name: string;
  schema: JSONSchema;
  uiSchema: Record<string, unknown>;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  required?: boolean;
  path: string;
}

function SchemaFieldRenderer({
  name,
  schema,
  uiSchema,
  value,
  onChange,
  error,
  required,
  path,
}: SchemaFieldRendererProps) {
  const label = (uiSchema["title"] as string) || schema.title || name;
  const description = (uiSchema["description"] as string) || schema.description;
  const placeholder = uiSchema["placeholder"] as string;
  const disabled = uiSchema["disabled"] as boolean;
  const hidden = uiSchema["hidden"] as boolean;

  if (hidden) return null;

  if (schema.type === "object" && schema.properties) {
    return (
      <div className="border rounded-lg p-4 space-y-4">
        <h4 className="font-medium">{label}</h4>
        <SchemaFields
          schema={schema}
          uiSchema={uiSchema}
          values={(value as Record<string, unknown>) || {}}
          onChange={(newValue) => onChange(newValue)}
          errors={{}}
          path={path}
        />
      </div>
    );
  }

  if (schema.type === "array" && schema.items) {
    const items = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange([...items, schema.items?.default || ""])}
          >
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="flex items-start gap-2">
              <div className="flex-1">
                <SchemaFieldRenderer
                  name={`${index}`}
                  schema={schema.items!}
                  uiSchema={{}}
                  value={item}
                  onChange={(newValue) => {
                    const newItems = [...items];
                    newItems[index] = newValue;
                    onChange(newItems);
                  }}
                  path={`${path}.${index}`}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  const newItems = items.filter((_, i) => i !== index);
                  onChange(newItems);
                }}
                className="mt-7"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (schema.oneOf || schema.anyOf) {
    const options = (schema.oneOf || schema.anyOf) as JSONSchema[];
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
        <RadioGroupWithOptions
          options={options.map((opt, i) => ({
            value: String(i),
            label: opt.title || opt.description || `Option ${i + 1}`,
          }))}
          value={value !== undefined ? String(options.findIndex((opt) => JSON.stringify(opt.default) === JSON.stringify(value))) : ""}
          onValueChange={(v) => onChange(options[Number(v)]?.default)}
        />
      </div>
    );
  }

  switch (schema.type) {
    case "string":
      if (schema.enum) {
        return (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">
              {label}
              {required && <span className="text-destructive ml-1">*</span>}
            </label>
            <Select value={String(value || "")} onValueChange={onChange}>
              <SelectTrigger error={!!error}>
                <SelectValue placeholder={placeholder || "Select..."} />
              </SelectTrigger>
              <SelectContent>
                {schema.enum.map((opt) => (
                  <SelectItem key={String(opt)} value={String(opt)}>
                    {String(opt)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{error}</p>}
            {description && !error && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
        );
      }
      if (schema.format === "textarea" || (uiSchema["widget"] === "textarea")) {
        return (
          <Textarea
            label={label}
            value={String(value || "")}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            error={error}
            helperText={description}
            autoResize
          />
        );
      }
      return (
        <Input
          type={schema.format === "email" ? "email" : schema.format === "password" ? "password" : "text"}
          label={label}
          value={String(value || "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          error={error}
          helperText={description}
        />
      );
    case "number":
    case "integer":
      if (uiSchema["widget"] === "slider") {
        return (
          <Slider
            label={label}
            value={[Number(value || schema.default || 0)]}
            onValueChange={([v]) => onChange(v)}
            min={schema.minimum || 0}
            max={schema.maximum || 100}
            showValue
          />
        );
      }
      return (
        <Input
          type="number"
          label={label}
          value={String(value || "")}
          onChange={(e) => onChange(Number(e.target.value))}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          error={error}
          helperText={description}
          min={schema.minimum}
          max={schema.maximum}
        />
      );
    case "boolean":
      return (
        <Switch
          label={label}
          description={description}
          checked={Boolean(value)}
          onCheckedChange={onChange}
          disabled={disabled}
        />
      );
    default:
      return (
        <Input
          label={label}
          value={String(value || "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          error={error}
          helperText={description}
        />
      );
  }
}

function validateSchema(schema: JSONSchema, values: Record<string, unknown>): Record<string, string> {
  const errors: Record<string, string> = {};

  if (schema.required) {
    schema.required.forEach((key) => {
      if (values[key] === undefined || values[key] === null || values[key] === "") {
        errors[key] = `${key} is required`;
      }
    });
  }

  if (schema.properties) {
    Object.entries(schema.properties).forEach(([key, fieldSchema]) => {
      const value = values[key];
      if (value !== undefined && value !== null) {
        if (fieldSchema.type === "number" || fieldSchema.type === "integer") {
          const num = Number(value);
          if (fieldSchema.minimum !== undefined && num < fieldSchema.minimum) {
            errors[key] = `Minimum value is ${fieldSchema.minimum}`;
          }
          if (fieldSchema.maximum !== undefined && num > fieldSchema.maximum) {
            errors[key] = `Maximum value is ${fieldSchema.maximum}`;
          }
        }
        if (fieldSchema.type === "string") {
          const str = String(value);
          if (fieldSchema.minLength !== undefined && str.length < fieldSchema.minLength) {
            errors[key] = `Minimum length is ${fieldSchema.minLength}`;
          }
          if (fieldSchema.maxLength !== undefined && str.length > fieldSchema.maxLength) {
            errors[key] = `Maximum length is ${fieldSchema.maxLength}`;
          }
          if (fieldSchema.pattern) {
            const regex = new RegExp(fieldSchema.pattern);
            if (!regex.test(str)) {
              errors[key] = fieldSchema.pattern as string;
            }
          }
          if (fieldSchema.format === "email") {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(str)) {
              errors[key] = "Invalid email format";
            }
          }
        }
      }
    });
  }

  return errors;
}

export { JSONSchemaForm, SchemaFieldRenderer, validateSchema, type JSONSchema };
