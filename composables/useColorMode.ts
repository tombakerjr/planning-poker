import { ref, watch, onMounted } from 'vue'

export type ColorMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'planning-poker-theme'

// Global state for theme
const preference = ref<ColorMode>('system')
const isDark = ref(false)

export function useColorMode() {
  // Get system preference
  const getSystemPreference = (): boolean => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
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
      } else {
        // Fallback for older browsers
        mediaQuery.addListener(handleChange)
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
