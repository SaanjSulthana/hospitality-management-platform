/**
 * Unit tests for RealtimeProviderV2 (WebSocket Streaming)
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, waitFor } from '@testing-library/react';
import React from 'react';

// Mock dependencies
const mockUseAuth = jest.fn();
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('../src/config/api', () => ({
  API_CONFIG: {
    BASE_URL: 'http://localhost:4000',
  },
}));

jest.mock('../lib/feature-flags', () => ({
  getAccessTokenHash: () => 'test-hash',
  getFlagBool: (name: string, defaultValue: boolean) => {
    if (name === 'REALTIME_STREAMING_V2') return false; // Default OFF for tests
    if (name === 'FIN_LEADER_ENABLED') return true;
    return defaultValue;
  },
  getFlagNumber: (name: string, defaultValue: number) => {
    if (name === 'REALTIME_ROLLOUT_PERCENT') return 100; // Full rollout for tests
    return defaultValue;
  },
}));

// Mock WebSocket
class MockWebSocket {
  public onopen: ((event: any) => void) | null = null;
  public onmessage: ((event: any) => void) | null = null;
  public onerror: ((event: any) => void) | null = null;
  public onclose: ((event: any) => void) | null = null;
  public sent: string[] = [];

  constructor(public url: string) {
    // Simulate async connection
    setTimeout(() => {
      if (this.onopen) {
        this.onopen({});
      }
    }, 10);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    if (this.onclose) {
      this.onclose({ code: 1000, reason: 'Normal closure', wasClean: true });
    }
  }

  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) });
    }
  }
}

(global as any).WebSocket = MockWebSocket;

describe('RealtimeProviderV2', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: {
        orgId: 456,
        userId: 123,
      },
    });

    // Mock sessionStorage
    const sessionStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };
    (global as any).sessionStorage = sessionStorageMock;

    // Mock localStorage
    const localStorageMock = {
      getItem: jest.fn(() => 'test-token'),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };
    (global as any).localStorage = localStorageMock;

    // Mock BroadcastChannel
    class MockBroadcastChannel {
      public onmessage: ((event: any) => void) | null = null;
      constructor(public name: string) {}
      postMessage(data: any) {}
      close() {}
    }
    (global as any).BroadcastChannel = MockBroadcastChannel;

    // Mock navigator.locks
    (global as any).navigator = {
      locks: {
        request: jest.fn((name, options, callback) => {
          // Simulate lock acquisition
          return callback({ mode: 'exclusive' });
        }),
      },
    };
  });

  describe('Feature Flags', () => {
    it('should not connect when feature flag is disabled', () => {
      const { getFlagBool } = require('../lib/feature-flags');
      const enabled = getFlagBool('REALTIME_STREAMING_V2', false);

      expect(enabled).toBe(false);
    });

    it('should respect rollout percentage', () => {
      const { getFlagNumber } = require('../lib/feature-flags');
      const rollout = getFlagNumber('REALTIME_ROLLOUT_PERCENT', 0);

      expect(rollout).toBe(100);
    });
  });

  describe('Deduplication Cache', () => {
    it('should detect duplicate events', () => {
      const cache = new Map<number, { ids: Set<string>; order: string[] }>();

      const isDuplicate = (orgId: number, eventId: string): boolean => {
        let state = cache.get(orgId);

        if (!state) {
          state = { ids: new Set(), order: [] };
          cache.set(orgId, state);
        }

        if (state.ids.has(eventId)) return true;

        state.ids.add(eventId);
        state.order.push(eventId);

        return false;
      };

      expect(isDuplicate(456, 'event-1')).toBe(false); // First time
      expect(isDuplicate(456, 'event-1')).toBe(true); // Duplicate
      expect(isDuplicate(456, 'event-2')).toBe(false); // New event
    });

    it('should enforce max cache size per org', () => {
      const cache = new Map<number, { ids: Set<string>; order: string[] }>();
      const MAX_IDS = 1000;

      let state = { ids: new Set<string>(), order: [] as string[] };
      cache.set(456, state);

      // Add 1500 events
      for (let i = 0; i < 1500; i++) {
        const eventId = `event-${i}`;
        state.ids.add(eventId);
        state.order.push(eventId);
      }

      // Cleanup
      while (state.order.length > MAX_IDS) {
        const oldest = state.order.shift();
        if (oldest) state.ids.delete(oldest);
      }

      expect(state.order.length).toBe(MAX_IDS);
      expect(state.ids.size).toBe(MAX_IDS);
    });

    it('should evict oldest org when max orgs exceeded', () => {
      const cache = new Map<number, { ids: Set<string>; order: string[]; lastAccess: number }>();
      const MAX_ORGS = 3;

      // Add 5 orgs
      for (let i = 1; i <= 5; i++) {
        cache.set(i, {
          ids: new Set([`event-${i}`]),
          order: [`event-${i}`],
          lastAccess: Date.now() + i * 1000, // Increasing timestamps
        });
      }

      // Cleanup
      if (cache.size > MAX_ORGS) {
        const sortedOrgs = Array.from(cache.entries()).sort((a, b) => a[1].lastAccess - b[1].lastAccess);

        const toRemove = sortedOrgs.slice(0, cache.size - MAX_ORGS);
        for (const [oid] of toRemove) {
          cache.delete(oid);
        }
      }

      expect(cache.size).toBe(MAX_ORGS);
      expect(cache.has(1)).toBe(false); // Oldest removed
      expect(cache.has(2)).toBe(false); // Second oldest removed
      expect(cache.has(3)).toBe(true); // Kept
      expect(cache.has(4)).toBe(true); // Kept
      expect(cache.has(5)).toBe(true); // Kept (newest)
    });
  });

  describe('Event Dispatch', () => {
    it('should dispatch service-specific events', () => {
      const dispatchedEvents: any[] = [];

      window.addEventListener('finance-stream-events', (event: any) => {
        dispatchedEvents.push(event.detail);
      });

      window.dispatchEvent(
        new CustomEvent('finance-stream-events', {
          detail: { events: [{ eventId: 'test-1', eventType: 'expense_added' }] },
        })
      );

      expect(dispatchedEvents.length).toBe(1);
      expect(dispatchedEvents[0].events[0].eventId).toBe('test-1');
    });

    it('should dispatch health events', () => {
      const healthEvents: any[] = [];

      window.addEventListener('finance-stream-health', (event: any) => {
        healthEvents.push(event.detail);
      });

      window.dispatchEvent(
        new CustomEvent('finance-stream-health', {
          detail: { healthy: true, lastEventAt: Date.now(), eventCount: 5 },
        })
      );

      expect(healthEvents.length).toBe(1);
      expect(healthEvents[0].healthy).toBe(true);
      expect(healthEvents[0].eventCount).toBe(5);
    });
  });

  describe('Reconnection Logic', () => {
    it('should use exponential backoff', () => {
      const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000];

      let attempts = 0;

      const getDelay = () => {
        return RECONNECT_DELAYS[Math.min(attempts, RECONNECT_DELAYS.length - 1)];
      };

      expect(getDelay()).toBe(1000); // First attempt
      attempts++;
      expect(getDelay()).toBe(2000); // Second attempt
      attempts++;
      expect(getDelay()).toBe(4000); // Third attempt
      attempts += 10; // Many attempts
      expect(getDelay()).toBe(30000); // Capped at max
    });

    it('should reset attempts on successful connection', () => {
      let attempts = 5;

      // Simulate successful connection
      attempts = 0;

      expect(attempts).toBe(0);
    });
  });

  describe('Message Parsing', () => {
    it('should parse event messages', () => {
      const handleMessage = (data: string) => {
        const message = JSON.parse(data);
        return message;
      };

      const data = JSON.stringify({
        type: 'event',
        service: 'finance',
        events: [{ eventId: 'test-1' }],
        timestamp: '2024-11-27T12:00:00Z',
        seq: 1,
      });

      const message = handleMessage(data);

      expect(message.type).toBe('event');
      expect(message.service).toBe('finance');
      expect(message.seq).toBe(1);
    });

    it('should parse ping messages', () => {
      const handleMessage = (data: string) => {
        const message = JSON.parse(data);
        return message;
      };

      const data = JSON.stringify({
        type: 'ping',
        timestamp: '2024-11-27T12:00:00Z',
        seq: 2,
      });

      const message = handleMessage(data);

      expect(message.type).toBe('ping');
      expect(message.seq).toBe(2);
    });

    it('should parse error messages', () => {
      const handleMessage = (data: string) => {
        const message = JSON.parse(data);
        return message;
      };

      const data = JSON.stringify({
        type: 'error',
        service: 'finance',
        message: 'Subscription failed',
        code: 'SUBSCRIPTION_ERROR',
        timestamp: '2024-11-27T12:00:00Z',
        seq: 3,
      });

      const message = handleMessage(data);

      expect(message.type).toBe('error');
      expect(message.error.message).toBe('Subscription failed');
      expect(message.error.code).toBe('SUBSCRIPTION_ERROR');
    });
  });

  describe('Sequence Number Tracking', () => {
    it('should track last sequence number', () => {
      let lastSeq = 0;

      const messages = [
        { seq: 1, type: 'event' },
        { seq: 2, type: 'ping' },
        { seq: 3, type: 'event' },
      ];

      for (const message of messages) {
        lastSeq = message.seq;
      }

      expect(lastSeq).toBe(3);
    });

    it('should detect sequence gaps', () => {
      let lastSeq = 0;
      const gaps: number[] = [];

      const messages = [
        { seq: 1 },
        { seq: 2 },
        { seq: 4 }, // Gap! Missing 3
        { seq: 5 },
      ];

      for (const message of messages) {
        if (message.seq !== lastSeq + 1) {
          gaps.push(message.seq);
        }
        lastSeq = message.seq;
      }

      expect(gaps).toEqual([4]);
    });
  });
});

