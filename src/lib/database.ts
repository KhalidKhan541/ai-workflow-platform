import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { generateId } from './utils';

// ─── Types ───────────────────────────────────────────────
export type TransactionClient = Prisma.TransactionClient;

export interface SoftDeleteOptions {
  field?: string;
  deletedAt?: Date;
}

export interface BulkOperationResult<T> {
  created: T[];
  updated: T[];
  errors: { index: number; error: string }[];
}

export interface QueryBuilderOptions {
  where?: Prisma.WhereInput;
  orderBy?: Prisma.OrderByWithRelationInput | Prisma.OrderByWithRelationInput[];
  include?: Prisma.Include;
  select?: Prisma.Select;
  skip?: number;
  take?: number;
  cursor?: Prisma.WhereUniqueInput;
}

// ─── Soft Delete ─────────────────────────────────────────
export async function softDelete(
  model: string,
  id: string,
  options: SoftDeleteOptions = {}
): Promise<void> {
  const { field = 'deletedAt', deletedAt = new Date() } = options;
  await (prisma as any)[model].update({
    where: { id },
    data: { [field]: deletedAt },
  });
}

export function softDeleteWhere(options?: SoftDeleteOptions): Prisma.WhereInput {
  const { field = 'deletedAt' } = options || {};
  return { [field]: null };
}

export function includeActive(): { deletedAt: null } {
  return { deletedAt: null };
}

// ─── Bulk Operations ─────────────────────────────────────
export async function bulkCreate<T extends Record<string, any>>(
  model: string,
  data: T[],
  options?: { chunkSize?: number; skipDuplicates?: boolean }
): Promise<BulkOperationResult<any>> {
  const { chunkSize = 100, skipDuplicates = true } = options || {};
  const result: BulkOperationResult<any> = { created: [], updated: [], errors: [] };

  const chunks = chunkArray(data, chunkSize);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    try {
      const created = await (prisma as any)[model].createMany({
        data: chunk,
        skipDuplicates,
      });
      result.created.push(...Array(created.count).fill(null));
    } catch (error) {
      result.errors.push({
        index: i * chunkSize,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return result;
}

export async function bulkUpsert<T extends Record<string, any>>(
  model: string,
  data: T[],
  uniqueKey: string | string[],
  options?: { chunkSize?: number }
): Promise<BulkOperationResult<any>> {
  const { chunkSize = 50 } = options || {};
  const result: BulkOperationResult<any> = { created: [], updated: [], errors: [] };
  const chunks = chunkArray(data, chunkSize);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    for (const item of chunk) {
      try {
        const where = typeof uniqueKey === 'string'
          ? { [uniqueKey]: item[uniqueKey] }
          : Object.fromEntries(uniqueKey.map((k) => [k, item[k]]));

        const record = await (prisma as any)[model].upsert({
          where,
          create: item,
          update: item,
        });
        result.created.push(record);
      } catch (error) {
        result.errors.push({
          index: i * chunkSize + chunk.indexOf(item),
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  return result;
}

export async function bulkUpdate<T extends Record<string, any>>(
  model: string,
  data: T[],
  uniqueKey: string,
  updateFields: string[],
  options?: { chunkSize?: number }
): Promise<BulkOperationResult<any>> {
  const { chunkSize = 50 } = options || {};
  const result: BulkOperationResult<any> = { created: [], updated: [], errors: [] };
  const chunks = chunkArray(data, chunkSize);

  for (const chunk of chunks) {
    const promises = chunk.map(async (item) => {
      try {
        const updateData: Record<string, any> = {};
        for (const field of updateFields) {
          if (field in item) updateData[field] = item[field];
        }

        return await (prisma as any)[model].update({
          where: { [uniqueKey]: item[uniqueKey] },
          data: updateData,
        });
      } catch (error) {
        result.errors.push({
          index: data.indexOf(item),
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return null;
      }
    });

    const updated = (await Promise.all(promises)).filter(Boolean);
    result.updated.push(...updated);
  }

  return result;
}

// ─── Query Builder Helpers ───────────────────────────────
export function buildWhereCondition(
  filters: Record<string, unknown>,
  config?: Record<string, { type?: string; field?: string; operator?: string }>
): Prisma.WhereInput {
  const conditions: Prisma.WhereInput[] = [];

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue;

    const fieldConfig = config?.[key];
    const field = fieldConfig?.field || key;

    if (fieldConfig?.operator === 'contains') {
      conditions.push({ [field]: { contains: value, mode: 'insensitive' } });
    } else if (fieldConfig?.operator === 'gte') {
      conditions.push({ [field]: { gte: value } });
    } else if (fieldConfig?.operator === 'lte') {
      conditions.push({ [field]: { lte: value } });
    } else if (fieldConfig?.operator === 'in' && Array.isArray(value)) {
      conditions.push({ [field]: { in: value } });
    } else if (fieldConfig?.operator === 'gt') {
      conditions.push({ [field]: { gt: value } });
    } else if (fieldConfig?.operator === 'lt') {
      conditions.push({ [field]: { lt: value } });
    } else {
      conditions.push({ [field]: value });
    }
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

export function buildOrderBy(sortBy: string, sortOrder: 'asc' | 'desc' = 'desc'): Prisma.OrderByWithRelationInput {
  const parts = sortBy.split('.');
  let current: any = {};
  let obj = current;

  for (let i = 0; i < parts.length; i++) {
    if (i === parts.length - 1) {
      obj[parts[i]] = sortOrder;
    } else {
      obj[parts[i]] = {};
      obj = obj[parts[i]];
    }
  }

  return current;
}

export function buildPagination(page: number = 1, limit: number = 20): { skip: number; take: number } {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  return { skip: (safePage - 1) * safeLimit, take: safeLimit };
}

// ─── Transaction Wrapper ─────────────────────────────────
export async function transaction<T>(
  fn: (tx: TransactionClient) => Promise<T>,
  options?: { maxWait?: number; timeout?: number }
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    try {
      return await fn(tx);
    } catch (error) {
      throw error;
    }
  }, {
    maxWait: options?.maxWait ?? 10000,
    timeout: options?.timeout ?? 30000,
  });
}

export async function transactional<T>(
  fn: (tx: TransactionClient) => Promise<T>
): Promise<T> {
  return transaction(fn);
}

// ─── Migration Helpers ───────────────────────────────────
export async function runMigration(
  name: string,
  up: (tx: TransactionClient) => Promise<void>,
  down: (tx: TransactionClient) => Promise<void>
): Promise<void> {
  const migration = await prisma.migration.findFirst({
    where: { name },
  });

  if (migration?.appliedAt) {
    console.log(`Migration ${name} already applied`);
    return;
  }

  await transaction(async (tx) => {
    await up(tx);
    await (tx as any).migration.create({
      data: {
        name,
        appliedAt: new Date(),
      },
    });
  });

  console.log(`Migration ${name} applied successfully`);
}

// ─── Seed Utilities ──────────────────────────────────────
export async function seed<T>(
  model: string,
  data: T[],
  options?: { onConflict?: 'skip' | 'update'; uniqueKey?: string }
): Promise<{ created: number; skipped: number; updated: number }> {
  const { onConflict = 'skip', uniqueKey = 'id' } = options || {};
  let created = 0;
  let skipped = 0;
  let updated = 0;

  for (const item of data) {
    try {
      const existing = await (prisma as any)[model].findUnique({
        where: { [uniqueKey]: (item as any)[uniqueKey] },
      });

      if (existing) {
        if (onConflict === 'update') {
          await (prisma as any)[model].update({
            where: { [uniqueKey]: (item as any)[uniqueKey] },
            data: item,
          });
          updated++;
        } else {
          skipped++;
        }
      } else {
        await (prisma as any)[model].create({ data: item });
        created++;
      }
    } catch (error) {
      console.error(`Seed error for ${model}:`, error);
      skipped++;
    }
  }

  return { created, skipped, updated };
}

// ─── Utility ─────────────────────────────────────────────
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export { generateId as generateId };
