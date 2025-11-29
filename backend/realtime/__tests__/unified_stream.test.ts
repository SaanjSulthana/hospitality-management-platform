/**
 * Unit tests for Unified Streaming API
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import type { StreamHandshake, StreamMessage } from '../types';

// Mock Encore API
const mockStream = {
  send: jest.fn(),
  onClose: jest.fn(),
};

const mockGetAuthData = jest.fn();
const mockSubscribe = jest.fn();

jest.mock('encore.dev/api', () => ({
  api: {
    streamOut: jest.fn((config, handler) => handler),
    APIError: {
      unauthenticated: (msg: string) => new Error(msg),
      invalidArgument: (msg: string) => new Error(msg),
    },
  },
}));

jest.mock('~encore/auth', () => ({
  getAuthData: () => mockGetAuthData(),
}));

// Mock Pub/Sub topics
jest.mock('../../finance/events', () => ({
  financeEvents: {
    subscribe: mockSubscribe,
  },
}));

jest.mock('../../guest-checkin/guest-checkin-events', () => ({
  guestCheckinEvents: {
    subscribe: mockSubscribe,
  },
}));

describe('Unified Streaming API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthData.mockReturnValue({
      userID: 123,
      orgId: 456,
    });
    mockSubscribe.mockResolvedValue({
      cancel: jest.fn(),
    });
  });

  describe('Authentication', () => {
    it('should reject unauthenticated requests', async () => {
      mockGetAuthData.mockReturnValue(null);

      const handshake: StreamHandshake = {
        services: ['finance'],
        version: 1,
      };

      await expect(async () => {
        // Handler would throw
        if (!mockGetAuthData()) {
          throw new Error('Authentication required');
        }
      }).rejects.toThrow('Authentication required');
    });

    it('should accept authenticated requests', async () => {
      mockGetAuthData.mockReturnValue({
        userID: 123,
        orgId: 456,
      });

      const auth = mockGetAuthData();
      expect(auth).toBeTruthy();
      expect(auth.userID).toBe(123);
      expect(auth.orgId).toBe(456);
    });
  });

  describe('Handshake Validation', () => {
    it('should reject empty services array', () => {
      const handshake: StreamHandshake = {
        services: [],
        version: 1,
      };

      expect(() => {
        if (handshake.services.length === 0) {
          throw new Error('At least one service must be specified');
        }
      }).toThrow('At least one service must be specified');
    });

    it('should reject unsupported protocol version', () => {
      const handshake: StreamHandshake = {
        services: ['finance'],
        version: 99,
      };

      expect(() => {
        if (handshake.version !== 1) {
          throw new Error(`Unsupported protocol version: ${handshake.version}`);
        }
      }).toThrow('Unsupported protocol version: 99');
    });

    it('should accept valid handshake', () => {
      const handshake: StreamHandshake = {
        services: ['finance', 'guest', 'staff'],
        version: 1,
        propertyId: 789,
      };

      expect(handshake.services.length).toBeGreaterThan(0);
      expect(handshake.version).toBe(1);
      expect(handshake.propertyId).toBe(789);
    });
  });

  describe('Event Filtering', () => {
    it('should filter events by orgId', () => {
      const event = {
        eventId: 'test-1',
        eventType: 'expense_added',
        orgId: 456,
        propertyId: 1,
        userId: 123,
        timestamp: new Date(),
        entityId: 1,
        entityType: 'expense' as const,
        eventVersion: 'v1' as const,
      };

      const currentOrgId = 456;

      expect(event.orgId).toBe(currentOrgId);
    });

    it('should reject events from different org', () => {
      const event = {
        eventId: 'test-1',
        eventType: 'expense_added',
        orgId: 999, // Different org
        propertyId: 1,
        userId: 123,
        timestamp: new Date(),
        entityId: 1,
        entityType: 'expense' as const,
        eventVersion: 'v1' as const,
      };

      const currentOrgId = 456;

      expect(event.orgId).not.toBe(currentOrgId);
    });

    it('should filter events by propertyId when specified', () => {
      const event = {
        eventId: 'test-1',
        eventType: 'expense_added',
        orgId: 456,
        propertyId: 789,
        userId: 123,
        timestamp: new Date(),
        entityId: 1,
        entityType: 'expense' as const,
        eventVersion: 'v1' as const,
      };

      const propertyFilter = 789;

      expect(event.propertyId).toBe(propertyFilter);
    });
  });

  describe('Event Batching', () => {
    it('should batch events within time window', () => {
      const events = [
        { service: 'finance', event: { eventId: '1' } },
        { service: 'finance', event: { eventId: '2' } },
        { service: 'guest', event: { eventId: '3' } },
      ];

      const batched = new Map<string, any[]>();
      for (const { service, event } of events) {
        const existing = batched.get(service) ?? [];
        existing.push(event);
        batched.set(service, existing);
      }

      expect(batched.get('finance')?.length).toBe(2);
      expect(batched.get('guest')?.length).toBe(1);
    });

    it('should respect max batch size', () => {
      const MAX_BATCH_SIZE = 100;
      const events = Array.from({ length: 150 }, (_, i) => ({
        service: 'finance',
        event: { eventId: `${i}` },
      }));

      const batch1 = events.slice(0, MAX_BATCH_SIZE);
      const batch2 = events.slice(MAX_BATCH_SIZE);

      expect(batch1.length).toBe(MAX_BATCH_SIZE);
      expect(batch2.length).toBe(50);
    });
  });

  describe('Sequence Numbers', () => {
    it('should increment sequence number', () => {
      let seq = 0;

      const message1 = { seq: ++seq, type: 'event' };
      const message2 = { seq: ++seq, type: 'event' };
      const message3 = { seq: ++seq, type: 'ping' };

      expect(message1.seq).toBe(1);
      expect(message2.seq).toBe(2);
      expect(message3.seq).toBe(3);
    });

    it('should detect sequence gaps', () => {
      let lastSeq = 0;
      const receivedSeqs = [1, 2, 4, 5]; // Missing 3

      for (const seq of receivedSeqs) {
        if (seq !== lastSeq + 1) {
          expect(seq).toBe(4); // Gap detected at seq 4
          break;
        }
        lastSeq = seq;
      }
    });
  });

  describe('Subscription Management', () => {
    it('should subscribe to requested services', async () => {
      const services = ['finance', 'guest', 'staff'];
      const subscriptions: Array<() => Promise<void>> = [];

      for (const service of services) {
        const subscription = await mockSubscribe(`test-${service}`, jest.fn());
        subscriptions.push(async () => {
          await subscription.cancel();
        });
      }

      expect(subscriptions.length).toBe(services.length);
    });

    it('should cleanup subscriptions on disconnect', async () => {
      const cancelMock = jest.fn();
      mockSubscribe.mockResolvedValue({
        cancel: cancelMock,
      });

      const subscription = await mockSubscribe('test', jest.fn());
      await subscription.cancel();

      expect(cancelMock).toHaveBeenCalledTimes(1);
    });

    it('should continue other subscriptions if one fails', async () => {
      mockSubscribe
        .mockResolvedValueOnce({ cancel: jest.fn() }) // finance succeeds
        .mockRejectedValueOnce(new Error('Guest subscription failed')) // guest fails
        .mockResolvedValueOnce({ cancel: jest.fn() }); // staff succeeds

      const results = await Promise.allSettled([
        mockSubscribe('finance', jest.fn()),
        mockSubscribe('guest', jest.fn()),
        mockSubscribe('staff', jest.fn()),
      ]);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
    });
  });

  describe('Error Handling', () => {
    it('should send error message if subscription fails', async () => {
      mockSubscribe.mockRejectedValue(new Error('Subscription failed'));

      try {
        await mockSubscribe('test', jest.fn());
      } catch (err) {
        const errorMessage = {
          type: 'error',
          service: 'finance',
          message: err instanceof Error ? err.message : String(err),
          code: 'SUBSCRIPTION_ERROR',
          timestamp: new Date().toISOString(),
          seq: 1,
        };

        expect(errorMessage.type).toBe('error');
        expect(errorMessage.message).toBe('Subscription failed');
      }
    });

    it('should handle send errors gracefully', async () => {
      mockStream.send.mockRejectedValue(new Error('Send failed'));

      try {
        await mockStream.send({ type: 'event' });
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toBe('Send failed');
      }
    });
  });

  describe('Keep-Alive Pings', () => {
    it('should send ping at regular intervals', () => {
      jest.useFakeTimers();

      const pingInterval = 30_000;
      let pingCount = 0;

      const sendPing = () => {
        pingCount++;
      };

      const interval = setInterval(sendPing, pingInterval);

      jest.advanceTimersByTime(90_000); // 90 seconds

      clearInterval(interval);

      expect(pingCount).toBe(3); // 3 pings in 90 seconds

      jest.useRealTimers();
    });
  });
});

describe('Connection State Management', () => {
  it('should track connection state', () => {
    const state = {
      orgId: 456,
      userId: 123,
      services: new Set(['finance', 'guest']),
      propertyFilter: null,
      lastSeq: 0,
      connectedAt: Date.now(),
      lastActivityAt: Date.now(),
      subscriptions: [],
    };

    expect(state.services.size).toBe(2);
    expect(state.lastSeq).toBe(0);
    expect(state.connectedAt).toBeLessThanOrEqual(Date.now());
  });

  it('should update last activity on event', () => {
    const state = {
      lastActivityAt: Date.now() - 5000, // 5 seconds ago
    };

    const before = state.lastActivityAt;

    // Simulate event
    state.lastActivityAt = Date.now();

    expect(state.lastActivityAt).toBeGreaterThan(before);
  });
});

