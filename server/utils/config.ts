import { GrowthBook } from '@growthbook/growthbook'

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
  private growthbook: GrowthBook | null = null

  constructor(
    private env: Env & { GROWTHBOOK_SDK_KEY?: string },
  ) {}

  /**
   * Initialize GrowthBook and load flags
   */
  private async initGrowthBook(): Promise<void> {
    if (this.growthbook) return

    const sdkKey = this.env.GROWTHBOOK_SDK_KEY
    if (!sdkKey) {
      console.warn('GROWTHBOOK_SDK_KEY not found, using defaults')
      return
    }

    try {
      this.growthbook = new GrowthBook({
        apiHost: 'https://cdn.growthbook.io',
        clientKey: sdkKey,
        enableDevMode: false,
      })

      // Load features from GrowthBook CDN
      await this.growthbook.loadFeatures({ timeout: 3000 })
    } catch (error) {
      console.error('Failed to initialize GrowthBook:', error)
      this.growthbook = null
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

    // Initialize GrowthBook if needed
    await this.initGrowthBook()

    // Fetch fresh flags from GrowthBook
    if (this.growthbook) {
      try {
        const flags: Partial<FlagDefaults> = {
          APP_ENABLED: this.growthbook.getFeatureValue('APP_ENABLED', DEFAULTS.APP_ENABLED),
          HEARTBEAT_INTERVAL_MS: this.growthbook.getFeatureValue('HEARTBEAT_INTERVAL_MS', DEFAULTS.HEARTBEAT_INTERVAL_MS),
          AUTO_REVEAL_DELAY_MS: this.growthbook.getFeatureValue('AUTO_REVEAL_DELAY_MS', DEFAULTS.AUTO_REVEAL_DELAY_MS),
          MAX_MESSAGE_SIZE: this.growthbook.getFeatureValue('MAX_MESSAGE_SIZE', DEFAULTS.MAX_MESSAGE_SIZE),
          MAX_CONNECTIONS_PER_DO: this.growthbook.getFeatureValue('MAX_CONNECTIONS_PER_DO', DEFAULTS.MAX_CONNECTIONS_PER_DO),
          MAX_MESSAGES_PER_SECOND: this.growthbook.getFeatureValue('MAX_MESSAGES_PER_SECOND', DEFAULTS.MAX_MESSAGES_PER_SECOND),
          RATE_LIMIT_WINDOW_MS: this.growthbook.getFeatureValue('RATE_LIMIT_WINDOW_MS', DEFAULTS.RATE_LIMIT_WINDOW_MS),
          LOG_LEVEL: this.growthbook.getFeatureValue('LOG_LEVEL', DEFAULTS.LOG_LEVEL),
        }

        // Update cache
        await this.setCachedFlags(flags)
        return flags
      } catch (error) {
        console.error('Failed to fetch flags from GrowthBook:', error)
      }
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
   * Clean up GrowthBook instance
   */
  destroy(): void {
    if (this.growthbook) {
      this.growthbook.destroy()
      this.growthbook = null
    }
  }
}

/**
 * Create a new Config instance
 */
export function createConfig(env: Env & { GROWTHBOOK_SDK_KEY?: string }): Config {
  return new Config(env)
}
