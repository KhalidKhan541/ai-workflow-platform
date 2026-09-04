import { ActionHandler } from '@/lib/workflow/actions';

describe('ActionHandler', () => {
  let handler: ActionHandler;

  beforeEach(() => {
    handler = new ActionHandler();
    jest.restoreAllMocks();
  });

  describe('HTTP request action', () => {
    it('should make a GET request', async () => {
      const mockResponse = { ok: true, status: 200, statusText: 'OK', headers: new Map([['content-type', 'application/json']]), json: jest.fn().mockResolvedValue({ data: 'test' }) };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await handler.execute('http_request', { url: 'http://api.test/endpoint', method: 'GET' });
      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(global.fetch).toHaveBeenCalledWith('http://api.test/endpoint', expect.objectContaining({ method: 'GET' }));
    });

    it('should make a POST request with body', async () => {
      const mockResponse = { ok: true, status: 201, statusText: 'Created', headers: new Map([['content-type', 'application/json']]), json: jest.fn().mockResolvedValue({ id: 1 }) };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await handler.execute('http_request', {
        url: 'http://api.test/create',
        method: 'POST',
        body: { name: 'test' },
      });

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith('http://api.test/create', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'test' }),
      }));
    });

    it('should handle HTTP errors', async () => {
      const mockResponse = { ok: false, status: 404, statusText: 'Not Found', headers: new Map([['content-type', 'text/plain']]), text: jest.fn().mockResolvedValue('Not found') };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await handler.execute('http_request', { url: 'http://api.test/missing' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('404');
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await handler.execute('http_request', { url: 'http://api.test/fail' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should fail without URL', async () => {
      const result = await handler.execute('http_request', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('URL is required');
    });

    it('should include custom headers', async () => {
      const mockResponse = { ok: true, status: 200, statusText: 'OK', headers: new Map([['content-type', 'text/html']]), text: jest.fn().mockResolvedValue('<html>') };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await handler.execute('http_request', {
        url: 'http://api.test',
        headers: { Authorization: 'Bearer token123' },
      });

      expect(global.fetch).toHaveBeenCalledWith('http://api.test', expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer token123' }),
      }));
    });
  });

  describe('email send action', () => {
    it('should send an email successfully', async () => {
      const result = await handler.execute('email_send', {
        to: 'test@example.com',
        subject: 'Hello',
        body: 'World',
      });

      expect(result.success).toBe(true);
      expect(result.output).toHaveProperty('messageId');
      expect(result.output).toHaveProperty('sentAt');
    });

    it('should send to multiple recipients', async () => {
      const result = await handler.execute('email_send', {
        to: ['a@test.com', 'b@test.com'],
        subject: 'Broadcast',
        body: 'Hello all',
      });

      expect(result.success).toBe(true);
      expect((result.output as any).to).toHaveLength(2);
    });

    it('should fail without recipient', async () => {
      const result = await handler.execute('email_send', { subject: 'Hi', body: 'Content' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Recipient');
    });

    it('should fail without subject', async () => {
      const result = await handler.execute('email_send', { to: 'a@b.com', body: 'Content' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Subject');
    });

    it('should fail without body', async () => {
      const result = await handler.execute('email_send', { to: 'a@b.com', subject: 'Hi' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('body');
    });
  });

  describe('delay action', () => {
    it('should delay for specified duration', async () => {
      const start = Date.now();
      const result = await handler.execute('delay', { durationMs: 50 });
      const elapsed = Date.now() - start;

      expect(result.success).toBe(true);
      expect(elapsed).toBeGreaterThanOrEqual(40);
    });

    it('should default to 1000ms', async () => {
      const result = await handler.execute('delay', {});
      expect(result.success).toBe(true);
      expect((result.output as any).delayedMs).toBe(1000);
    });

    it('should clamp to max 300000ms', async () => {
      const result = await handler.execute('delay', { durationMs: 999999 });
      expect((result.output as any).delayedMs).toBe(300000);
    });

    it('should clamp negative to 0ms', async () => {
      const result = await handler.execute('delay', { durationMs: -100 });
      expect((result.output as any).delayedMs).toBe(0);
    });
  });

  describe('data transformation action', () => {
    it('should return identity transform', async () => {
      const result = await handler.execute('data_transform', { input: { a: 1 }, operation: 'identity' });
      expect(result.success).toBe(true);
      expect(result.output).toEqual({ a: 1 });
    });

    it('should map array fields', async () => {
      const result = await handler.execute('data_transform', {
        input: [{ name: 'a' }, { name: 'b' }],
        operation: 'map',
        config: { field: 'name' },
      });
      expect(result.output).toEqual(['a', 'b']);
    });

    it('should filter array', async () => {
      const result = await handler.execute('data_transform', {
        input: [{ status: 'active' }, { status: 'inactive' }, { status: 'active' }],
        operation: 'filter',
        config: { field: 'status', value: 'active' },
      });
      expect(result.output).toHaveLength(2);
    });

    it('should flatten nested arrays', async () => {
      const result = await handler.execute('data_transform', {
        input: [[1, 2], [3, 4]],
        operation: 'flatten',
      });
      expect(result.output).toEqual([1, 2, 3, 4]);
    });

    it('should sort array ascending', async () => {
      const result = await handler.execute('data_transform', {
        input: [3, 1, 2],
        operation: 'sort',
        config: { order: 'asc' },
      });
      expect(result.output).toEqual([1, 2, 3]);
    });

    it('should sort array descending', async () => {
      const result = await handler.execute('data_transform', {
        input: [3, 1, 2],
        operation: 'sort',
        config: { order: 'desc' },
      });
      expect(result.output).toEqual([3, 2, 1]);
    });

    it('should group by field', async () => {
      const result = await handler.execute('data_transform', {
        input: [{ type: 'a', v: 1 }, { type: 'b', v: 2 }, { type: 'a', v: 3 }],
        operation: 'group_by',
        config: { field: 'type' },
      });
      expect(Object.keys(result.output as any)).toContain('a');
      expect(Object.keys(result.output as any)).toContain('b');
    });

    it('should merge objects', async () => {
      const result = await handler.execute('data_transform', {
        input: [{ a: 1 }, { b: 2 }],
        operation: 'merge',
      });
      expect(result.output).toEqual({ a: 1, b: 2 });
    });

    it('should fail map with non-array', async () => {
      const result = await handler.execute('data_transform', { input: 'not array', operation: 'map' });
      expect(result.success).toBe(false);
    });

    it('should fail filter with non-array', async () => {
      const result = await handler.execute('data_transform', { input: 'not array', operation: 'filter' });
      expect(result.success).toBe(false);
    });

    it('should fail with unknown operation', async () => {
      const result = await handler.execute('data_transform', { input: [], operation: 'unknown' });
      expect(result.success).toBe(false);
    });
  });

  describe('JSON parse action', () => {
    it('should parse valid JSON', async () => {
      const result = await handler.execute('json_parse', { input: '{"key":"value"}' });
      expect(result.success).toBe(true);
      expect(result.output).toEqual({ key: 'value' });
    });

    it('should fail on invalid JSON', async () => {
      const result = await handler.execute('json_parse', { input: 'not json' });
      expect(result.success).toBe(false);
    });

    it('should fail without input', async () => {
      const result = await handler.execute('json_parse', {});
      expect(result.success).toBe(false);
    });
  });

  describe('set variable action', () => {
    it('should set a variable', async () => {
      const result = await handler.execute('set_variable', { name: 'count', value: 42 });
      expect(result.success).toBe(true);
      expect(result.output).toEqual({ name: 'count', value: 42 });
    });

    it('should fail without name', async () => {
      const result = await handler.execute('set_variable', { value: 42 });
      expect(result.success).toBe(false);
    });
  });

  describe('unknown action type', () => {
    it('should return error for unknown type', async () => {
      const result = await handler.execute('nonexistent', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown action type');
    });
  });

  describe('custom handler', () => {
    it('should use a registered custom handler', async () => {
      handler.register('custom', async (params) => ({
        success: true,
        output: `custom: ${params.message}`,
      }));

      const result = await handler.execute('custom', { message: 'hello' });
      expect(result.success).toBe(true);
      expect(result.output).toBe('custom: hello');
    });

    it('should catch errors from custom handlers', async () => {
      handler.register('failing', async () => {
        throw new Error('Custom error');
      });

      const result = await handler.execute('failing', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Custom error');
    });
  });
});
