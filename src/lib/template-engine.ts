// Template engine with variable interpolation, conditionals, loops, and filters

// ─── Types ───────────────────────────────────────────────
export type FilterFunction = (value: unknown, ...args: unknown[]) => string;

export interface TemplateOptions {
  openDelimiter?: string;
  closeDelimiter?: string;
  escapeStrings?: boolean;
}

export interface TemplateContext {
  [key: string]: unknown;
}

// ─── Built-in Filters ────────────────────────────────────
const filters: Record<string, FilterFunction> = {
  uppercase: (value) => String(value).toUpperCase(),
  lowercase: (value) => String(value).toLowerCase(),
  capitalize: (value) => {
    const str = String(value);
    return str.charAt(0).toUpperCase() + str.slice(1);
  },
  truncate: (value, ...args) => {
    const len = Number(args[0]) || 50;
    const str = String(value);
    return str.length > len ? str.slice(0, len) + '...' : str;
  },
  trim: (value) => String(value).trim(),
  default: (value, ...args) => value ?? args[0] ?? '',
  number: (value, ...args) => {
    const decimals = Number(args[0]) || 0;
    return Number(value).toFixed(decimals);
  },
  currency: (value, ...args) => {
    const currency = String(args[0] || 'USD');
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(value));
  },
  date: (value, ...args) => {
    const format = String(args[0] || 'medium');
    return new Intl.DateTimeFormat('en-US', { dateStyle: format as any }).format(new Date(String(value)));
  },
  join: (value, ...args) => {
    const separator = String(args[0] || ', ');
    return Array.isArray(value) ? value.join(separator) : String(value);
  },
  length: (value) => {
    if (Array.isArray(value)) return String(value.length);
    if (typeof value === 'string') return String(value.length);
    if (typeof value === 'object' && value !== null) return String(Object.keys(value).length);
    return '0';
  },
  json: (value) => JSON.stringify(value, null, 2),
  first: (value) => Array.isArray(value) ? value[0] : value,
  last: (value) => Array.isArray(value) ? value[value.length - 1] : value,
  sort: (value) => Array.isArray(value) ? [...value].sort() : value,
  reverse: (value) => Array.isArray(value) ? [...value].reverse() : value,
  unique: (value) => Array.isArray(value) ? [...new Set(value)] : value,
  keys: (value) => typeof value === 'object' && value !== null ? Object.keys(value) : [],
  values: (value) => typeof value === 'object' && value !== null ? Object.values(value) : [],
  replace: (value, ...args) => String(value).replace(new RegExp(String(args[0]), 'g'), String(args[1] || '')),
  slugify: (value) => String(value).toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-'),
  urlEncode: (value) => encodeURIComponent(String(value)),
  nl2br: (value) => String(value).replace(/\n/g, '<br>'),
};

// ─── Custom Helpers ──────────────────────────────────────
const helpers = new Map<string, (...args: unknown[]) => unknown>();

export function registerHelper(name: string, fn: (...args: unknown[]) => unknown): void {
  helpers.set(name, fn);
}

export function registerFilter(name: string, fn: FilterFunction): void {
  filters[name] = fn;
}

// ─── Template Engine ─────────────────────────────────────
class TemplateEngine {
  private cache = new Map<string, string>();

  constructor(private options: TemplateOptions = {}) {
    this.options = { openDelimiter: '{{', closeDelimiter: '}}', escapeStrings: true, ...options };
  }

  compile(template: string): (context: TemplateContext) => string {
    return (context: TemplateContext) => this.render(template, context);
  }

  render(template: string, context: TemplateContext): string {
    const { openDelimiter = '{{', closeDelimiter = '}}' } = this.options;

    let result = template;

    // Process conditionals: {{#if condition}}...{{else}}...{{/if}}
    result = this.processConditionals(result, context);

    // Process loops: {{#each items}}...{{/each}}
    result = this.processLoops(result, context);

    // Process variables with filters: {{variable | filter | filter:arg}}
    result = this.processVariables(result, context);

    return result;
  }

  private processConditionals(template: string, context: TemplateContext): string {
    const regex = new RegExp(`${this.options.openDelimiter}#if\\s+(\\w+(?:\\.\\w+)*)\\s*${this.options.closeDelimiter}([\\s\\S]*?)(?:${this.options.openDelimiter}else${this.options.closeDelimiter}([\\s\\S]*?))?${this.options.openDelimiter}/if${this.options.closeDelimiter}`, 'g');

    return template.replace(regex, (_, conditionPath, truthyBlock, falsyBlock = '') => {
      const value = this.resolvePath(conditionPath, context);
      return this.isTruthy(value) ? truthyBlock : falsyBlock;
    });
  }

  private processLoops(template: string, context: TemplateContext): string {
    const regex = new RegExp(`${this.options.openDelimiter}#each\\s+(\\w+(?:\\.\\w+)*)\\s*${this.options.closeDelimiter}([\\s\\S]*?)${this.options.openDelimiter}/each${this.options.closeDelimiter}`, 'g');

    return template.replace(regex, (_, arrayPath, loopBody) => {
      const array = this.resolvePath(arrayPath, context);
      if (!Array.isArray(array)) return '';

      return array.map((item, index) => {
        const loopContext = { ...context, this: item, index, first: index === 0, last: index === array.length - 1 };
        return this.processVariables(loopBody, loopContext);
      }).join('');
    });
  }

  private processVariables(template: string, context: TemplateContext): string {
    const { openDelimiter = '{{', closeDelimiter = '}}' } = this.options;
    const regex = new RegExp(`${openDelimiter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([\\w.]+)(?:\\s*\\|\\s*([\\w:]+(?:\\s*:\\s*[\\w'"\\-]+)?)))?${closeDelimiter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');

    return template.replace(regex, (_, path: string, filterChain?: string) => {
      let value = this.resolvePath(path, context);

      if (filterChain) {
        const filterParts = filterChain.split('|').map((f: string) => f.trim());
        for (const part of filterParts) {
          const [filterName, ...args] = part.split(':').map((a: string) => a.trim());
          const filterFn = filters[filterName];
          if (filterFn) {
            const parsedArgs = args.map((a: string) => {
              if (a.startsWith("'") && a.endsWith("'")) return a.slice(1, -1);
              if (a.startsWith('"') && a.endsWith('"')) return a.slice(1, -1);
              return Number(a) || a;
            });
            value = filterFn(value, ...parsedArgs);
          }
        }
      }

      if (value === undefined || value === null) return '';
      if (this.options.escapeStrings && typeof value === 'string') {
        return this.escapeHtml(value);
      }
      return String(value);
    });
  }

  private resolvePath(path: string, context: TemplateContext): unknown {
    const keys = path.split('.');
    let current: unknown = context;

    for (const key of keys) {
      if (current === null || current === undefined) return undefined;
      current = (current as Record<string, unknown>)[key];
    }

    return current;
  }

  private isTruthy(value: unknown): boolean {
    if (value === null || value === undefined || value === false || value === 0 || value === '') return false;
    if (Array.isArray(value) && value.length === 0) return false;
    if (typeof value === 'object' && Object.keys(value as object).length === 0) return false;
    return true;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// ─── Singleton ───────────────────────────────────────────
const globalTemplateEngine = globalThis as unknown as { __templateEngine?: TemplateEngine };
export const templateEngine = globalTemplateEngine.__templateEngine || new TemplateEngine();
if (process.env.NODE_ENV !== 'production') {
  globalTemplateEngine.__templateEngine = templateEngine;
}

// ─── Convenience Functions ───────────────────────────────
export function renderTemplate(template: string, context: TemplateContext): string {
  return templateEngine.render(template, context);
}

export function compileTemplate(template: string): (context: TemplateContext) => string {
  return templateEngine.compile(template);
}
