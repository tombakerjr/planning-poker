import { ref, computed, readonly, onUnmounted, type InjectionKey } from 'vue'
import { nanoid } from 'nanoid'
import { useToast } from './useToast'
import { logger } from '~/server/utils/logger'

export interface Participant {
  id: string
  name: string
  vote: string | number | null
}

export interface RoomState {
  participants: Participant[]
  votesRevealed: boolean
  storyTitle: string
  votingScale?: string
}

export interface RoomMessage {
  type: 'update' | 'error' | 'ping' | 'pong'
  payload?: any
}

const MAX_RECONNECT_ATTEMPTS = 10
const HEARTBEAT_INTERVAL_MS = 25000 // 25 seconds (less than server's 30s)
const MAX_NAME_LENGTH = 50
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000 // 24 hours
const IS_DEV = process.env.NODE_ENV === 'development'

export function usePokerRoom(roomId: string) {
  const toast = useToast()

  const roomState = ref<RoomState>({
    participants: [],
    votesRevealed: false,
    storyTitle: '',
    votingScale: 'fibonacci',
  })

  const currentUser = ref<{ id: string; name: string } | null>(null)
  const isJoined = ref(false)
  const status = ref<'CONNECTING' | 'OPEN' | 'CLOSED' | 'RECONNECTING'>('CLOSED')
  const isLoading = ref(false)

  let ws: WebSocket | null = null
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null
  let reconnectAttempts = 0

  // Try to restore user session from localStorage
  const getUserSession = () => {
    if (process.client) {
      const stored = localStorage.getItem(`poker-session-${roomId}`)
      if (stored) {
        try {
          return JSON.parse(stored)
        } catch {
          localStorage.removeItem(`poker-session-${roomId}`)
        }
      }
    }
    return null
  }

  const saveUserSession = (userId: string, name: string) => {
    if (process.client) {
      localStorage.setItem(`poker-session-${roomId}`, JSON.stringify({ userId, name, timestamp: Date.now() }))
    }
  }

  // Generate or restore user ID
  const existingSession = getUserSession()
  const userId = existingSession?.userId || `user-${nanoid()}`

  if (IS_DEV) {
    logger.debug('Room ID:', roomId)
    logger.debug('User ID:', userId)
  }

  function handleMessage(message: RoomMessage) {
    switch (message.type) {
      case 'update':
        if (message.payload) {
          roomState.value = {
            participants: message.payload.participants || [],
            votesRevealed: message.payload.votesRevealed || false,
            storyTitle: message.payload.storyTitle || '',
            votingScale: message.payload.votingScale || 'fibonacci',
          }
        }
        break

      case 'ping':
        // Respond to server ping
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'pong' }))
        }
        break

      case 'pong':
        // Server acknowledged our ping
        break

      case 'error':
        logger.error('Room error:', message.payload?.message)
        toast.error(message.payload?.message || 'An error occurred')
        break

      default:
        logger.warn('Unknown message type:', message.type)
    }
  }

  // WebSocket connection functions
  const connectToRoom = () => {
    if (ws) {
      ws.close()
    }

    if (!process.client) {
      return
    }

    if (IS_DEV) {
      logger.debug('Connecting to room via WebSocket...')
    }
    status.value = 'CONNECTING'

    // Construct WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/api/room/${roomId}/ws`

    if (IS_DEV) {
      logger.debug('WebSocket URL:', wsUrl)
    }

    try {
      ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        if (IS_DEV) {
          logger.debug('WebSocket connection opened')
        }

        // Show reconnection success toast if this was a reconnect
        if (reconnectAttempts > 0) {
          toast.success('Reconnected successfully!')
        }

        status.value = 'OPEN'
        reconnectAttempts = 0 // Reset reconnection counter on successful connection

        // Send authentication message
        if (ws) {
          ws.send(JSON.stringify({
            type: 'auth',
            userId: userId
          }))
        }

        // Start heartbeat
        startHeartbeat()
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          handleMessage(data)
        } catch (error) {
          logger.error('Failed to parse WebSocket message:', error)
        }
      }

      ws.onerror = (error) => {
        logger.error('WebSocket error:', error)
      }

      ws.onclose = (event) => {
        if (IS_DEV) {
          logger.debug('WebSocket closed:', event.code, event.reason)
        }
        stopHeartbeat()

        // Attempt to reconnect with exponential backoff
        if (event.code !== 1000) { // 1000 = normal closure
          if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            logger.error('Max reconnection attempts reached. Please refresh the page.')
            status.value = 'CLOSED'
            toast.error('Connection lost. Please refresh the page to reconnect.', 10000)
            return
          }

          status.value = 'RECONNECTING'

          // Exponential backoff: 1s, 2s, 4s, 8s, ... up to 30s
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000)
          if (IS_DEV) {
            logger.debug(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`)
          }

          // Show reconnection toast
          if (reconnectAttempts === 0) {
            toast.warning('Connection lost. Attempting to reconnect...', delay + 1000)
          }

          reconnectTimeout = setTimeout(() => {
            if (status.value === 'RECONNECTING') {
              reconnectAttempts++
              connectToRoom()
            }
          }, delay)
        } else {
          status.value = 'CLOSED'
        }
      }
    } catch (error) {
      logger.error('Failed to create WebSocket:', error)
      status.value = 'CLOSED'
    }
  }

  const closeConnection = () => {
    if (ws) {
      ws.close(1000, 'User closed connection')
      ws = null
    }
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }
    stopHeartbeat()
    status.value = 'CLOSED'
  }

  const startHeartbeat = () => {
    stopHeartbeat()
    // Send ping to keep connection alive
    heartbeatInterval = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, HEARTBEAT_INTERVAL_MS)
  }

  const stopHeartbeat = () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval)
      heartbeatInterval = null
    }
  }

  // Computed properties
  const myVote = computed(() => {
    if (!currentUser.value) return null
    const participant = roomState.value.participants.find(
      p => p.id === userId
    )
    return participant?.vote || null
  })

  const votingComplete = computed(() => {
    const activeParticipants = roomState.value.participants.filter(p => p.vote !== null)
    return activeParticipants.length === roomState.value.participants.length &&
           roomState.value.participants.length > 0
  })

  const averageVote = computed(() => {
    if (!roomState.value.votesRevealed) return null

    const numericVotes = roomState.value.participants
      .map(p => p.vote)
      .map(vote => {
        // Convert known string representations to numbers (e.g., '½' → 0.5)
        if (vote === '½') return 0.5
        return vote
      })
      .filter((vote): vote is number => typeof vote === 'number')

    if (numericVotes.length === 0) return null

    const sum = numericVotes.reduce((acc, vote) => acc + vote, 0)
    return Math.round((sum / numericVotes.length) * 10) / 10
  })

  const medianVote = computed(() => {
    if (!roomState.value.votesRevealed) return null

    const numericVotes = roomState.value.participants
      .map(p => p.vote)
      .map(vote => {
        // Convert known string representations to numbers (e.g., '½' → 0.5)
        if (vote === '½') return 0.5
        return vote
      })
      .filter((vote): vote is number => typeof vote === 'number')
      .sort((a, b) => a - b)

    if (numericVotes.length === 0) return null

    const mid = Math.floor(numericVotes.length / 2)
    if (numericVotes.length % 2 === 0) {
      return Math.round(((numericVotes[mid - 1] + numericVotes[mid]) / 2) * 10) / 10
    }
    return numericVotes[mid]
  })

  const consensusPercentage = computed(() => {
    if (!roomState.value.votesRevealed) return null

    const votes = roomState.value.participants
      .map(p => p.vote)
      .filter(vote => vote !== null)

    if (votes.length === 0) return null

    // Count occurrences of each vote
    const voteCounts = new Map<string | number, number>()
    votes.forEach(vote => {
      const count = voteCounts.get(vote!) || 0
      voteCounts.set(vote!, count + 1)
    })

    // Find the most common vote count
    const maxCount = Math.max(...Array.from(voteCounts.values()))

    // Calculate percentage of participants who voted for the most common value
    return Math.round((maxCount / votes.length) * 100)
  })

  // Actions
  const joinRoom = async (name: string) => {
    const trimmedName = name.trim().substring(0, MAX_NAME_LENGTH);

    if (!trimmedName) {
      logger.error('Name is required to join room')
      return false
    }

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      logger.error('WebSocket is not connected')
      return false
    }

    try {
      // Set up the current user
      currentUser.value = {
        id: userId,
        name: trimmedName
      }

      // Save session for recovery
      saveUserSession(userId, trimmedName)

      // Send join message via WebSocket
      ws.send(JSON.stringify({
        type: 'join',
        name: trimmedName
      }))

      isJoined.value = true
      return true
    } catch (error) {
      logger.error('Failed to join room:', error)
      return false
    }
  }

  // Try to auto-rejoin if we have a saved session
  const tryAutoRejoin = () => {
    const session = getUserSession()
    if (session && session.name) {
      // Check if session is recent (verify timestamp exists to avoid NaN)
      if (session.timestamp && (Date.now() - session.timestamp) < SESSION_EXPIRY_MS) {
        return joinRoom(session.name)
      } else {
        // Clear old or invalid session
        if (process.client) {
          localStorage.removeItem(`poker-session-${roomId}`)
        }
      }
    }
    return false
  }

  const vote = async (voteValue: string | number | null) => {
    if (!isJoined.value) {
      toast.error('Must join room before voting')
      return false
    }

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      toast.error('Not connected to room')
      return false
    }

    try {
      isLoading.value = true
      ws.send(JSON.stringify({
        type: 'vote',
        vote: voteValue
      }))

      return true
    } catch (error) {
      logger.error('Failed to vote:', error)
      toast.error('Failed to submit vote')
      return false
    } finally {
      isLoading.value = false
    }
  }

  const revealVotes = async () => {
    if (!isJoined.value) {
      toast.error('Must join room before revealing votes')
      return false
    }

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      toast.error('Not connected to room')
      return false
    }

    try {
      isLoading.value = true
      ws.send(JSON.stringify({
        type: 'reveal'
      }))

      toast.success('Votes revealed!')
      return true
    } catch (error) {
      logger.error('Failed to reveal votes:', error)
      toast.error('Failed to reveal votes')
      return false
    } finally {
      isLoading.value = false
    }
  }

  const resetRound = async () => {
    if (!isJoined.value) {
      toast.error('Must join room before resetting round')
      return false
    }

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      toast.error('Not connected to room')
      return false
    }

    try {
      isLoading.value = true
      ws.send(JSON.stringify({
        type: 'reset'
      }))

      toast.success('New round started!')
      return true
    } catch (error) {
      logger.error('Failed to reset round:', error)
      toast.error('Failed to start new round')
      return false
    } finally {
      isLoading.value = false
    }
  }

  const setStoryTitle = async (title: string) => {
    if (!isJoined.value) {
      toast.error('Must join room before setting story')
      return false
    }

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      toast.error('Not connected to room')
      return false
    }

    try {
      ws.send(JSON.stringify({
        type: 'setStory',
        title: title.trim()
      }))

      return true
    } catch (error) {
      logger.error('Failed to set story:', error)
      toast.error('Failed to set story title')
      return false
    }
  }

  const setVotingScale = async (scale: string) => {
    if (!isJoined.value) {
      toast.error('Must join room before changing voting scale')
      return false
    }

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      toast.error('Not connected to room')
      return false
    }

    try {
      ws.send(JSON.stringify({
        type: 'setScale',
        scale
      }))

      // Success feedback comes from UI update (cards change immediately)
      // No optimistic toast to avoid misleading user if server rejects change
      return true
    } catch (error) {
      logger.error('Failed to set voting scale:', error)
      toast.error('Failed to change voting scale')
      return false
    }
  }

  const leaveRoom = () => {
    closeConnection()
    currentUser.value = null
    isJoined.value = false
    roomState.value = {
      participants: [],
      votesRevealed: false,
      storyTitle: '',
      votingScale: 'fibonacci',
    }
    // Don't clear session on leave - keep it for potential rejoin
  }

  // Clean up on component unmount
  onUnmounted(() => {
    closeConnection()
  })

  const reconnectAttemptsRef = computed(() => reconnectAttempts)

  return {
    // State
    roomState: readonly(roomState),
    currentUser: readonly(currentUser),
    isJoined: readonly(isJoined),
    status,
    isLoading: readonly(isLoading),
    reconnectAttempts: reconnectAttemptsRef,

    // Computed
    myVote,
    votingComplete,
    averageVote,
    medianVote,
    consensusPercentage,

    // Actions
    connectToRoom,
    leaveRoom,
    joinRoom,
    tryAutoRejoin,
    vote,
    revealVotes,
    resetRound,
    setStoryTitle,
    setVotingScale,
  }
}

// Type-safe injection key for providing/injecting the poker room composable
export type PokerRoomComposable = ReturnType<typeof usePokerRoom>
export const PokerRoomKey: InjectionKey<PokerRoomComposable> = Symbol('pokerRoom')
