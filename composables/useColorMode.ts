import { watch, onMounted, onUnmounted } from 'vue'

export type ColorMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'planning-poker-theme'

// Track if we've already initialized on client (this is safe as module-level
// because it's a primitive that only matters client-side)
let clientInitialized = false

export function useColorMode() {
  // Use Nuxt's useState for SSR-safe global state
  // Unlike module-level refs, useState is isolated per request in SSR
  const preference = useState<ColorMode>('theme-preference', () => 'system')
  const isDark = useState<boolean>('theme-is-dark', () => false)

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

  // Bug fix: Immediately sync state on client before first render
  // This prevents hydration mismatch where inline script set dark class
  // but Vue refs still have default values
  if (typeof window !== 'undefined' && !clientInitialized) {
    clientInitialized = true
    // Sync isDark with actual DOM state (set by inline script in nuxt.config.ts)
    isDark.value = getDarkFromDOM()
    // Load stored preference to keep refs in sync
    const stored = localStorage.getItem(STORAGE_KEY) as ColorMode | null
    if (stored && ['light', 'dark', 'system'].includes(stored)) {
      preference.value = stored
    }
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
    loadPreference()
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
