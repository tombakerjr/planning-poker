import { watch, onMounted, onUnmounted } from 'vue'

export type ColorMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'planning-poker-theme'

export function useColorMode() {
  // Use Nuxt's useState for SSR-safe global state
  // Unlike module-level refs, useState is isolated per request in SSR
  const preference = useState<ColorMode>('theme-preference', () => 'system')
  const isDark = useState<boolean>('theme-is-dark', () => false)
  // Track initialization to prevent duplicate syncs across component instances
  const clientInitialized = useState<boolean>('theme-client-initialized', () => false)

  // Get system preference
  const getSystemPreference = (): boolean => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }

  // Check if dark class is present on document (set by inline script)
  const getDarkFromDOM = (): boolean => {
    if (typeof document === 'undefined') return false
    return document.documentElement.classList.contains('dark')
  }

  // Apply theme to DOM
  const applyTheme = (dark: boolean) => {
    if (typeof document === 'undefined') return

    if (dark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  // Update isDark based on preference
  const updateTheme = () => {
    const shouldBeDark = preference.value === 'dark' ||
      (preference.value === 'system' && getSystemPreference())

    isDark.value = shouldBeDark
    applyTheme(shouldBeDark)
  }

  // Load preference from localStorage
  const loadPreference = () => {
    if (typeof window === 'undefined') return

    const stored = localStorage.getItem(STORAGE_KEY) as ColorMode | null
    if (stored && ['light', 'dark', 'system'].includes(stored)) {
      preference.value = stored
    }
  }

  // Sync state on client before first render to prevent hydration mismatch.
  // The inline script in nuxt.config.ts sets the 'dark' class synchronously,
  // but Vue's useState defaults to false. We sync once per client session.
  if (typeof window !== 'undefined' && !clientInitialized.value) {
    clientInitialized.value = true
    // Sync isDark with actual DOM state (set by inline script in nuxt.config.ts)
    isDark.value = getDarkFromDOM()
    // Load stored preference to keep refs in sync
    loadPreference()
  }

  // Save preference to localStorage
  const savePreference = (mode: ColorMode) => {
    if (typeof window === 'undefined') return
    localStorage.setItem(STORAGE_KEY, mode)
  }

  // Set color mode
  const setColorMode = (mode: ColorMode) => {
    preference.value = mode
    savePreference(mode)
    updateTheme()
  }

  // Toggle between light and dark (smart toggle)
  const toggleColorMode = () => {
    if (preference.value === 'system') {
      // If on system, switch to opposite of current
      setColorMode(isDark.value ? 'light' : 'dark')
    } else if (preference.value === 'light') {
      setColorMode('dark')
    } else {
      setColorMode('light')
    }
  }

  // Initialize on client-side
  onMounted(() => {
    // Note: loadPreference() already called in init block (lines 60-66)
    // for first component instance. Skip here since useState persists the value.
    updateTheme()

    // Listen for system theme changes
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = () => {
        if (preference.value === 'system') {
          updateTheme()
        }
      }

      // Modern browsers
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange)
        onUnmounted(() => {
          mediaQuery.removeEventListener('change', handleChange)
        })
      } else {
        // Fallback for older browsers
        mediaQuery.addListener(handleChange)
        onUnmounted(() => {
          mediaQuery.removeListener(handleChange)
        })
      }
    }
  })

  // Watch for preference changes
  watch(preference, updateTheme)

  return {
    preference,
    isDark,
    setColorMode,
    toggleColorMode,
  }
}
