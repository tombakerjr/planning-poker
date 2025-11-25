// Flag value types
export interface FlagDefaults {
  APP_ENABLED: boolean
  HEARTBEAT_INTERVAL_MS: number
  AUTO_REVEAL_DELAY_MS: number
  MAX_MESSAGE_SIZE: number
  MAX_CONNECTIONS_PER_DO: number
  MAX_MESSAGES_PER_SECOND: number
  RATE_LIMIT_WINDOW_MS: number
  LOG_LEVEL: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
}

// Hardcoded defaults matching current production values
const DEFAULTS: FlagDefaults = {
  APP_ENABLED: true,
  HEARTBEAT_INTERVAL_MS: 30000,
  AUTO_REVEAL_DELAY_MS: 150,
  MAX_MESSAGE_SIZE: 10240,
  MAX_CONNECTIONS_PER_DO: 100,
  MAX_MESSAGES_PER_SECOND: 10,
  RATE_LIMIT_WINDOW_MS: 1000,
  LOG_LEVEL: 'WARN',
}

// KV key where GrowthBook webhook stores the payload
const PAYLOAD_KEY = 'gb_payload'

/**
 * Config service for feature flags with GrowthBook
 *
 * Uses GrowthBook SDK Webhooks for instant flag updates:
 * 1. GrowthBook pushes payload to FLAGS_CACHE KV via webhook when flags change
 * 2. Read payload directly from KV (zero network requests at runtime)
 * 3. Fall back to hardcoded defaults if KV read fails
 */
export class Config {
  private flags: Partial<FlagDefaults> | null = null
  private flagsPromise: Promise<Partial<FlagDefaults>> | null = null

  constructor(
    private env: Env,
  ) {}

  /**
   * Fetch flags from KV payload (pushed by GrowthBook webhook)
   */
  private async fetchFlags(): Promise<Partial<FlagDefaults>> {
    try {
      // Read payload directly from KV (pushed by GrowthBook webhook)
      const payloadJson = await this.env.FLAGS_CACHE.get(PAYLOAD_KEY, 'text')

      if (!payloadJson) {
        console.warn('No payload found in KV, using defaults')
        return {}
      }

      const payload = JSON.parse(payloadJson) as { features: Record<string, any> }

      if (!payload?.features) {
        console.warn('Invalid payload structure in KV, using defaults')
        return {}
      }

      const features = payload.features

      const flags: Partial<FlagDefaults> = {
        APP_ENABLED: features.APP_ENABLED?.defaultValue ?? DEFAULTS.APP_ENABLED,
        HEARTBEAT_INTERVAL_MS: features.HEARTBEAT_INTERVAL_MS?.defaultValue ?? DEFAULTS.HEARTBEAT_INTERVAL_MS,
        AUTO_REVEAL_DELAY_MS: features.AUTO_REVEAL_DELAY_MS?.defaultValue ?? DEFAULTS.AUTO_REVEAL_DELAY_MS,
        MAX_MESSAGE_SIZE: features.MAX_MESSAGE_SIZE?.defaultValue ?? DEFAULTS.MAX_MESSAGE_SIZE,
        MAX_CONNECTIONS_PER_DO: features.MAX_CONNECTIONS_PER_DO?.defaultValue ?? DEFAULTS.MAX_CONNECTIONS_PER_DO,
        MAX_MESSAGES_PER_SECOND: features.MAX_MESSAGES_PER_SECOND?.defaultValue ?? DEFAULTS.MAX_MESSAGES_PER_SECOND,
        RATE_LIMIT_WINDOW_MS: features.RATE_LIMIT_WINDOW_MS?.defaultValue ?? DEFAULTS.RATE_LIMIT_WINDOW_MS,
        LOG_LEVEL: features.LOG_LEVEL?.defaultValue ?? DEFAULTS.LOG_LEVEL,
      }

      return flags
    } catch (error) {
      console.error('Failed to read flags from KV:', error)
      return {}
    }
  }

  /**
   * Ensure flags are loaded, using Promise memoization to prevent concurrent KV reads
   */
  private async ensureFlags(): Promise<Partial<FlagDefaults>> {
    if (this.flags) {
      return this.flags
    }

    // Use Promise memoization: concurrent calls wait on the same Promise
    if (!this.flagsPromise) {
      this.flagsPromise = this.fetchFlags().then(flags => {
        this.flags = flags
        return flags
      })
    }

    return this.flagsPromise
  }

  /**
   * Get a feature flag value by key
   */
  async get<K extends keyof FlagDefaults>(key: K): Promise<FlagDefaults[K]> {
    const flags = await this.ensureFlags()
    const value = flags[key]
    return value !== undefined ? value : DEFAULTS[key]
  }

  /**
   * Get all flags as an object
   */
  async getAll(): Promise<FlagDefaults> {
    const flags = await this.ensureFlags()
    return {
      ...DEFAULTS,
      ...flags,
    }
  }

  /**
   * Clean up (no-op now that we're fetching directly from CDN)
   */
  destroy(): void {
    // No cleanup needed
  }
}

/**
 * Create a new Config instance
 */
export function createConfig(env: Env): Config {
  return new Config(env)
}
