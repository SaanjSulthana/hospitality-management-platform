import { UsersEventPayload } from "./events";

type BufferedEvent = {
  event: UsersEventPayload;
  enqueuedAt: Date;
};

type OrgBuffer = {
  queue: BufferedEvent[];
  waiters: Array<{
    sinceTime?: Date;
    propertyId?: number;
    resolve: (events: UsersEventPayload[]) => void;
    reject: (err: Error) => void;
    timeout: NodeJS.Timeout;
  }>;
  lastActive: number;
};

const buffers = new Map<number, OrgBuffer>();

export const MAX_BUFFER_SIZE = 200;
export const EVENT_TTL_MS = 25_000;
export const LONG_POLL_TIMEOUT_MS = 25_000;
export const MAX_WAITERS_PER_ORG = 5000;
export const ORG_IDLE_EVICT_MS = 120_000;

const publishedByType = new Map<string, number>();
const deliveredByType = new Map<string, number>();
let totalDropped = 0;

function getOrCreateBuffer(orgId: number): OrgBuffer {
  let buf = buffers.get(orgId);
  if (!buf) {
    buf = { queue: [], waiters: [], lastActive: Date.now() };
    buffers.set(orgId, buf);
  }
  buf.lastActive = Date.now();
  return buf;
}

function recordPublished(eventType: string): void {
  publishedByType.set(eventType, (publishedByType.get(eventType) || 0) + 1);
}

function recordDelivered(eventType: string, count: number): void {
  deliveredByType.set(eventType, (deliveredByType.get(eventType) || 0) + count);
}

function cleanupExpired(buf: OrgBuffer): void {
  const cutoff = Date.now() - EVENT_TTL_MS;
  while (buf.queue.length > 0 && buf.queue[0].enqueuedAt.getTime() < cutoff) {
    buf.queue.shift();
  }
}

export function bufferUsersEvent(event: UsersEventPayload): void {
  const buf = getOrCreateBuffer(event.orgId);
  buf.queue.push({ event, enqueuedAt: new Date() });
  recordPublished(event.eventType);
  buf.lastActive = Date.now();
  if (buf.queue.length > MAX_BUFFER_SIZE) {
    const dropped = buf.queue.length - MAX_BUFFER_SIZE;
    buf.queue.splice(0, dropped);
    totalDropped += dropped;
  }
  notifyWaiters(event.orgId);
}

function notifyWaiters(orgId: number): void {
  const buf = buffers.get(orgId);
  if (!buf || buf.waiters.length === 0) return;
  cleanupExpired(buf);
  const waiters = buf.waiters.splice(0, buf.waiters.length);
  for (const w of waiters) {
    clearTimeout(w.timeout);
    try {
      const events = getEventsSinceInternal(orgId, w.sinceTime, w.propertyId);
      w.resolve(events);
    } catch (e: any) {
      w.reject(e);
    }
  }
  buf.lastActive = Date.now();
}

function getEventsSinceInternal(orgId: number, sinceTime?: Date, propertyId?: number): UsersEventPayload[] {
  const buf = buffers.get(orgId);
  if (!buf) return [];
  cleanupExpired(buf);
  const events = buf.queue
    .filter(item => !sinceTime || item.event.timestamp > sinceTime)
    .map(item => item.event)
    .filter(e => (propertyId ? e.propertyId === propertyId : true));
  const counts = new Map<string, number>();
  for (const ev of events) {
    counts.set(ev.eventType, (counts.get(ev.eventType) || 0) + 1);
  }
  for (const [t, c] of counts) {
    recordDelivered(t, c);
  }
  buf.lastActive = Date.now();
  return events;
}

export function getEventsSince(orgId: number, lastEventIdISO?: string, propertyId?: number): UsersEventPayload[] {
  const sinceTime = lastEventIdISO ? new Date(lastEventIdISO) : undefined;
  return getEventsSinceInternal(orgId, sinceTime, propertyId);
}

export function waitForEvents(orgId: number, lastEventIdISO?: string, propertyId?: number): Promise<UsersEventPayload[]> {
  const sinceTime = lastEventIdISO ? new Date(lastEventIdISO) : undefined;
  const buf = getOrCreateBuffer(orgId);
  const available = getEventsSinceInternal(orgId, sinceTime, propertyId);
  if (available.length > 0) {
    return Promise.resolve(available);
  }
  return new Promise<UsersEventPayload[]>((resolve, reject) => {
    if (buf.waiters.length >= MAX_WAITERS_PER_ORG) {
      try {
        resolve([]);
      } catch (e) {
        reject(e as Error);
      }
      return;
    }
    const timeout = setTimeout(() => {
      try {
        resolve([]);
      } catch (e) {
        reject(e as Error);
      }
    }, LONG_POLL_TIMEOUT_MS);
    buf.waiters.push({ sinceTime, propertyId, resolve, reject, timeout });
    buf.lastActive = Date.now();
  });
}

export function getRealtimeBufferMetrics() {
  const byOrg = Array.from(buffers.entries()).map(([orgId, buf]) => ({
    orgId,
    size: buf.queue.length,
  }));
  const published = Object.fromEntries(publishedByType.entries());
  const delivered = Object.fromEntries(deliveredByType.entries());
  return {
    buffers: byOrg,
    totals: { orgs: buffers.size, totalDropped },
    publishedByType: published,
    deliveredByType: delivered,
    maxBufferSize: MAX_BUFFER_SIZE,
    eventTtlMs: EVENT_TTL_MS,
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [orgId, buf] of buffers.entries()) {
    if (buf.waiters.length === 0 && buf.queue.length === 0 && now - buf.lastActive > ORG_IDLE_EVICT_MS) {
      buffers.delete(orgId);
    }
  }
}, ORG_IDLE_EVICT_MS);


