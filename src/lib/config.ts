import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional().default("redis://localhost:6379"),
  OPENAI_API_KEY: z.string().startsWith("sk-"),
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().startsWith("re_").optional(),
  APP_NAME: z.string().default("AI Workflow Platform"),
  APP_DESCRIPTION: z.string().default("Enterprise Workflow Automation"),
  VERCEL_URL: z.string().optional(),
  LOG_LEVEL: z
    .enum(["debug", "info", "warn", "error"])
    .default("info"),
  SESSION_MAX_AGE: z.coerce.number().default(30 * 24 * 60 * 60),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  BULLMQ_CONNECTION: z.string().url().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  ENCRYPTION_KEY: z.string().min(32).optional(),
  ALLOWED_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform((s) => s.split(",")),
  MAX_FILE_SIZE_MB: z.coerce.number().default(10),
  AI_DEFAULT_MODEL: z.string().default("gpt-4"),
  AI_MAX_TOKENS: z.coerce.number().default(4096),
});

type EnvSchema = z.infer<typeof envSchema>;

function validateEnv(): EnvSchema {
  if (process.env.NEXT_PUBLIC_SKIP_ENV_VALIDATION === "true") {
    return envSchema.parse({}) as EnvSchema;
  }

  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("\n");
      throw new Error(
        `❌ Invalid environment variables:\n${missingVars}\n\nCheck .env or .env.local file.`
      );
    }
    throw error;
  }
}

let cachedEnv: EnvSchema | null = null;

export function getEnv(): EnvSchema {
  if (!cachedEnv) {
    cachedEnv = validateEnv();
  }
  return cachedEnv;
}

export const env = getEnv();

export const config = {
  app: {
    name: env.APP_NAME,
    description: env.APP_DESCRIPTION,
    url: env.NEXTAUTH_URL,
    env: env.NODE_ENV,
    isDev: env.NODE_ENV === "development",
    isProd: env.NODE_ENV === "production",
    isTest: env.NODE_ENV === "test",
  },
  auth: {
    secret: env.NEXTAUTH_SECRET,
    maxAge: env.SESSION_MAX_AGE,
    providers: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
      },
    },
  },
  database: {
    url: env.DATABASE_URL,
  },
  redis: {
    url: env.REDIS_URL,
  },
  ai: {
    apiKey: env.OPENAI_API_KEY,
    defaultModel: env.AI_DEFAULT_MODEL,
    maxTokens: env.AI_MAX_TOKENS,
  },
  stripe: {
    secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
  },
  email: {
    apiKey: env.RESEND_API_KEY,
    smtp: {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  },
  s3: {
    bucket: env.S3_BUCKET,
    region: env.S3_REGION,
    accessKey: env.S3_ACCESS_KEY,
    secretKey: env.S3_SECRET_KEY,
  },
  security: {
    encryptionKey: env.ENCRYPTION_KEY,
    allowedOrigins: env.ALLOWED_ORIGINS,
    rateLimitMax: env.RATE_LIMIT_MAX,
    rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
  },
  upload: {
    maxFileSizeMB: env.MAX_FILE_SIZE_MB,
  },
  logging: {
    level: env.LOG_LEVEL,
  },
} as const;

export type AppConfig = typeof config;
