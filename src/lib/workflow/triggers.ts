export interface TriggerConfig {
  type: 'webhook' | 'cron' | 'event';
  config: Record<string, unknown>;
}

export interface WebhookTrigger {
  type: 'webhook';
  config: {
    path: string;
    method?: string;
    headers?: Record<string, string>;
    secret?: string;
  };
}

export interface CronTrigger {
  type: 'cron';
  config: {
    expression: string;
    timezone?: string;
  };
}

export interface EventTrigger {
  type: 'event';
  config: {
    eventName: string;
    source?: string;
    filter?: Record<string, unknown>;
  };
}

export class TriggerManager {
  private webhooks: Map<string, WebhookTrigger> = new Map();
  private crons: Map<string, CronTrigger> = new Map();
  private events: Map<string, EventTrigger> = new Map();

  registerWebhook(id: string, trigger: WebhookTrigger): void {
    this.webhooks.set(id, trigger);
  }

  registerCron(id: string, trigger: CronTrigger): void {
    this.crons.set(id, trigger);
  }

  registerEvent(id: string, trigger: EventTrigger): void {
    this.events.set(id, trigger);
  }

  unregister(id: string): boolean {
    return this.webhooks.delete(id) || this.crons.delete(id) || this.events.delete(id);
  }

  matchWebhook(path: string, method: string): { id: string; trigger: WebhookTrigger } | null {
    for (const [id, trigger] of this.webhooks) {
      if (trigger.config.path === path) {
        if (!trigger.config.method || trigger.config.method.toUpperCase() === method.toUpperCase()) {
          return { id, trigger };
        }
      }
    }
    return null;
  }

  matchEvent(eventName: string, source?: string): { id: string; trigger: EventTrigger }[] {
    const matches: { id: string; trigger: EventTrigger }[] = [];
    for (const [id, trigger] of this.events) {
      if (trigger.config.eventName === eventName) {
        if (!trigger.config.source || trigger.config.source === source) {
          matches.push({ id, trigger });
        }
      }
    }
    return matches;
  }

  calculateNextCronRun(expression: string, from: Date = new Date()): Date | null {
    const parts = expression.split(' ');
    if (parts.length < 5) return null;

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    const result = new Date(from);
    result.setSeconds(0, 0);

    if (minute !== '*') {
      const m = parseInt(minute, 10);
      if (!isNaN(m)) result.setMinutes(m);
      else if (minute.startsWith('*/')) {
        const interval = parseInt(minute.slice(2), 10);
        if (!isNaN(interval)) {
          const currentMin = from.getMinutes();
          const nextMin = Math.ceil((currentMin + 1) / interval) * interval;
          result.setMinutes(nextMin);
          if (nextMin >= 60) {
            result.setMinutes(0);
            result.setHours(result.getHours() + 1);
          }
        }
      }
    }

    if (hour !== '*') {
      const h = parseInt(hour, 10);
      if (!isNaN(h)) result.setHours(h);
    }

    if (dayOfMonth !== '*') {
      const d = parseInt(dayOfMonth, 10);
      if (!isNaN(d)) result.setDate(d);
    }

    if (month !== '*') {
      const m = parseInt(month, 10);
      if (!isNaN(m)) result.setMonth(m - 1);
    }

    if (result <= from) {
      result.setDate(result.getDate() + 1);
    }

    return result;
  }

  verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string,
  ): boolean {
    const crypto = require('crypto');
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }

  getRegisteredTriggers(): { webhooks: number; crons: number; events: number } {
    return {
      webhooks: this.webhooks.size,
      crons: this.crons.size,
      events: this.events.size,
    };
  }
}
