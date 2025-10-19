import { ref, computed, readonly, onUnmounted } from 'vue'

export interface Participant {
  id: string
  name: string
  vote: string | number | null
}

export interface RoomState {
  participants: Participant[]
  votesRevealed: boolean
  storyTitle: string
}

export interface RoomMessage {
  type: 'update' | 'error' | 'ping' | 'pong'
  payload?: any
}

export function usePokerRoom(roomId: string) {
  const roomState = ref<RoomState>({
    participants: [],
    votesRevealed: false,
    storyTitle: '',
  })

  const currentUser = ref<{ id: string; name: string } | null>(null)
  const isJoined = ref(false)
  const status = ref<'CONNECTING' | 'OPEN' | 'CLOSED'>('CLOSED')

  let ws: WebSocket | null = null
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null
  let reconnectAttempts = 0
  const MAX_RECONNECT_ATTEMPTS = 10

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
  const userId = existingSession?.userId || `user-${roomId}-${Math.random().toString(36).substring(2, 9)}-${Date.now().toString(36)}`

  console.log('Room ID:', roomId)
  console.log('User ID:', userId)

  function handleMessage(message: RoomMessage) {
    switch (message.type) {
      case 'update':
        if (message.payload) {
          roomState.value = {
            participants: message.payload.participants || [],
            votesRevealed: message.payload.votesRevealed || false,
            storyTitle: message.payload.storyTitle || '',
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
        console.error('Room error:', message.payload?.message)
        break

      default:
        console.warn('Unknown message type:', message.type)
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

    console.log('Connecting to room via WebSocket...')
    status.value = 'CONNECTING'

    // Construct WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/api/room/${roomId}/ws`

    console.log('WebSocket URL:', wsUrl)

    try {
      ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log('WebSocket connection opened')
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
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason)
        status.value = 'CLOSED'
        stopHeartbeat()

        // Attempt to reconnect with exponential backoff
        if (event.code !== 1000) { // 1000 = normal closure
          if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            console.error('Max reconnection attempts reached. Please refresh the page.')
            // TODO: Show user-friendly error message
            return
          }

          // Exponential backoff: 1s, 2s, 4s, 8s, ... up to 30s
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000)
          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`)

          reconnectTimeout = setTimeout(() => {
            if (status.value === 'CLOSED') {
              reconnectAttempts++
              connectToRoom()
            }
          }, delay)
        }
      }
    } catch (error) {
      console.error('Failed to create WebSocket:', error)
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
    // Send ping every 25 seconds (server sends every 30)
    heartbeatInterval = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, 25000)
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
      .filter((vote): vote is number => typeof vote === 'number')

    if (numericVotes.length === 0) return null

    const sum = numericVotes.reduce((acc, vote) => acc + vote, 0)
    return Math.round((sum / numericVotes.length) * 10) / 10
  })

  // Actions
  const joinRoom = async (name: string) => {
    if (!name.trim()) {
      console.error('Name is required to join room')
      return false
    }

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected')
      return false
    }

    try {
      // Set up the current user
      currentUser.value = {
        id: userId,
        name: name.trim()
      }

      // Save session for recovery
      saveUserSession(userId, name.trim())

      // Send join message via WebSocket
      ws.send(JSON.stringify({
        type: 'join',
        name: name.trim()
      }))

      isJoined.value = true
      return true
    } catch (error) {
      console.error('Failed to join room:', error)
      return false
    }
  }

  // Try to auto-rejoin if we have a saved session
  const tryAutoRejoin = () => {
    const session = getUserSession()
    if (session && session.name) {
      // Check if session is recent (within 24 hours)
      const sessionAge = Date.now() - session.timestamp
      if (sessionAge < 24 * 60 * 60 * 1000) {
        return joinRoom(session.name)
      } else {
        // Clear old session
        if (process.client) {
          localStorage.removeItem(`poker-session-${roomId}`)
        }
      }
    }
    return false
  }

  const vote = async (voteValue: string | number | null) => {
    if (!isJoined.value) {
      console.error('Must join room before voting')
      return false
    }

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected')
      return false
    }

    try {
      ws.send(JSON.stringify({
        type: 'vote',
        vote: voteValue
      }))

      return true
    } catch (error) {
      console.error('Failed to vote:', error)
      return false
    }
  }

  const revealVotes = async () => {
    if (!isJoined.value) {
      console.error('Must join room before revealing votes')
      return false
    }

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected')
      return false
    }

    try {
      ws.send(JSON.stringify({
        type: 'reveal'
      }))

      return true
    } catch (error) {
      console.error('Failed to reveal votes:', error)
      return false
    }
  }

  const resetRound = async () => {
    if (!isJoined.value) {
      console.error('Must join room before resetting round')
      return false
    }

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected')
      return false
    }

    try {
      ws.send(JSON.stringify({
        type: 'reset'
      }))

      return true
    } catch (error) {
      console.error('Failed to reset round:', error)
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
    }
    // Don't clear session on leave - keep it for potential rejoin
  }

  // Clean up on component unmount
  onUnmounted(() => {
    closeConnection()
  })

  return {
    // State
    roomState: readonly(roomState),
    currentUser: readonly(currentUser),
    isJoined: readonly(isJoined),
    status,

    // Computed
    myVote,
    votingComplete,
    averageVote,

    // Actions
    connectToRoom,
    leaveRoom,
    joinRoom,
    tryAutoRejoin,
    vote,
    revealVotes,
    resetRound,
  }
}
