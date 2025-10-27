import { ref, computed } from 'vue'

export type VotingScaleType = 'fibonacci' | 'modified-fibonacci' | 't-shirt' | 'powers-of-2' | 'linear' | 'custom'

export interface VotingScale {
  id: VotingScaleType
  name: string
  description: string
  values: (string | number)[]
}

// Predefined voting scales
export const VOTING_SCALES: Record<VotingScaleType, VotingScale> = {
  'fibonacci': {
    id: 'fibonacci',
    name: 'Fibonacci',
    description: 'Classic Fibonacci sequence',
    values: [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, '?', '☕'],
  },
  'modified-fibonacci': {
    id: 'modified-fibonacci',
    name: 'Modified Fibonacci',
    description: 'Fibonacci with half points and larger values',
    values: [0, '½', 1, 2, 3, 5, 8, 13, 20, 40, 100, '?', '☕'],
  },
  't-shirt': {
    id: 't-shirt',
    name: 'T-Shirt Sizes',
    description: 'Relative sizing with t-shirt sizes',
    values: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?'],
  },
  'powers-of-2': {
    id: 'powers-of-2',
    name: 'Powers of 2',
    description: 'Exponential growth pattern',
    values: [1, 2, 4, 8, 16, 32, 64, '?'],
  },
  'linear': {
    id: 'linear',
    name: 'Linear',
    description: 'Sequential 1-10 scale',
    values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, '?'],
  },
  'custom': {
    id: 'custom',
    name: 'Custom',
    description: 'User-defined values',
    values: [], // Will be populated by user
  },
}

const STORAGE_KEY = 'planning-poker-scale'

// Global state for current scale
const currentScaleType = ref<VotingScaleType>('fibonacci')
const customValues = ref<(string | number)[]>([])

export function useVotingScale() {
  // Get the current scale configuration
  const currentScale = computed<VotingScale>(() => {
    const scale = VOTING_SCALES[currentScaleType.value]
    if (currentScaleType.value === 'custom' && customValues.value.length > 0) {
      return {
        ...scale,
        values: customValues.value,
      }
    }
    return scale
  })

  // Get all available scales
  const availableScales = computed(() => Object.values(VOTING_SCALES))

  // Load scale preference from localStorage
  const loadPreference = () => {
    if (typeof window === 'undefined') return

    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.scaleType && VOTING_SCALES[parsed.scaleType]) {
          currentScaleType.value = parsed.scaleType
          if (parsed.scaleType === 'custom' && parsed.customValues) {
            customValues.value = parsed.customValues
          }
        }
      }
    } catch (error) {
      console.error('Failed to load voting scale preference:', error)
    }
  }

  // Save scale preference to localStorage
  const savePreference = () => {
    if (typeof window === 'undefined') return

    try {
      const data = {
        scaleType: currentScaleType.value,
        customValues: currentScaleType.value === 'custom' ? customValues.value : undefined,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      console.error('Failed to save voting scale preference:', error)
    }
  }

  // Set the current voting scale
  const setScale = (scaleType: VotingScaleType, customVals?: (string | number)[]) => {
    currentScaleType.value = scaleType
    if (scaleType === 'custom' && customVals) {
      customValues.value = customVals
    }
    savePreference()
  }

  // Set custom scale values
  const setCustomValues = (values: (string | number)[]) => {
    customValues.value = values
    if (currentScaleType.value === 'custom') {
      savePreference()
    }
  }

  // Initialize from localStorage on first use
  loadPreference()

  return {
    currentScale,
    currentScaleType,
    availableScales,
    customValues,
    setScale,
    setCustomValues,
    loadPreference,
  }
}
