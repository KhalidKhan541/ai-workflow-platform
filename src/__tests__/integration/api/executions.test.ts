import { GET, POST, DELETE } from '@/app/api/executions/route';

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

describe('/api/executions', () => {
  describe('GET', () => {
    it('should return paginated executions', async () => {
      const req = createMockRequest('/api/executions');
      const res = await GET(req);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.meta).toBeDefined();
    });

    it('should filter by workflowId', async () => {
      const req = createMockRequest('/api/executions?workflowId=wf-1');
      const res = await GET(req);
      const data = await res.json();

      expect(data.success).toBe(true);
      data.data.forEach((exec: any) => {
        expect(exec.workflowId).toBe('wf-1');
      });
    });

    it('should filter by status', async () => {
      const req = createMockRequest('/api/executions?status=SUCCESS');
      const res = await GET(req);
      const data = await res.json();

      data.data.forEach((exec: any) => {
        expect(exec.status).toBe('SUCCESS');
      });
    });

    it('should paginate results', async () => {
      const req = createMockRequest('/api/executions?page=1&limit=1');
      const res = await GET(req);
      const data = await res.json();

      expect(data.meta.limit).toBe(1);
      expect(data.data.length).toBeLessThanOrEqual(1);
    });
  });

  describe('POST', () => {
    it('should create a new execution', async () => {
      const req = createMockRequest('/api/executions', 'POST', { workflowId: 'wf-1' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.data.workflowId).toBe('wf-1');
      expect(data.data.status).toBe('PENDING');
      expect(data.data.id).toBeDefined();
    });

    it('should include input data', async () => {
      const req = createMockRequest('/api/executions', 'POST', {
        workflowId: 'wf-1',
        input: { key: 'value' },
      });
      const res = await POST(req);
      const data = await res.json();

      expect(data.data.input).toEqual({ key: 'value' });
    });

    it('should reject without workflowId', async () => {
      const req = createMockRequest('/api/executions', 'POST', {});
      const res = await POST(req);
      const data = await res.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain('workflowId');
    });
  });

  describe('DELETE', () => {
    it('should delete an execution', async () => {
      const req = createMockRequest('/api/executions?id=exec-1', 'DELETE');
      const res = await DELETE(req);
      const data = await res.json();

      expect(data.success).toBe(true);
    });

    it('should return 400 without ID', async () => {
      const req = createMockRequest('/api/executions', 'DELETE');
      const res = await DELETE(req);
      const data = await res.json();

      expect(data.success).toBe(false);
    });
  });
});
