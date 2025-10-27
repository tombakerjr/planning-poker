import { computed, type ComputedRef } from 'vue'

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

// Get all available scales (excluding custom until fully implemented)
export const AVAILABLE_SCALES = Object.values(VOTING_SCALES).filter(scale => scale.id !== 'custom')

/**
 * Utility composable for voting scales - no state management, just utilities
 * Scale state is managed by room state (roomState.votingScale), not global state
 * This prevents issues with multiple rooms open in different tabs
 */
export function useVotingScale(scaleId?: ComputedRef<string | undefined> | string) {
  // Get scale by ID, defaulting to fibonacci
  const getScale = (id: string | undefined): VotingScale => {
    const scaleType = (id || 'fibonacci') as VotingScaleType
    return VOTING_SCALES[scaleType] || VOTING_SCALES['fibonacci']
  }

  // If scaleId is provided, return a computed scale
  const currentScale = computed(() => {
    if (typeof scaleId === 'string') {
      return getScale(scaleId)
    } else if (scaleId) {
      return getScale(scaleId.value)
    }
    return VOTING_SCALES['fibonacci']
  })

  return {
    currentScale,
    availableScales: AVAILABLE_SCALES,
    getScale,
    VOTING_SCALES,
  }
}
