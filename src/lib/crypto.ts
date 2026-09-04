// Cryptography utilities for password hashing, JWT, encryption

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { generateId } from './utils';

// ─── Types ───────────────────────────────────────────────
export interface JWTOptions {
  expiresIn?: number;
  issuer?: string;
  audience?: string;
}

export interface JWTayload {
  sub: string;
  iat: number;
  exp: number;
  iss?: string;
  aud?: string;
  [key: string]: unknown;
}

export interface APIKeyResult {
  key: string;
  prefix: string;
  hash: string;
}

// ─── Password Hashing ────────────────────────────────────
const BCRYPT_ROUNDS = 12;

export async function hashPassword(password: string, rounds: number = BCRYPT_ROUNDS): Promise<string> {
  return bcrypt.hash(password, rounds);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── JWT Signing/Verification ────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_ALGORITHM = 'HS256';

function base64UrlEncode(data: string): string {
  return Buffer.from(data)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64UrlDecode(data: string): string {
  let base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64').toString();
}

export function signJWT(payload: Record<string, unknown>, options: JWTOptions = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const jwtPayload: JWTayload = {
    sub: (payload.sub as string) || '',
    iat: now,
    exp: options.expiresIn ? now + options.expiresIn : now + 3600,
    iss: options.issuer || 'ai-workflow-platform',
    aud: options.audience || 'ai-workflow-platform',
    ...payload,
  };

  const header = { alg: JWT_ALGORITHM, typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(jwtPayload));

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyJWT(token: string): { valid: boolean; payload?: JWTayload; error?: string } {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return { valid: false, error: 'Invalid token format' };

    const [encodedHeader, encodedPayload, signature] = parts;

    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    if (signature !== expectedSignature) {
      return { valid: false, error: 'Invalid signature' };
    }

    const payload: JWTayload = JSON.parse(base64UrlDecode(encodedPayload));

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false, error: 'Token expired' };
    }

    return { valid: true, payload };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Token verification failed' };
  }
}

// ─── API Key Generation ──────────────────────────────────
export function generateAPIKey(prefix: string = 'awp'): APIKeyResult {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = '';
  for (let i = 0; i < 48; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  const fullKey = `${prefix}_${key}`;
  const shortPrefix = fullKey.substring(0, 12);
  const hash = crypto.createHash('sha256').update(fullKey).digest('hex');

  return { key: fullKey, prefix: shortPrefix, hash };
}

export function maskAPIKey(key: string): string {
  return key.substring(0, 12) + '...' + key.substring(key.length - 4);
}

// ─── AES Encryption/Decryption ───────────────────────────
const AES_ALGORITHM = 'aes-256-gcm';
const AES_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex').slice(0, 32);

export function encrypt(text: string, key?: string): string {
  const cipherKey = key || AES_KEY;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(AES_ALGORITHM, Buffer.from(cipherKey, 'utf-8'), iv);

  let encrypted = cipher.update(text, 'utf-8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decrypt(encryptedData: string, key?: string): string {
  const cipherKey = key || AES_KEY;
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(AES_ALGORITHM, Buffer.from(cipherKey, 'utf-8'), iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf-8');
  decrypted += decipher.final('utf-8');

  return decrypted;
}

// ─── HMAC Signing ────────────────────────────────────────
export function signHMAC(data: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

export function verifyHMAC(data: string, signature: string, secret: string): boolean {
  const expected = signHMAC(data, secret);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

// ─── Random Token Generation ─────────────────────────────
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

export function generateVerificationCode(length: number = 6): string {
  const digits = '0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += digits.charAt(Math.floor(Math.random() * digits.length));
  }
  return code;
}

export function generateResetToken(): { token: string; hash: string } {
  const token = generateToken(32);
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

// ─── Utility Functions ───────────────────────────────────
export function hashSHA256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function hashMD5(data: string): string {
  return crypto.createHash('md5').update(data).digest('hex');
}

export function generateSalt(rounds: number = 10): string {
  return bcrypt.genSaltSync(rounds);
}

export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
