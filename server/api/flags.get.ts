import { createConfig } from '../utils/config'

/**
 * Flags API endpoint
 *
 * Returns all feature flags for client-side consumption.
 * Clients poll this endpoint every 10 seconds.
 *
 * Caching strategy is handled by the config service:
 * - Fresh cache (< 5 min): served from KV
 * - Stale cache or miss: fetch from GrowthBook, fallback to stale/defaults
 */
export default defineEventHandler(async (event) => {
  const env = event.context.cloudflare.env as Env & { GROWTHBOOK_SDK_KEY?: string }
  const config = createConfig(env)

  try {
    const flags = await config.getAll()

    return {
      success: true,
      flags,
      timestamp: Date.now(),
    }
  } catch (error) {
    console.error('Error fetching flags:', error)

    // Return error but don't fail - client should use cached values
    return {
      success: false,
      error: 'Failed to fetch flags',
      timestamp: Date.now(),
    }
  } finally {
    config.destroy()
  }
})
