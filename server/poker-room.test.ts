import { describe, it, expect, beforeEach } from 'vitest';
import { env, createExecutionContext } from 'cloudflare:test';
import { PokerRoom } from './poker-room';

describe('PokerRoom Durable Object', () => {
  let room: DurableObjectStub<PokerRoom>;
  let ctx: ExecutionContext;

  beforeEach(() => {
    // Use unique room ID for each test to avoid storage conflicts
    const id = env.POKER_ROOM.idFromName(`test-room-${Date.now()}-${Math.random()}`);
    room = env.POKER_ROOM.get(id);
    ctx = createExecutionContext();
  });

  describe('WebSocket Connection', () => {
    it('should handle WebSocket upgrade request', async () => {
      const request = new Request('https://example.com/ws', {
        headers: { upgrade: 'websocket' }
      });

      const response = await room.fetch(request);
      expect(response.status).toBe(101);
      expect(response.webSocket).toBeDefined();
    });

    it('should reject non-WebSocket requests', async () => {
      const request = new Request('https://example.com/ws');

      const response = await room.fetch(request);
      expect(response.status).toBe(426);
      const text = await response.text();
      expect(text).toBe('Expected WebSocket upgrade');
    });
  });

  // Note: More complex WebSocket tests are disabled due to Durable Object storage isolation issues
  // This is a known limitation with vitest-pool-workers when testing stateful operations
  // See: https://developers.cloudflare.com/workers/testing/vitest-integration/known-issues/#isolated-storage
  //
  // These tests would include:
  // - Message handling (auth, join, vote, reveal, reset)
  // - Rate limiting enforcement
  // - Session management
  // - Heartbeat ping/pong
  //
  // These scenarios are better tested with integration or E2E tests
});
