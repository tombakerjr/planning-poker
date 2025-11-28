import { beforeEach, describe, expect, it } from 'vitest';

import type { FlagDefaults } from './config';

import { Config, createConfig } from './config';

// Mock environment with FLAGS_CACHE KV namespace
const createMockEnv = (kvData: Record<string, string | null> = {}): Env => {
  return {
    FLAGS_CACHE: {
      get: async (key: string) => kvData[key] ?? null,
      put: async () => {},
      delete: async () => {},
      list: async () => ({ keys: [], list_complete: true, cursor: '' }),
      getWithMetadata: async () => ({ value: null, metadata: null }),
    } as unknown as KVNamespace,
    POKER_ROOM: {} as DurableObjectNamespace,
    ASSETS: {} as Fetcher,
  } as Env;
};

describe('Config service', () => {
  describe('createConfig', () => {
    it('should create a Config instance', () => {
      const env = createMockEnv();
      const config = createConfig(env);
      expect(config).toBeInstanceOf(Config);
    });
  });

  describe('get()', () => {
    it('should return default values when KV is empty', async () => {
      const env = createMockEnv();
      const config = new Config(env);

      const appEnabled = await config.get('APP_ENABLED');
      expect(appEnabled).toBe(true);

      const heartbeat = await config.get('HEARTBEAT_INTERVAL_MS');
      expect(heartbeat).toBe(30000);

      const logLevel = await config.get('LOG_LEVEL');
      expect(logLevel).toBe('WARN');
    });

    it('should read flags from KV payload', async () => {
      const payload = {
        features: {
          APP_ENABLED: { defaultValue: false },
          HEARTBEAT_INTERVAL_MS: { defaultValue: 25000 },
          AUTO_REVEAL_DELAY_MS: { defaultValue: 200 },
          MAX_MESSAGE_SIZE: { defaultValue: 5120 },
          MAX_CONNECTIONS_PER_DO: { defaultValue: 50 },
          MAX_MESSAGES_PER_SECOND: { defaultValue: 5 },
          RATE_LIMIT_WINDOW_MS: { defaultValue: 2000 },
          LOG_LEVEL: { defaultValue: 'DEBUG' },
        },
      };

      const env = createMockEnv({
        gb_payload: JSON.stringify(payload),
      });

      const config = new Config(env);

      expect(await config.get('APP_ENABLED')).toBe(false);
      expect(await config.get('HEARTBEAT_INTERVAL_MS')).toBe(25000);
      expect(await config.get('AUTO_REVEAL_DELAY_MS')).toBe(200);
      expect(await config.get('MAX_MESSAGE_SIZE')).toBe(5120);
      expect(await config.get('MAX_CONNECTIONS_PER_DO')).toBe(50);
      expect(await config.get('MAX_MESSAGES_PER_SECOND')).toBe(5);
      expect(await config.get('RATE_LIMIT_WINDOW_MS')).toBe(2000);
      expect(await config.get('LOG_LEVEL')).toBe('DEBUG');
    });

    it('should fall back to defaults when payload has missing features', async () => {
      const payload = {
        features: {
          APP_ENABLED: { defaultValue: false },
          // Other features missing
        },
      };

      const env = createMockEnv({
        gb_payload: JSON.stringify(payload),
      });

      const config = new Config(env);

      expect(await config.get('APP_ENABLED')).toBe(false);
      expect(await config.get('HEARTBEAT_INTERVAL_MS')).toBe(30000); // default
      expect(await config.get('LOG_LEVEL')).toBe('WARN'); // default
    });

    it('should handle invalid JSON in KV gracefully', async () => {
      const env = createMockEnv({
        gb_payload: 'invalid json{{{',
      });

      const config = new Config(env);

      // Should fall back to defaults without throwing
      expect(await config.get('APP_ENABLED')).toBe(true);
      expect(await config.get('HEARTBEAT_INTERVAL_MS')).toBe(30000);
    });

    it('should handle malformed payload structure', async () => {
      const env = createMockEnv({
        gb_payload: JSON.stringify({ wrong: 'structure' }),
      });

      const config = new Config(env);

      // Should fall back to defaults
      expect(await config.get('APP_ENABLED')).toBe(true);
      expect(await config.get('HEARTBEAT_INTERVAL_MS')).toBe(30000);
    });

    it('should cache flags after first fetch', async () => {
      let callCount = 0;
      const env = {
        FLAGS_CACHE: {
          get: async () => {
            callCount++;
            return JSON.stringify({
              features: {
                APP_ENABLED: { defaultValue: false },
              },
            });
          },
        },
      } as unknown as Env;

      const config = new Config(env);

      await config.get('APP_ENABLED');
      await config.get('HEARTBEAT_INTERVAL_MS');
      await config.get('LOG_LEVEL');

      // Should only fetch once, then use cached values
      expect(callCount).toBe(1);
    });
  });

  describe('getAll()', () => {
    it('should return all flags with defaults merged', async () => {
      const payload = {
        features: {
          APP_ENABLED: { defaultValue: false },
          HEARTBEAT_INTERVAL_MS: { defaultValue: 25000 },
        },
      };

      const env = createMockEnv({
        gb_payload: JSON.stringify(payload),
      });

      const config = new Config(env);
      const allFlags = await config.getAll();

      expect(allFlags).toEqual({
        APP_ENABLED: false,
        HEARTBEAT_INTERVAL_MS: 25000,
        AUTO_REVEAL_DELAY_MS: 150, // default
        MAX_MESSAGE_SIZE: 10240, // default
        MAX_CONNECTIONS_PER_DO: 100, // default
        MAX_MESSAGES_PER_SECOND: 10, // default
        RATE_LIMIT_WINDOW_MS: 1000, // default
        LOG_LEVEL: 'WARN', // default
      });
    });

    it('should return all defaults when KV is empty', async () => {
      const env = createMockEnv();
      const config = new Config(env);
      const allFlags = await config.getAll();

      expect(allFlags).toEqual({
        APP_ENABLED: true,
        HEARTBEAT_INTERVAL_MS: 30000,
        AUTO_REVEAL_DELAY_MS: 150,
        MAX_MESSAGE_SIZE: 10240,
        MAX_CONNECTIONS_PER_DO: 100,
        MAX_MESSAGES_PER_SECOND: 10,
        RATE_LIMIT_WINDOW_MS: 1000,
        LOG_LEVEL: 'WARN',
      });
    });
  });

  describe('destroy()', () => {
    it('should not throw when called', () => {
      const env = createMockEnv();
      const config = new Config(env);

      expect(() => config.destroy()).not.toThrow();
    });
  });
});
