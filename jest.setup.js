import '@testing-library/jest-dom';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
  useParams: () => ({}),
}));

jest.mock('next/server', () => ({
  NextRequest: jest.fn().mockImplementation((url: string, init?: RequestInit) => {
    const req = new Request(url, init);
    return {
      ...req,
      nextUrl: new URL(url.startsWith('http') ? url : `http://localhost${url}`),
      cookies: { get: jest.fn(), set: jest.fn(), delete: jest.fn() },
      json: () => req.json(),
    };
  }),
  NextResponse: {
    json: jest.fn().mockImplementation((body: unknown, init?: { status?: number }) => ({
      json: () => Promise.resolve(body),
      status: init?.status ?? 200,
      headers: new Map(),
    })),
  },
}));

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    workflow: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    execution: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
  })),
}));

global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});
