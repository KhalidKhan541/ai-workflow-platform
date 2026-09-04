import { TriggerManager } from '@/lib/workflow/triggers';

describe('TriggerManager', () => {
  let manager: TriggerManager;

  beforeEach(() => {
    manager = new TriggerManager();
  });

  describe('webhook trigger', () => {
    it('should register and match a webhook trigger', () => {
      manager.registerWebhook('wh-1', {
        type: 'webhook',
        config: { path: '/api/hooks/deploy', method: 'POST' },
      });

      const match = manager.matchWebhook('/api/hooks/deploy', 'POST');
      expect(match).not.toBeNull();
      expect(match!.id).toBe('wh-1');
    });

    it('should not match a different path', () => {
      manager.registerWebhook('wh-1', {
        type: 'webhook',
        config: { path: '/api/hooks/deploy', method: 'POST' },
      });

      const match = manager.matchWebhook('/api/hooks/other', 'POST');
      expect(match).toBeNull();
    });

    it('should match any method when method is not specified', () => {
      manager.registerWebhook('wh-1', {
        type: 'webhook',
        config: { path: '/api/hooks/deploy' },
      });

      expect(manager.matchWebhook('/api/hooks/deploy', 'GET')).not.toBeNull();
      expect(manager.matchWebhook('/api/hooks/deploy', 'POST')).not.toBeNull();
      expect(manager.matchWebhook('/api/hooks/deploy', 'DELETE')).not.toBeNull();
    });

    it('should match method case-insensitively', () => {
      manager.registerWebhook('wh-1', {
        type: 'webhook',
        config: { path: '/api/hooks/deploy', method: 'POST' },
      });

      expect(manager.matchWebhook('/api/hooks/deploy', 'post')).not.toBeNull();
      expect(manager.matchWebhook('/api/hooks/deploy', 'Post')).not.toBeNull();
    });

    it('should return null for no webhooks registered', () => {
      expect(manager.matchWebhook('/any', 'GET')).toBeNull();
    });
  });

  describe('cron trigger', () => {
    it('should register a cron trigger', () => {
      manager.registerCron('cron-1', {
        type: 'cron',
        config: { expression: '0 9 * * 1-5', timezone: 'UTC' },
      });

      const triggers = manager.getRegisteredTriggers();
      expect(triggers.crons).toBe(1);
    });

    it('should calculate next run for simple cron expression', () => {
      const from = new Date('2026-01-05T08:00:00Z');
      const next = manager.calculateNextCronRun('0 9 * * *', from);
      expect(next).not.toBeNull();
      expect(next!.getHours()).toBe(9);
      expect(next!.getMinutes()).toBe(0);
    });

    it('should calculate next run with interval minute', () => {
      const from = new Date('2026-01-05T08:15:00Z');
      const next = manager.calculateNextCronRun('*/30 * * * *', from);
      expect(next).not.toBeNull();
      expect(next!.getMinutes()).toBe(30);
    });

    it('should return null for invalid cron expression', () => {
      expect(manager.calculateNextCronRun('invalid')).toBeNull();
    });

    it('should advance to next day when time has passed', () => {
      const from = new Date('2026-01-05T10:00:00Z');
      const next = manager.calculateNextCronRun('0 9 * * *', from);
      expect(next).not.toBeNull();
      expect(next!.getDate()).toBe(6);
    });
  });

  describe('event trigger', () => {
    it('should match an event trigger by name', () => {
      manager.registerEvent('evt-1', {
        type: 'event',
        config: { eventName: 'user.created' },
      });

      const matches = manager.matchEvent('user.created');
      expect(matches).toHaveLength(1);
      expect(matches[0].id).toBe('evt-1');
    });

    it('should match multiple triggers for same event', () => {
      manager.registerEvent('evt-1', { type: 'event', config: { eventName: 'deploy' } });
      manager.registerEvent('evt-2', { type: 'event', config: { eventName: 'deploy' } });

      const matches = manager.matchEvent('deploy');
      expect(matches).toHaveLength(2);
    });

    it('should filter by source', () => {
      manager.registerEvent('evt-1', {
        type: 'event',
        config: { eventName: 'deploy', source: 'github' },
      });
      manager.registerEvent('evt-2', {
        type: 'event',
        config: { eventName: 'deploy', source: 'gitlab' },
      });

      const githubMatches = manager.matchEvent('deploy', 'github');
      expect(githubMatches).toHaveLength(1);
      expect(githubMatches[0].id).toBe('evt-1');

      const gitlabMatches = manager.matchEvent('deploy', 'gitlab');
      expect(gitlabMatches).toHaveLength(1);

      const allMatches = manager.matchEvent('deploy');
      expect(allMatches).toHaveLength(2);
    });

    it('should return empty for unmatched event', () => {
      manager.registerEvent('evt-1', { type: 'event', config: { eventName: 'deploy' } });
      expect(manager.matchEvent('other.event')).toHaveLength(0);
    });
  });

  describe('unregister', () => {
    it('should unregister a webhook', () => {
      manager.registerWebhook('wh-1', { type: 'webhook', config: { path: '/test' } });
      expect(manager.unregister('wh-1')).toBe(true);
      expect(manager.matchWebhook('/test', 'GET')).toBeNull();
    });

    it('should unregister a cron', () => {
      manager.registerCron('cron-1', { type: 'cron', config: { expression: '* * * * *' } });
      expect(manager.unregister('cron-1')).toBe(true);
      expect(manager.getRegisteredTriggers().crons).toBe(0);
    });

    it('should unregister an event', () => {
      manager.registerEvent('evt-1', { type: 'event', config: { eventName: 'test' } });
      expect(manager.unregister('evt-1')).toBe(true);
      expect(manager.matchEvent('test')).toHaveLength(0);
    });

    it('should return false for non-existent id', () => {
      expect(manager.unregister('non-existent')).toBe(false);
    });
  });

  describe('getRegisteredTriggers', () => {
    it('should return correct counts', () => {
      manager.registerWebhook('w1', { type: 'webhook', config: { path: '/a' } });
      manager.registerWebhook('w2', { type: 'webhook', config: { path: '/b' } });
      manager.registerCron('c1', { type: 'cron', config: { expression: '* * * * *' } });
      manager.registerEvent('e1', { type: 'event', config: { eventName: 'test' } });

      const counts = manager.getRegisteredTriggers();
      expect(counts.webhooks).toBe(2);
      expect(counts.crons).toBe(1);
      expect(counts.events).toBe(1);
    });

    it('should return all zeros when empty', () => {
      const counts = manager.getRegisteredTriggers();
      expect(counts).toEqual({ webhooks: 0, crons: 0, events: 0 });
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify a valid HMAC signature', () => {
      const crypto = require('crypto');
      const secret = 'test-secret-key';
      const payload = '{"event":"test"}';
      const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

      expect(manager.verifyWebhookSignature(payload, signature, secret)).toBe(true);
    });

    it('should reject an invalid signature', () => {
      expect(manager.verifyWebhookSignature('payload', 'invalid-sig', 'secret')).toBe(false);
    });
  });
});
