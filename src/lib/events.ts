// Event system for decoupled architecture

import { generateId } from './utils';

// ─── Types ───────────────────────────────────────────────
export type EventHandler<T = unknown> = (event: Event<T>) => void | Promise<void>;

export interface Event<T = unknown> {
  id: string;
  type: string;
  payload: T;
  timestamp: Date;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface EventSubscription {
  id: string;
  eventType: string;
  handler: EventHandler;
  once: boolean;
}

export interface EventStats {
  totalEvents: number;
  eventsByType: Record<string, number>;
  handlerCount: number;
}

// ─── EventEmitter Implementation ─────────────────────────
class TypedEventEmitter {
  private handlers = new Map<string, EventHandler[]>();
  private eventHistory: Event[] = [];
  private maxHistory = 1000;

  on<T = unknown>(eventType: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler as EventHandler);

    return () => this.off(eventType, handler as EventHandler);
  }

  once<T = unknown>(eventType: string, handler: EventHandler<T>): () => void {
    const wrapper: EventHandler<T> = (event) => {
      handler(event);
      this.off(eventType, wrapper as EventHandler);
    };
    return this.on(eventType, wrapper);
  }

  off(eventType: string, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType);
    if (!handlers) return;
    const idx = handlers.indexOf(handler);
    if (idx > -1) handlers.splice(idx, 1);
  }

  async emit<T = unknown>(eventType: string, payload: T, options?: { source?: string; metadata?: Record<string, unknown> }): Promise<void> {
    const event: Event<T> = {
      id: generateId(),
      type: eventType,
      payload,
      timestamp: new Date(),
      source: options?.source,
      metadata: options?.metadata,
    };

    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.shift();
    }

    const handlers = this.handlers.get(eventType) || [];
    const wildcardHandlers = this.handlers.get('*') || [];

    for (const handler of [...handlers, ...wildcardHandlers]) {
      try {
        await handler(event);
      } catch (error) {
        console.error(`Event handler error for ${eventType}:`, error);
      }
    }
  }

  getEventHistory(eventType?: string, limit?: number): Event[] {
    let events = eventType
      ? this.eventHistory.filter((e) => e.type === eventType)
      : this.eventHistory;
    if (limit) events = events.slice(-limit);
    return events;
  }

  getStats(): EventStats {
    const eventsByType: Record<string, number> = {};
    for (const event of this.eventHistory) {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
    }

    let handlerCount = 0;
    for (const handlers of this.handlers.values()) {
      handlerCount += handlers.length;
    }

    return {
      totalEvents: this.eventHistory.length,
      eventsByType,
      handlerCount,
    };
  }

  clearHistory(): void {
    this.eventHistory = [];
  }

  removeAllHandlers(eventType?: string): void {
    if (eventType) {
      this.handlers.delete(eventType);
    } else {
      this.handlers.clear();
    }
  }
}

// ─── Event Bus ───────────────────────────────────────────
class EventBus {
  private emitter: TypedEventEmitter;
  private subscriptions = new Map<string, EventSubscription>();

  constructor() {
    this.emitter = new TypedEventEmitter();
  }

  subscribe<T = unknown>(eventType: string, handler: EventHandler<T>): string {
    const id = generateId();
    const unsub = this.emitter.on(eventType, handler);
    this.subscriptions.set(id, { id, eventType, handler: handler as EventHandler, once: false });

    // Store unsub function for cleanup
    (this.subscriptions.get(id) as any)._unsub = unsub;
    return id;
  }

  subscribeOnce<T = unknown>(eventType: string, handler: EventHandler<T>): string {
    const id = generateId();
    const unsub = this.emitter.once(eventType, handler);
    this.subscriptions.set(id, { id, eventType, handler: handler as EventHandler, once: true });

    (this.subscriptions.get(id) as any)._unsub = unsub;
    return id;
  }

  unsubscribe(subscriptionId: string): boolean {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) return false;

    const unsub = (sub as any)._unsub;
    if (unsub) unsub();
    this.subscriptions.delete(subscriptionId);
    return true;
  }

  async publish<T = unknown>(eventType: string, payload: T, options?: { source?: string; metadata?: Record<string, unknown> }): Promise<void> {
    return this.emitter.emit(eventType, payload, options);
  }

  getEventHistory(eventType?: string, limit?: number): Event[] {
    return this.emitter.getEventHistory(eventType, limit);
  }

  getStats(): EventStats {
    return this.emitter.getStats();
  }

  clear(): void {
    this.emitter.clearHistory();
    this.emitter.removeAllHandlers();
    this.subscriptions.clear();
  }
}

// ─── Singleton Event Bus ─────────────────────────────────
const globalEventBus = globalThis as unknown as { __eventBus?: EventBus };
export const eventBus = globalEventBus.__eventBus || new EventBus();
if (process.env.NODE_ENV !== 'production') {
  globalEventBus.__eventBus = eventBus;
}

// ─── Event Types Registry ────────────────────────────────
export const EventTypes = {
  // User events
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',

  // Organization events
  ORG_CREATED: 'org.created',
  ORG_UPDATED: 'org.updated',
  ORG_MEMBER_ADDED: 'org.member.added',
  ORG_MEMBER_REMOVED: 'org.member.removed',

  // Workflow events
  WORKFLOW_CREATED: 'workflow.created',
  WORKFLOW_UPDATED: 'workflow.updated',
  WORKFLOW_DELETED: 'workflow.deleted',
  WORKFLOW_EXECUTED: 'workflow.executed',
  WORKFLOW_COMPLETED: 'workflow.completed',
  WORKFLOW_FAILED: 'workflow.failed',

  // Execution events
  EXECUTION_STARTED: 'execution.started',
  EXECUTION_COMPLETED: 'execution.completed',
  EXECUTION_FAILED: 'execution.failed',
  EXECUTION_CANCELLED: 'execution.cancelled',

  // Integration events
  INTEGRATION_CONNECTED: 'integration.connected',
  INTEGRATION_DISCONNECTED: 'integration.disconnected',
  INTEGRATION_SYNCED: 'integration.synced',

  // Notification events
  NOTIFICATION_SENT: 'notification.sent',
  NOTIFICATION_READ: 'notification.read',

  // Billing events
  BILLING_SUBSCRIPTION_CREATED: 'billing.subscription.created',
  BILLING_SUBSCRIPTION_UPDATED: 'billing.subscription.updated',
  BILLING_PAYMENT_SUCCESS: 'billing.payment.success',
  BILLING_PAYMENT_FAILED: 'billing.payment.failed',
} as const;

// ─── Event Replay ────────────────────────────────────────
export async function replayEvents(
  eventType: string,
  handler: EventHandler,
  options?: { since?: Date; limit?: number }
): Promise<void> {
  const events = eventBus.getEventHistory(eventType, options?.limit);
  const filteredEvents = options?.since
    ? events.filter((e) => e.timestamp >= options.since!)
    : events;

  for (const event of filteredEvents) {
    try {
      await handler(event);
    } catch (error) {
      console.error(`Event replay error for ${event.id}:`, error);
    }
  }
}

// ─── Convenience Functions ───────────────────────────────
export function onEvent<T = unknown>(eventType: string, handler: EventHandler<T>): () => void {
  return () => eventBus.unsubscribe(eventBus.subscribe(eventType, handler));
}

export async function emitEvent<T = unknown>(eventType: string, payload: T, source?: string): Promise<void> {
  return eventBus.publish(eventType, payload, { source });
}
