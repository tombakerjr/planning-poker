import type { FlagDefaults } from '../server/utils/config'

interface FlagsResponse {
  success: boolean
  flags?: FlagDefaults
  error?: string
  timestamp: number
}

const POLL_INTERVAL_MS = 60000 // 60 seconds (matches server cache TTL)

/**
 * Client-side feature flags composable
 *
 * Polls /api/flags every 60 seconds and provides reactive access to feature flags.
 * Flags are cached in localStorage as a backup.
 */
export function useFeatureFlags() {
  const flags = useState<FlagDefaults | null>('feature-flags', () => null)
  const isLoading = useState('feature-flags-loading', () => true)
  const error = useState<string | null>('feature-flags-error', () => null)
  const lastUpdate = useState('feature-flags-last-update', () => 0)

  let pollInterval: ReturnType<typeof setInterval> | null = null

  /**
   * Fetch flags from API
   */
  async function fetchFlags(): Promise<void> {
    try {
      const response = await $fetch<FlagsResponse>('/api/flags')

      if (response.success && response.flags) {
        flags.value = response.flags
        lastUpdate.value = response.timestamp
        error.value = null

        // Cache in localStorage for offline use
        if (import.meta.client) {
          localStorage.setItem('feature-flags', JSON.stringify(response.flags))
          localStorage.setItem('feature-flags-timestamp', String(response.timestamp))
        }
      } else {
        error.value = response.error || 'Unknown error fetching flags'
        console.warn('Failed to fetch flags:', error.value)
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Network error'
      console.error('Error fetching flags:', err)

      // Try to load from localStorage as fallback
      if (import.meta.client) {
        const cached = localStorage.getItem('feature-flags')
        const cachedTimestamp = localStorage.getItem('feature-flags-timestamp')

        if (cached && !flags.value) {
          try {
            const parsed = JSON.parse(cached)
            // Validate it's an object with expected structure
            if (parsed && typeof parsed === 'object' && 'APP_ENABLED' in parsed) {
              flags.value = parsed
              lastUpdate.value = cachedTimestamp ? parseInt(cachedTimestamp, 10) : 0
              console.info('Using cached flags from localStorage')
            } else {
              console.warn('Invalid cached flags structure, ignoring')
              localStorage.removeItem('feature-flags')
            }
          } catch (parseError) {
            console.error('Failed to parse cached flags:', parseError)
            localStorage.removeItem('feature-flags')
          }
        }
      }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Start polling for flag updates
   */
  function startPolling(): void {
    if (pollInterval) return

    // Fetch immediately
    fetchFlags()

    // Poll every 10 seconds
    pollInterval = setInterval(fetchFlags, POLL_INTERVAL_MS)
  }

  /**
   * Stop polling
   */
  function stopPolling(): void {
    if (pollInterval) {
      clearInterval(pollInterval)
      pollInterval = null
    }
  }

  /**
   * Get a specific flag value with fallback to default
   */
  function getFlag<K extends keyof FlagDefaults>(
    key: K,
    defaultValue: FlagDefaults[K]
  ): FlagDefaults[K] {
    return flags.value?.[key] ?? defaultValue
  }

  // Auto-start polling on client side
  if (import.meta.client) {
    onMounted(() => {
      startPolling()
    })

    onUnmounted(() => {
      stopPolling()
    })
  }

  return {
    flags: readonly(flags),
    isLoading: readonly(isLoading),
    error: readonly(error),
    lastUpdate: readonly(lastUpdate),
    getFlag,
    refresh: fetchFlags,
    startPolling,
    stopPolling,
  }
}
