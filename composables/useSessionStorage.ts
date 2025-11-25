import { ref, computed, readonly } from 'vue'

/**
 * Session Storage Composable for Phase 6: Local-First Session Management
 *
 * Manages:
 * - Recent rooms list (last 10 visited)
 * - Voting session history with metadata
 * - User preferences
 * - Export functionality (JSON/CSV)
 */

// Storage keys
const STORAGE_KEYS = {
  RECENT_ROOMS: 'planning-poker-recent-rooms',
  SESSION_HISTORY: 'planning-poker-session-history',
  USER_PREFERENCES: 'planning-poker-preferences',
} as const

// Types
export interface RecentRoom {
  roomId: string
  name: string  // User's name in that room
  lastVisited: number  // Timestamp
  storyTitle?: string  // Last story being estimated
}

export interface VotingRound {
  storyTitle: string
  votes: Record<string, string | number | null>  // participantName -> vote
  average: number | null
  median: number | null
  consensus: number | null  // percentage
  completedAt: number
}

export interface SessionHistory {
  roomId: string
  userName: string
  joinedAt: number
  leftAt: number | null
  participantCount: number
  roundCount: number
  rounds: VotingRound[]
  votingScale: string
}

export interface UserPreferences {
  defaultVotingScale: string
  autoReveal: boolean
  // Theme is handled separately by useColorMode
}

const MAX_RECENT_ROOMS = 10
const MAX_SESSION_HISTORY = 10

// Global state (singleton pattern)
const recentRooms = ref<RecentRoom[]>([])
const sessionHistory = ref<SessionHistory[]>([])
const userPreferences = ref<UserPreferences>({
  defaultVotingScale: 'fibonacci',
  autoReveal: false,
})

let initialized = false

// Reset function for testing - clears all state
export function resetSessionStorage() {
  recentRooms.value = []
  sessionHistory.value = []
  userPreferences.value = {
    defaultVotingScale: 'fibonacci',
    autoReveal: false,
  }
  initialized = false
}

export function useSessionStorage() {
  // Initialize from localStorage on first call (client-side only)
  if (typeof window !== 'undefined' && !initialized) {
    initialized = true
    loadFromStorage()
  }

  // Load all data from localStorage
  function loadFromStorage() {
    try {
      // Load recent rooms
      const storedRooms = localStorage.getItem(STORAGE_KEYS.RECENT_ROOMS)
      if (storedRooms) {
        const parsed = JSON.parse(storedRooms)
        if (Array.isArray(parsed)) {
          recentRooms.value = parsed
        }
      }

      // Load session history
      const storedHistory = localStorage.getItem(STORAGE_KEYS.SESSION_HISTORY)
      if (storedHistory) {
        const parsed = JSON.parse(storedHistory)
        if (Array.isArray(parsed)) {
          sessionHistory.value = parsed
        }
      }

      // Load user preferences
      const storedPrefs = localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES)
      if (storedPrefs) {
        const parsed = JSON.parse(storedPrefs)
        userPreferences.value = { ...userPreferences.value, ...parsed }
      }
    } catch (error) {
      console.error('[SessionStorage] Failed to load from localStorage:', error)
    }
  }

  // Save recent rooms to localStorage
  function saveRecentRooms() {
    try {
      localStorage.setItem(STORAGE_KEYS.RECENT_ROOMS, JSON.stringify(recentRooms.value))
    } catch (error) {
      console.error('[SessionStorage] Failed to save recent rooms:', error)
    }
  }

  // Save session history to localStorage
  function saveSessionHistory() {
    try {
      localStorage.setItem(STORAGE_KEYS.SESSION_HISTORY, JSON.stringify(sessionHistory.value))
    } catch (error) {
      console.error('[SessionStorage] Failed to save session history:', error)
    }
  }

  // Save user preferences to localStorage
  function saveUserPreferences() {
    try {
      localStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(userPreferences.value))
    } catch (error) {
      console.error('[SessionStorage] Failed to save preferences:', error)
    }
  }

  // Add or update a recent room
  function addRecentRoom(room: Omit<RecentRoom, 'lastVisited'>) {
    const now = Date.now()

    // Remove existing entry for this room if present
    recentRooms.value = recentRooms.value.filter(r => r.roomId !== room.roomId)

    // Add to front of list
    recentRooms.value.unshift({
      ...room,
      lastVisited: now,
    })

    // Keep only last N rooms
    if (recentRooms.value.length > MAX_RECENT_ROOMS) {
      recentRooms.value = recentRooms.value.slice(0, MAX_RECENT_ROOMS)
    }

    saveRecentRooms()
  }

  // Update story title for a recent room
  function updateRecentRoomStory(roomId: string, storyTitle: string) {
    const room = recentRooms.value.find(r => r.roomId === roomId)
    if (room) {
      room.storyTitle = storyTitle
      room.lastVisited = Date.now()
      saveRecentRooms()
    }
  }

  // Remove a recent room
  function removeRecentRoom(roomId: string) {
    recentRooms.value = recentRooms.value.filter(r => r.roomId !== roomId)
    saveRecentRooms()
  }

  // Clear all recent rooms
  function clearRecentRooms() {
    recentRooms.value = []
    saveRecentRooms()
  }

  // Add a completed session to history
  function addSessionToHistory(session: Omit<SessionHistory, 'leftAt'>) {
    const now = Date.now()

    // Check if we already have this session (update it)
    const existingIndex = sessionHistory.value.findIndex(
      s => s.roomId === session.roomId && s.joinedAt === session.joinedAt
    )

    if (existingIndex >= 0) {
      // Update existing session
      sessionHistory.value[existingIndex] = {
        ...session,
        leftAt: now,
      }
    } else {
      // Add new session to front
      sessionHistory.value.unshift({
        ...session,
        leftAt: now,
      })

      // Keep only last N sessions
      if (sessionHistory.value.length > MAX_SESSION_HISTORY) {
        sessionHistory.value = sessionHistory.value.slice(0, MAX_SESSION_HISTORY)
      }
    }

    saveSessionHistory()
  }

  // Remove a session from history
  function removeSessionFromHistory(roomId: string, joinedAt: number) {
    sessionHistory.value = sessionHistory.value.filter(
      s => !(s.roomId === roomId && s.joinedAt === joinedAt)
    )
    saveSessionHistory()
  }

  // Clear all session history
  function clearSessionHistory() {
    sessionHistory.value = []
    saveSessionHistory()
  }

  // Update user preferences
  function updatePreferences(prefs: Partial<UserPreferences>) {
    userPreferences.value = { ...userPreferences.value, ...prefs }
    saveUserPreferences()
  }

  // Export session history to JSON
  function exportToJSON(): string {
    const exportData = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      sessions: sessionHistory.value,
      recentRooms: recentRooms.value,
      preferences: userPreferences.value,
    }
    return JSON.stringify(exportData, null, 2)
  }

  // Export session history to CSV
  function exportToCSV(): string {
    const headers = [
      'Room ID',
      'User Name',
      'Joined At',
      'Left At',
      'Duration (min)',
      'Participants',
      'Rounds',
      'Voting Scale',
      'Stories Estimated',
    ]

    const rows = sessionHistory.value.map(session => {
      const duration = session.leftAt
        ? Math.round((session.leftAt - session.joinedAt) / 60000)
        : 'N/A'
      const stories = session.rounds.map(r => r.storyTitle).filter(Boolean).join('; ')

      return [
        session.roomId,
        session.userName,
        new Date(session.joinedAt).toISOString(),
        session.leftAt ? new Date(session.leftAt).toISOString() : 'N/A',
        duration,
        session.participantCount,
        session.roundCount,
        session.votingScale,
        `"${stories.replace(/"/g, '""')}"`,  // Escape quotes for CSV
      ].join(',')
    })

    return [headers.join(','), ...rows].join('\n')
  }

  // Download export file
  function downloadExport(format: 'json' | 'csv') {
    if (typeof window === 'undefined') return

    const content = format === 'json' ? exportToJSON() : exportToCSV()
    const mimeType = format === 'json' ? 'application/json' : 'text/csv'
    const filename = `planning-poker-export-${new Date().toISOString().split('T')[0]}.${format}`

    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Computed: sorted recent rooms (most recent first)
  const sortedRecentRooms = computed(() =>
    [...recentRooms.value].sort((a, b) => b.lastVisited - a.lastVisited)
  )

  // Computed: sorted session history (most recent first)
  const sortedSessionHistory = computed(() =>
    [...sessionHistory.value].sort((a, b) => (b.leftAt || b.joinedAt) - (a.leftAt || a.joinedAt))
  )

  // Computed: session statistics
  const sessionStats = computed(() => {
    if (sessionHistory.value.length === 0) {
      return {
        totalSessions: 0,
        totalRounds: 0,
        avgParticipants: 0,
        avgRoundsPerSession: 0,
      }
    }

    const totalRounds = sessionHistory.value.reduce((sum, s) => sum + s.roundCount, 0)
    const totalParticipants = sessionHistory.value.reduce((sum, s) => sum + s.participantCount, 0)

    return {
      totalSessions: sessionHistory.value.length,
      totalRounds,
      avgParticipants: Math.round(totalParticipants / sessionHistory.value.length * 10) / 10,
      avgRoundsPerSession: Math.round(totalRounds / sessionHistory.value.length * 10) / 10,
    }
  })

  return {
    // State (readonly to prevent direct mutation)
    recentRooms: readonly(recentRooms),
    sessionHistory: readonly(sessionHistory),
    userPreferences: readonly(userPreferences),

    // Computed
    sortedRecentRooms,
    sortedSessionHistory,
    sessionStats,

    // Actions - Recent Rooms
    addRecentRoom,
    updateRecentRoomStory,
    removeRecentRoom,
    clearRecentRooms,

    // Actions - Session History
    addSessionToHistory,
    removeSessionFromHistory,
    clearSessionHistory,

    // Actions - Preferences
    updatePreferences,

    // Actions - Export
    exportToJSON,
    exportToCSV,
    downloadExport,
  }
}
