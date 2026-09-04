import { GET, POST, PUT, DELETE } from '@/app/api/workflows/route';

function createMockRequest(url: string, method: string = 'GET', body?: unknown) {
  const headers = new Headers();
  if (body) headers.set('Content-Type', 'application/json');
  return {
    nextUrl: new URL(url.startsWith('http') ? url : `http://localhost${url}`),
    json: jest.fn().mockResolvedValue(body),
    headers,
    method,
  } as any;
}

describe('/api/workflows', () => {
  describe('GET', () => {
    it('should return paginated workflows', async () => {
      const req = createMockRequest('/api/workflows?page=1&limit=10');
      const res = await GET(req);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.meta).toBeDefined();
      expect(data.meta.page).toBe(1);
      expect(data.meta.limit).toBe(10);
    });

    it('should filter by search term', async () => {
      const req = createMockRequest('/api/workflows?search=Email');
      const res = await GET(req);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.data.length).toBeGreaterThan(0);
      expect(data.data[0].name).toContain('Email');
    });

    it('should return empty for unmatched search', async () => {
      const req = createMockRequest('/api/workflows?search=nonexistent');
      const res = await GET(req);
      const data = await res.json();

      expect(data.data).toHaveLength(0);
    });

    it('should handle missing query params with defaults', async () => {
      const req = createMockRequest('/api/workflows');
      const res = await GET(req);
      const data = await res.json();

      expect(data.meta.page).toBe(1);
      expect(data.meta.limit).toBe(20);
    });
  });

  describe('POST', () => {
    it('should create a new workflow', async () => {
      const body = {
        name: 'Test Workflow',
        steps: [{ id: 's1', type: 'action', name: 'Step 1', config: {} }],
      };
      const req = createMockRequest('/api/workflows', 'POST', body);
      const res = await POST(req);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.data.name).toBe('Test Workflow');
      expect(data.data.status).toBe('DRAFT');
      expect(data.data.id).toBeDefined();
    });

    it('should reject invalid workflow data', async () => {
      const req = createMockRequest('/api/workflows', 'POST', { name: '' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain('Validation');
    });

    it('should reject workflow with no steps', async () => {
      const req = createMockRequest('/api/workflows', 'POST', { name: 'Test', steps: [] });
      const res = await POST(req);
      const data = await res.json();

      expect(data.success).toBe(false);
    });
  });

  describe('PUT', () => {
    it('should update a workflow', async () => {
      const req = createMockRequest('/api/workflows?id=wf-1', 'PUT', { name: 'Updated' });
      const res = await PUT(req);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.data.name).toBe('Updated');
    });

    it('should return 404 for non-existent workflow', async () => {
      const req = createMockRequest('/api/workflows?id=nonexistent', 'PUT', { name: 'Test' });
      const res = await PUT(req);
      const data = await res.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain('not found');
    });

    it('should return 400 without ID', async () => {
      const req = createMockRequest('/api/workflows', 'PUT', { name: 'Test' });
      const res = await PUT(req);
      const data = await res.json();

      expect(data.success).toBe(false);
    });
  });

  describe('DELETE', () => {
    it('should return success for delete', async () => {
      const req = createMockRequest('/api/workflows?id=wf-1', 'DELETE');
      const res = await DELETE(req);
      const data = await res.json();

      expect(data.success).toBe(true);
    });

    it('should return 400 without ID', async () => {
      const req = createMockRequest('/api/workflows', 'DELETE');
      const res = await DELETE(req);
      const data = await res.json();

      expect(data.success).toBe(false);
    });
  });
});
