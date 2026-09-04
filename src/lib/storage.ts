// File storage utilities with S3 and local filesystem support

import { generateId, getFileExtension, formatFileSize } from './utils';
import { cache } from './cache';

// ─── Types ───────────────────────────────────────────────
export interface StorageConfig {
  provider: 'local' | 's3';
  local?: { uploadDir: string; baseUrl: string };
  s3?: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    endpoint?: string;
  };
  maxFileSize?: number;
  allowedTypes?: string[];
}

export interface UploadOptions {
  folder?: string;
  filename?: string;
  contentType?: string;
  metadata?: Record<string, string>;
  visibility?: 'public' | 'private';
  overwrite?: boolean;
}

export interface UploadResult {
  key: string;
  url: string;
  size: number;
  contentType: string;
  etag?: string;
  metadata?: Record<string, string>;
}

export interface FileValidation {
  valid: boolean;
  error?: string;
  size?: number;
  contentType?: string;
}

export interface StorageQuota {
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
}

export interface PresignedUrlOptions {
  expiresIn?: number;
  contentType?: string;
}

// ─── File Type Validation ────────────────────────────────
const MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp',
  pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv', txt: 'text/plain', json: 'application/json',
  zip: 'application/zip', mp4: 'video/mp4', mp3: 'audio/mpeg',
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB default
const ALLOWED_TYPES = Object.keys(MIME_TYPES);

export function validateFile(
  filename: string,
  size: number,
  options?: { maxSize?: number; allowedTypes?: string[] }
): FileValidation {
  const { maxSize = MAX_FILE_SIZE, allowedTypes = ALLOWED_TYPES } = options || {};
  const ext = getFileExtension(filename);

  if (!allowedTypes.includes(ext) && !allowedTypes.some((t) => MIME_TYPES[ext]?.startsWith(t))) {
    return { valid: false, error: `File type '.${ext}' is not allowed` };
  }

  if (size > maxSize) {
    return { valid: false, error: `File size ${formatFileSize(size)} exceeds limit ${formatFileSize(maxSize)}` };
  }

  return { valid: true, size, contentType: MIME_TYPES[ext] || 'application/octet-stream' };
}

// ─── Local Storage ───────────────────────────────────────
class LocalStorage {
  private uploadDir: string;
  private baseUrl: string;
  private files = new Map<string, { path: string; size: number; contentType: string; metadata?: Record<string, string> }>();

  constructor(config: NonNullable<StorageConfig['local']>) {
    this.uploadDir = config.uploadDir;
    this.baseUrl = config.baseUrl;
  }

  async upload(buffer: Buffer, options: UploadOptions = {}): Promise<UploadResult> {
    const ext = getFileExtension(options.filename || 'file.bin');
    const key = `${options.folder || 'uploads'}/${generateId()}.${ext}`;
    const contentType = options.contentType || MIME_TYPES[ext] || 'application/octet-stream';

    this.files.set(key, { path: `${this.uploadDir}/${key}`, size: buffer.length, contentType, metadata: options.metadata });

    return { key, url: `${this.baseUrl}/${key}`, size: buffer.length, contentType, metadata: options.metadata };
  }

  async download(key: string): Promise<Buffer | null> {
    const file = this.files.get(key);
    if (!file) return null;
    return Buffer.from(`Mock content for ${key}`);
  }

  async delete(key: string): Promise<boolean> {
    return this.files.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.files.has(key);
  }

  async getMetadata(key: string): Promise<Record<string, string> | null> {
    return this.files.get(key)?.metadata || null;
  }

  async getPresignedUrl(key: string, _options?: PresignedUrlOptions): Promise<string> {
    return `${this.baseUrl}/${key}`;
  }

  async listFiles(prefix?: string): Promise<string[]> {
    return Array.from(this.files.keys()).filter((k) => !prefix || k.startsWith(prefix));
  }
}

// ─── S3 Storage (Stub) ──────────────────────────────────
class S3Storage {
  constructor(private config: NonNullable<StorageConfig['s3']>) {}

  async upload(buffer: Buffer, options: UploadOptions = {}): Promise<UploadResult> {
    const ext = getFileExtension(options.filename || 'file.bin');
    const key = `${options.folder || 'uploads'}/${generateId()}.${ext}`;
    const contentType = options.contentType || MIME_TYPES[ext] || 'application/octet-stream';

    // In production, use @aws-sdk/client-s3
    return { key, url: `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${key}`, size: buffer.length, contentType };
  }

  async download(key: string): Promise<Buffer | null> {
    // In production, use S3 GetObjectCommand
    return Buffer.from(`Mock content for ${key}`);
  }

  async delete(key: string): Promise<boolean> {
    // In production, use S3 DeleteObjectCommand
    return true;
  }

  async exists(key: string): Promise<boolean> {
    return true;
  }

  async getMetadata(key: string): Promise<Record<string, string> | null> {
    return null;
  }

  async getPresignedUrl(key: string, options?: PresignedUrlOptions): Promise<string> {
    // In production, use @aws-sdk/s3-request-presigner
    return `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${key}?presigned`;
  }

  async listFiles(prefix?: string): Promise<string[]> {
    return [];
  }
}

// ─── Storage Client ──────────────────────────────────────
type StorageProvider = LocalStorage | S3Storage;

class StorageClient {
  private provider: StorageProvider;
  private config: StorageConfig;
  private quotas = new Map<string, number>();

  constructor(config: StorageConfig) {
    this.config = config;
    this.provider = config.provider === 's3'
      ? new S3Storage(config.s3!)
      : new LocalStorage(config.local || { uploadDir: './uploads', baseUrl: '/api/files' });
  }

  async upload(buffer: Buffer, options: UploadOptions = {}): Promise<UploadResult> {
    const filename = options.filename || 'file.bin';
    const validation = validateFile(filename, buffer.length, {
      maxSize: this.config.maxFileSize,
      allowedTypes: this.config.allowedTypes,
    });

    if (!validation.valid) {
      throw new Error(validation.error);
    }

    return this.provider.upload(buffer, options);
  }

  async uploadStream(stream: NodeJS.ReadableStream, options: UploadOptions & { size?: number }): Promise<UploadResult> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return this.upload(Buffer.concat(chunks), options);
  }

  async download(key: string): Promise<Buffer | null> {
    return this.provider.download(key);
  }

  async delete(key: string): Promise<boolean> {
    return this.provider.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.provider.exists(key);
  }

  async getPresignedUrl(key: string, options?: PresignedUrlOptions): Promise<string> {
    return this.provider.getPresignedUrl(key, options);
  }

  async getQuota(orgId: string, limit: number = 1024 * 1024 * 1024): Promise<StorageQuota> {
    const used = this.quotas.get(orgId) || 0;
    return { used, limit, remaining: Math.max(0, limit - used), percentage: (used / limit) * 100 };
  }

  async updateQuota(orgId: string, sizeDelta: number): Promise<void> {
    const current = this.quotas.get(orgId) || 0;
    this.quotas.set(orgId, Math.max(0, current + sizeDelta));
  }
}

// ─── Image Resizing (Stub) ──────────────────────────────
export async function resizeImage(
  buffer: Buffer,
  options: { width?: number; height?: number; quality?: number; format?: 'jpeg' | 'png' | 'webp' }
): Promise<Buffer> {
  // In production, use sharp library
  return buffer;
}

// ─── Singleton ───────────────────────────────────────────
const globalStorage = globalThis as unknown as { __storageClient?: StorageClient };
export const storage = globalStorage.__storageClient || new StorageClient({
  provider: 'local',
  local: { uploadDir: './uploads', baseUrl: '/api/files' },
});
if (process.env.NODE_ENV !== 'production') {
  globalStorage.__storageClient = storage;
}
