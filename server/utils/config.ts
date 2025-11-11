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

// Cache configuration
const CACHE_KEY_PREFIX = 'growthbook:flags'
const FRESH_CACHE_TTL = 5 * 60 // 5 minutes
const STALE_CACHE_TTL = 60 * 60 // 60 minutes

interface CachedFlags {
  flags: Partial<FlagDefaults>
  timestamp: number
  version: string
}

/**
 * Config service for feature flags with GrowthBook
 *
 * Caching strategy:
 * 1. Check FLAGS_CACHE KV for fresh flags (< 5 min old)
 * 2. If stale or missing, fetch from GrowthBook API
 * 3. On fetch success: update cache and return fresh flags
 * 4. On fetch failure: fall back to stale cache (< 60 min) or hardcoded defaults
 */
export class Config {
  private flags: Partial<FlagDefaults> | null = null

  constructor(
    private env: Env & { GROWTHBOOK_SDK_KEY?: string },
  ) {}

  /**
   * Fetch features directly from GrowthBook CDN
   */
  private async fetchFeaturesFromCDN(): Promise<Record<string, any>> {
    const sdkKey = this.env.GROWTHBOOK_SDK_KEY
    if (!sdkKey) {
      console.warn('GROWTHBOOK_SDK_KEY not found, using defaults')
      return {}
    }

    try {
      const response = await fetch(`https://cdn.growthbook.io/api/features/${sdkKey}`)
      if (!response.ok) {
        throw new Error(`GrowthBook CDN returned ${response.status}`)
      }
      const data = await response.json() as { features: Record<string, any> }
      return data.features || {}
    } catch (error) {
      console.error('Failed to fetch from GrowthBook CDN:', error)
      return {}
    }
  }

  /**
   * Fetch flags from cache or GrowthBook
   */
  private async fetchFlags(): Promise<Partial<FlagDefaults>> {
    const now = Date.now()

    // Try cache first
    const cached = await this.getCachedFlags()
    if (cached && now - cached.timestamp < FRESH_CACHE_TTL * 1000) {
      return cached.flags
    }

    // Fetch fresh flags from GrowthBook CDN
    try {
      const features = await this.fetchFeaturesFromCDN()

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

      // Update cache
      await this.setCachedFlags(flags)
      return flags
    } catch (error) {
      console.error('Failed to fetch flags from GrowthBook:', error)
    }

    // Fall back to stale cache or defaults
    if (cached && now - cached.timestamp < STALE_CACHE_TTL * 1000) {
      console.warn('Using stale cached flags')
      return cached.flags
    }

    console.warn('Using hardcoded defaults')
    return {}
  }

  /**
   * Get cached flags from KV
   */
  private async getCachedFlags(): Promise<CachedFlags | null> {
    try {
      const cached = await this.env.FLAGS_CACHE.get(CACHE_KEY_PREFIX, 'json')
      return cached as CachedFlags | null
    } catch (error) {
      console.error('Failed to read from FLAGS_CACHE:', error)
      return null
    }
  }

  /**
   * Store flags in KV cache
   */
  private async setCachedFlags(flags: Partial<FlagDefaults>): Promise<void> {
    try {
      const cached: CachedFlags = {
        flags,
        timestamp: Date.now(),
        version: '1',
      }
      await this.env.FLAGS_CACHE.put(
        CACHE_KEY_PREFIX,
        JSON.stringify(cached),
        { expirationTtl: STALE_CACHE_TTL }
      )
    } catch (error) {
      console.error('Failed to write to FLAGS_CACHE:', error)
    }
  }

  /**
   * Get a feature flag value by key
   */
  async get<K extends keyof FlagDefaults>(key: K): Promise<FlagDefaults[K]> {
    if (!this.flags) {
      this.flags = await this.fetchFlags()
    }

    const value = this.flags[key]
    return value !== undefined ? value : DEFAULTS[key]
  }

  /**
   * Get all flags as an object
   */
  async getAll(): Promise<FlagDefaults> {
    if (!this.flags) {
      this.flags = await this.fetchFlags()
    }

    return {
      ...DEFAULTS,
      ...this.flags,
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
export function createConfig(env: Env & { GROWTHBOOK_SDK_KEY?: string }): Config {
  return new Config(env)
}
