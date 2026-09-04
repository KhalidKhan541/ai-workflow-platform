import { Prisma, PrismaClient } from "@prisma/client";
import { logger } from "./logger";

const log = logger.child("prisma");

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: [
      { level: "query", emit: "event" },
      { level: "error", emit: "event" },
      { level: "warn", emit: "event" },
    ],
    errorFormat: "minimal",
  });

  client.$on("query", (e) => {
    if (process.env.NODE_ENV === "development") {
      log.debug("Query", {
        query: e.query,
        duration: e.duration,
        params: e.params,
      });
    }
  });

  client.$on("error", (e) => {
    log.error("Prisma error", {
      message: e.message,
      target: e.target,
    });
  });

  client.$on("warn", (e) => {
    log.warn("Prisma warning", {
      message: e.message,
    });
  });

  return client;
}

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export type PrismaTransactionClient = Prisma.TransactionClient;

export async function executeTransaction<T>(
  fn: (tx: PrismaTransactionClient) => Promise<T>,
  options?: {
    maxWait?: number;
    timeout?: number;
    isolationLevel?: Prisma.TransactionIsolationLevel;
  }
): Promise<T> {
  const startTime = performance.now();
  try {
    const result = await prisma.$transaction(fn, {
      maxWait: options?.maxWait ?? 5000,
      timeout: options?.timeout ?? 10000,
      isolationLevel: options?.isolationLevel,
    });
    const duration = Math.round(performance.now() - startTime);
    log.debug("Transaction completed", { duration });
    return result;
  } catch (error) {
    const duration = Math.round(performance.now() - startTime);
    log.error("Transaction failed", { duration, error: String(error) });
    throw error;
  }
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export async function paginate<T>(
  model: { findMany: (args: unknown) => Promise<T[]>; count: (args: unknown) => Promise<number> },
  options: PaginationOptions & {
    where?: Prisma.Args<typeof model, "findMany">["where"];
    include?: Prisma.Args<typeof model, "findMany">["include"];
    select?: Prisma.Args<typeof model, "findMany">["select"];
  }
): Promise<PaginatedResult<T>> {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));
  const skip = (page - 1) * limit;
  const sortBy = options.sortBy ?? "createdAt";
  const sortOrder = options.sortOrder ?? "desc";

  const [data, total] = await Promise.all([
    model.findMany({
      where: options.where,
      include: options.include,
      select: options.select,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder } as Prisma.Args<typeof model, "findMany">["orderBy"],
    }),
    model.count({ where: options.where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

export async function softDelete(
  model: { update: (args: unknown) => Promise<unknown> },
  id: string,
  options?: { field?: string }
): Promise<void> {
  const field = options?.field ?? "isDeleted";
  await model.update({
    where: { id },
    data: {
      [field]: true,
      deletedAt: new Date(),
    } as Record<string, unknown>,
  } as never);
  log.debug("Soft delete", { id, field });
}

export async function bulkSoftDelete(
  model: { updateMany: (args: unknown) => Promise<Prisma.BatchPayload> },
  ids: string[],
  options?: { field?: string }
): Promise<Prisma.BatchPayload> {
  const field = options?.field ?? "isDeleted";
  const result = await model.updateMany({
    where: { id: { in: ids } },
    data: {
      [field]: true,
      deletedAt: new Date(),
    } as Record<string, unknown>,
  } as never);
  log.debug("Bulk soft delete", { count: result.count, field });
  return result;
}

export async function findManyWithDeleted<T extends Record<string, unknown>>(
  model: { findMany: (args: unknown) => Promise<T[]> },
  options?: {
    where?: Prisma.Args<typeof model, "findMany">["where"];
    include?: Prisma.Args<typeof model, "findMany">["include"];
    skip?: number;
    take?: number;
    orderBy?: Prisma.Args<typeof model, "findMany">["orderBy"];
  }
): Promise<T[]> {
  return model.findMany({
    ...options,
  } as never) as Promise<T[]>;
}

export async function findUniqueOrThrow(
  model: { findUniqueOrThrow: (args: unknown) => Promise<unknown> },
  args: { where: Record<string, unknown> }
): Promise<unknown> {
  try {
    return await model.findUniqueOrThrow(args as never);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return null;
    }
    throw error;
  }
}

export async function upsert<T>(
  model: {
    upsert: (args: unknown) => Promise<T>;
  },
  args: {
    where: Record<string, unknown>;
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  }
): Promise<T> {
  return model.upsert(args as never);
}

export async function countWithFilter(
  model: { count: (args: unknown) => Promise<number> },
  where?: Prisma.Args<typeof model, "count">["where"]
): Promise<number> {
  return model.count({ where } as never);
}

export async function exists(
  model: { count: (args: unknown) => Promise<number> },
  where: Prisma.Args<typeof model, "count">["where"]
): Promise<boolean> {
  const count = await model.count({ where } as never);
  return count > 0;
}

export { Prisma };
export default prisma;
