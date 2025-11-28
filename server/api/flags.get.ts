import { createConfig } from '../utils/config';

/**
 * Flags API endpoint
 *
 * Returns all feature flags for client-side consumption.
 * Clients poll this endpoint every 10 seconds.
 *
 * Flags are read from KV where GrowthBook webhook pushes updates.
 * No network requests to GrowthBook at runtime - instant updates via webhook.
 */
export default defineEventHandler(async (event) => {
  const env = event.context.cloudflare.env as Env;
  const config = createConfig(env);

  try {
    const flags = await config.getAll();

    return {
      success: true,
      flags,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error('Error fetching flags:', error);

    // Return error but don't fail - client should use cached values
    return {
      success: false,
      error: 'Failed to fetch flags',
      timestamp: Date.now(),
    };
  } finally {
    config.destroy();
  }
});
