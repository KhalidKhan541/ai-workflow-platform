import { GET, POST, DELETE } from '@/app/api/integrations/route';

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

describe('/api/integrations', () => {
  describe('GET', () => {
    it('should return list of integrations', async () => {
      const req = createMockRequest('/api/integrations');
      const res = await GET(req);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBeGreaterThan(0);
    });

    it('should filter by category', async () => {
      const req = createMockRequest('/api/integrations?category=messaging');
      const res = await GET(req);
      const data = await res.json();

      data.data.forEach((int: any) => {
        expect(int.category).toBe('messaging');
      });
    });

    it('should search integrations', async () => {
      const req = createMockRequest('/api/integrations?search=Slack');
      const res = await GET(req);
      const data = await res.json();

      expect(data.data.length).toBeGreaterThan(0);
      expect(data.data[0].displayName).toContain('Slack');
    });

    it('should paginate results', async () => {
      const req = createMockRequest('/api/integrations?page=1&limit=1');
      const res = await GET(req);
      const data = await res.json();

      expect(data.meta.limit).toBe(1);
    });
  });

  describe('POST', () => {
    it('should create integration config', async () => {
      const body = {
        integrationId: 'int-1',
        name: 'My Config',
        credentials: { apiKey: 'abc123' },
      };
      const req = createMockRequest('/api/integrations', 'POST', body);
      const res = await POST(req);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.data.name).toBe('My Config');
      expect(data.data.isActive).toBe(true);
    });

    it('should include settings', async () => {
      const body = {
        integrationId: 'int-1',
        name: 'Config with settings',
        credentials: { token: 'xyz' },
        settings: { channel: '#general' },
      };
      const req = createMockRequest('/api/integrations', 'POST', body);
      const res = await POST(req);
      const data = await res.json();

      expect(data.data.settings).toEqual({ channel: '#general' });
    });

    it('should reject invalid data', async () => {
      const req = createMockRequest('/api/integrations', 'POST', { name: '' });
      const res = await POST(req);
      const data = await res.json();

      expect(data.success).toBe(false);
    });
  });

  describe('DELETE', () => {
    it('should delete a config', async () => {
      const req = createMockRequest('/api/integrations?id=cfg-1', 'DELETE');
      const res = await DELETE(req);
      const data = await res.json();

      expect(data.success).toBe(true);
    });

    it('should return 400 without ID', async () => {
      const req = createMockRequest('/api/integrations', 'DELETE');
      const res = await DELETE(req);
      const data = await res.json();

      expect(data.success).toBe(false);
    });
  });
});
