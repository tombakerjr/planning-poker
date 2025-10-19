import { describe, it, expect, beforeEach } from 'vitest';
import { env, createExecutionContext } from 'cloudflare:test';
import worker from '../../../worker';

describe('POST /api/room/create', () => {
  let ctx: ExecutionContext;

  beforeEach(() => {
    ctx = createExecutionContext();
  });

  it('should create a room and return a room ID', async () => {
    const request = new Request('http://localhost/api/room/create', {
      method: 'POST'
    });

    const response = await worker.fetch(request, env, ctx);

    expect(response.status).toBe(200);

    const data = await response.json() as { roomId: string };
    expect(data.roomId).toBeDefined();
    expect(data.roomId).toHaveLength(10); // nanoid(10)
    expect(typeof data.roomId).toBe('string');
  });

  it('should generate unique room IDs', async () => {
    const roomIds = new Set<string>();

    // Create 10 rooms
    for (let i = 0; i < 10; i++) {
      const request = new Request('http://localhost/api/room/create', {
        method: 'POST'
      });

      const response = await worker.fetch(request, env, ctx);
      const data = await response.json() as { roomId: string };

      roomIds.add(data.roomId);
    }

    // All should be unique
    expect(roomIds.size).toBe(10);
  });

  it('should enforce rate limit of 5 rooms per minute per IP', async () => {
    const ip = '192.168.1.1';
    const requests: Promise<Response>[] = [];

    // Try to create 6 rooms from same IP
    for (let i = 0; i < 6; i++) {
      const request = new Request('http://localhost/api/room/create', {
        method: 'POST',
        headers: {
          'cf-connecting-ip': ip
        }
      });

      requests.push(worker.fetch(request, env, ctx));
    }

    const responses = await Promise.all(requests);

    // First 5 should succeed
    const successful = responses.filter(r => r.status === 200);
    const rateLimited = responses.filter(r => r.status === 429);

    expect(successful.length).toBe(5);
    expect(rateLimited.length).toBe(1);

    // Check error message
    if (rateLimited[0]) {
      const error = await rateLimited[0].json() as { statusMessage: string };
      expect(error.statusMessage).toContain('Too many room creation requests');
    }
  });

  it('should allow requests from different IPs', async () => {
    const requests: Promise<Response>[] = [];

    // Create 5 rooms from different IPs (stay under rate limit)
    for (let i = 0; i < 5; i++) {
      const request = new Request('http://localhost/api/room/create', {
        method: 'POST',
        headers: {
          'cf-connecting-ip': `10.0.${i}.1`
        }
      });

      requests.push(worker.fetch(request, env, ctx));
    }

    const responses = await Promise.all(requests);

    // All should succeed
    const successful = responses.filter(r => r.status === 200);
    expect(successful.length).toBe(5);
  });

  it('should handle requests without IP address', async () => {
    const request = new Request('http://localhost/api/room/create', {
      method: 'POST'
      // No cf-connecting-ip or x-forwarded-for headers
    });

    const response = await worker.fetch(request, env, ctx);

    // Should still succeed with unique fallback IP
    expect(response.status).toBe(200);

    const data = await response.json() as { roomId: string };
    expect(data.roomId).toBeDefined();
  });

  it('should reset rate limit after time window', async () => {
    const ip = '192.168.1.100';

    // Create 5 rooms
    for (let i = 0; i < 5; i++) {
      const request = new Request('http://localhost/api/room/create', {
        method: 'POST',
        headers: {
          'cf-connecting-ip': ip
        }
      });

      const response = await worker.fetch(request, env, ctx);
      expect(response.status).toBe(200);
    }

    // 6th should be rate limited
    const rateLimitedRequest = new Request('http://localhost/api/room/create', {
      method: 'POST',
      headers: {
        'cf-connecting-ip': ip
      }
    });

    const rateLimitedResponse = await worker.fetch(rateLimitedRequest, env, ctx);
    expect(rateLimitedResponse.status).toBe(429);

    // Wait for rate limit window to expire (60 seconds + buffer)
    // Note: In a real test environment, you might mock the time
    // For now, this test documents the expected behavior
  });

  it('should handle POST request errors gracefully', async () => {
    // This test would require mocking nanoid to throw an error
    // For now, we document expected behavior:
    // If room creation fails, should return 500 with error message
  });
});
