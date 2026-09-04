// Internationalization utilities

// ─── Types ───────────────────────────────────────────────
export type Locale = 'en' | 'es' | 'fr' | 'de' | 'ja' | 'zh' | 'ko' | 'pt' | 'ar' | 'hi';

export interface Translation {
  [key: string]: string | Translation;
}

export interface I18nConfig {
  defaultLocale: Locale;
  supportedLocales: Locale[];
  fallbackLocale: Locale;
}

export interface DateFormatOptions {
  dateStyle?: 'full' | 'long' | 'medium' | 'short';
  timeStyle?: 'full' | 'long' | 'medium' | 'short';
}

// ─── Translation Store ───────────────────────────────────
const translations = new Map<Locale, Translation>();
const config: I18nConfig = {
  defaultLocale: 'en',
  supportedLocales: ['en', 'es', 'fr', 'de', 'ja', 'zh', 'ko', 'pt', 'ar', 'hi'],
  fallbackLocale: 'en',
};

// ─── Translation Loader ──────────────────────────────────
export function loadTranslations(locale: Locale, data: Translation): void {
  const existing = translations.get(locale) || {};
  translations.set(locale, deepMerge(existing, data));
}

export function loadTranslationBundle(bundle: Record<Locale, Translation>): void {
  for (const [locale, data] of Object.entries(bundle)) {
    loadTranslations(locale as Locale, data);
  }
}

// ─── Message Formatting ──────────────────────────────────
function getNestedValue(obj: Translation, path: string): string | undefined {
  const keys = path.split('.');
  let current: string | Translation = obj;

  for (const key of keys) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = (current as Translation)[key];
    if (current === undefined) return undefined;
  }

  return typeof current === 'string' ? current : undefined;
}

export function t(key: string, params?: Record<string, string | number>, locale?: Locale): string {
  const effectiveLocale = locale || config.defaultLocale;
  const translationsForLocale = translations.get(effectiveLocale) || {};
  let value = getNestedValue(translationsForLocale, key);

  // Fallback to default locale
  if (value === undefined && effectiveLocale !== config.fallbackLocale) {
    const fallbackTranslations = translations.get(config.fallbackLocale) || {};
    value = getNestedValue(fallbackTranslations, key);
  }

  if (value === undefined) return key;

  // Interpolate parameters
  if (params) {
    return interpolateMessage(value, params);
  }

  return value;
}

export function interpolateMessage(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    return params[key] !== undefined ? String(params[key]) : `{${key}}`;
  });
}

// ─── Pluralization ───────────────────────────────────────
export function plural(key: string, count: number, params?: Record<string, string | number>, locale?: Locale): string {
  const pluralKey = count === 1 ? `${key}_one` : `${key}_other`;
  const result = t(pluralKey, { count, ...params }, locale);
  return result === pluralKey ? t(key, { count, ...params }, locale) : result;
}

// ─── Date/Number Formatting by Locale ────────────────────
export function formatDateByLocale(
  date: Date | string | number,
  locale?: Locale,
  options?: Intl.DateTimeFormatOptions & DateFormatOptions
): string {
  const effectiveLocale = locale || config.defaultLocale;
  return new Intl.DateTimeFormat(effectiveLocale, options).format(new Date(date));
}

export function formatNumberByLocale(
  number: number,
  locale?: Locale,
  options?: Intl.NumberFormatOptions
): string {
  const effectiveLocale = locale || config.defaultLocale;
  return new Intl.NumberFormat(effectiveLocale, options).format(number);
}

export function formatCurrencyByLocale(
  amount: number,
  currency: string = 'USD',
  locale?: Locale
): string {
  const effectiveLocale = locale || config.defaultLocale;
  return new Intl.NumberFormat(effectiveLocale, {
    style: 'currency',
    currency,
  }).format(amount);
}

export function formatPercentageByLocale(
  value: number,
  locale?: Locale,
  decimals: number = 1
): string {
  const effectiveLocale = locale || config.defaultLocale;
  return new Intl.NumberFormat(effectiveLocale, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

// ─── RTL Support ─────────────────────────────────────────
const RTL_LOCALES: Locale[] = ['ar'];

export function isRTL(locale?: Locale): boolean {
  const effectiveLocale = locale || config.defaultLocale;
  return RTL_LOCALES.includes(effectiveLocale);
}

export function getDirection(locale?: Locale): 'ltr' | 'rtl' {
  return isRTL(locale) ? 'rtl' : 'ltr';
}

// ─── Locale Detection ────────────────────────────────────
export function detectLocale(acceptLanguage?: string): Locale {
  if (!acceptLanguage) return config.defaultLocale;

  const preferred = acceptLanguage
    .split(',')
    .map((lang) => {
      const [code, q] = lang.trim().split(';q=');
      return { code: code.split('-')[0].toLowerCase(), quality: q ? parseFloat(q) : 1 };
    })
    .sort((a, b) => b.quality - a.quality);

  for (const { code } of preferred) {
    if (config.supportedLocales.includes(code as Locale)) {
      return code as Locale;
    }
  }

  return config.defaultLocale;
}

export function getSupportedLocales(): Locale[] {
  return [...config.supportedLocales];
}

export function setDefaultLocale(locale: Locale): void {
  if (config.supportedLocales.includes(locale)) {
    config.defaultLocale = locale;
  }
}

// ─── Utility ─────────────────────────────────────────────
function deepMerge(target: Translation, source: Translation): Translation {
  const result = { ...target };
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge((result[key] as Translation) || {}, source[key] as Translation);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

// ─── Load Default English Translations ───────────────────
loadTranslations('en', {
  common: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    create: 'Create',
    search: 'Search',
    loading: 'Loading...',
    noResults: 'No results found',
    confirm: 'Confirm',
    back: 'Back',
    next: 'Next',
    submit: 'Submit',
    success: 'Success',
    error: 'Error',
    warning: 'Warning',
    info: 'Info',
  },
  auth: {
    login: 'Login',
    logout: 'Logout',
    register: 'Register',
    forgotPassword: 'Forgot Password',
    resetPassword: 'Reset Password',
    verifyEmail: 'Verify Email',
  },
  workflow: {
    create: 'Create Workflow',
    execute: 'Execute',
    pause: 'Pause',
    resume: 'Resume',
    duplicate: 'Duplicate',
    delete: 'Delete Workflow',
  },
  execution: {
    pending: 'Pending',
    running: 'Running',
    success: 'Success',
    failed: 'Failed',
    cancelled: 'Cancelled',
  },
});
