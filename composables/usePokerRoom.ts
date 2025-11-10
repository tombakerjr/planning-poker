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
  autoReveal?: boolean
}

export interface RoomMessage {
  type: 'update' | 'error' | 'ping' | 'pong'
  payload?: any
  id?: number  // For ping/pong latency measurement
}

export interface QueuedMessage {
  message: any
  timestamp: number
  action: 'vote' | 'setStory' | 'setScale' | 'setAutoReveal'
}

export type ConnectionQuality = 'good' | 'fair' | 'poor' | 'disconnected'
export type NetworkState = 'online' | 'offline' | 'unstable'

const MAX_RECONNECT_ATTEMPTS = 15  // Increased for flaky connections
const MAX_RECONNECT_DELAY_MS = 60000  // 60 seconds max delay
const BASE_DELAY_MS = 1000  // 1 second base delay
const JITTER_FACTOR = 0.3  // ±30% randomization
const HEARTBEAT_INTERVAL_MS = 25000 // 25 seconds (less than server's 30s)
const HEARTBEAT_TIMEOUT_MS = 35000  // 35 seconds (allow 1 missed heartbeat)
const MAX_MISSED_PONGS = 2  // Force reconnect after 2 missed pongs
const MAX_NAME_LENGTH = 50
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000 // 24 hours
const MAX_QUEUE_SIZE = 10
const MAX_MESSAGE_AGE_MS = 15000  // 15 seconds
const IS_DEV = process.env.NODE_ENV === 'development'

export function usePokerRoom(roomId: string) {
  const toast = useToast()

  const roomState = ref<RoomState>({
    participants: [],
    votesRevealed: false,
    storyTitle: '',
    votingScale: 'fibonacci',
    autoReveal: false,
  })

  const currentUser = ref<{ id: string; name: string } | null>(null)
  const isJoined = ref(false)
  const status = ref<'CONNECTING' | 'OPEN' | 'CLOSED' | 'RECONNECTING' | 'OFFLINE'>('CLOSED')
  const isLoading = ref(false)

  // Connection quality monitoring
  const latencyMeasurements = ref<number[]>([])
  const currentLatency = ref<number | null>(null)
  const connectionQuality = ref<ConnectionQuality>('disconnected')
  const networkState = ref<NetworkState>('online')
  const lastSuccessfulPong = ref<number>(Date.now())
  const missedPongs = ref<number>(0)

  // Message queue
  const messageQueue = ref<QueuedMessage[]>([])

  let ws: WebSocket | null = null
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null
  let reconnectAttempts = 0
  let pingId = 0
  let pingTimestamps = new Map<number, number>()

  // Connection quality calculation
  function calculateQuality(measurements: number[]): ConnectionQuality {
    if (measurements.length === 0) return 'disconnected'

    const avgLatency = measurements.reduce((a, b) => a + b, 0) / measurements.length

    // Calculate jitter (standard deviation)
    const variance = measurements.reduce((sum, val) =>
      sum + Math.pow(val - avgLatency, 2), 0) / measurements.length
    const jitter = Math.sqrt(variance)

    // Good: Low latency AND stable
    if (avgLatency < 200 && jitter < 50) return 'good'

    // Poor: High latency OR very unstable
    if (avgLatency > 500 || jitter > 150) return 'poor'

    // Fair: Everything in between
    return 'fair'
  }

  // Message queue management
  function queueMessage(message: any, action: QueuedMessage['action']): boolean {
    // Don't queue if connection is open
    if (ws?.readyState === WebSocket.OPEN) return false

    // Remove stale messages (>15s old)
    messageQueue.value = messageQueue.value.filter(
      m => Date.now() - m.timestamp < MAX_MESSAGE_AGE_MS
    )

    // For votes: replace existing queued vote (deduplication)
    if (action === 'vote') {
      messageQueue.value = messageQueue.value.filter(m => m.action !== 'vote')
    }

    // Check size limit
    if (messageQueue.value.length >= MAX_QUEUE_SIZE) {
      toast.warning('Message queue full. Please wait for reconnection.')
      return false
    }

    // Add to queue
    messageQueue.value.push({ message, timestamp: Date.now(), action })
    toast.info(`Message queued. Will send when reconnected. (${messageQueue.value.length} queued)`)
    return true
  }

  async function flushMessageQueue() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return

    // Remove stale messages before flushing
    const validMessages = messageQueue.value.filter(
      m => Date.now() - m.timestamp < MAX_MESSAGE_AGE_MS
    )

    const expiredCount = messageQueue.value.length - validMessages.length

    // Send each queued message
    for (const queued of validMessages) {
      try {
        ws.send(JSON.stringify(queued.message))
        await new Promise(resolve => setTimeout(resolve, 100)) // 100ms delay between sends
      } catch (error) {
        logger.error('Failed to flush queued message:', error)
      }
    }

    // Clear queue after flush
    messageQueue.value = []

    // User feedback
    if (validMessages.length > 0) {
      toast.success(`Reconnected! Sent ${validMessages.length} queued message(s).`)
    }
    if (expiredCount > 0) {
      toast.info(`${expiredCount} stale message(s) discarded.`)
    }
  }

  function calculateReconnectDelay(attempt: number): number {
    // Exponential: 1s, 2s, 4s, 8s, 16s, 32s, 60s, 60s...
    const exponentialDelay = Math.min(
      BASE_DELAY_MS * Math.pow(2, attempt),
      MAX_RECONNECT_DELAY_MS
    )

    // Add jitter to prevent thundering herd
    const jitter = exponentialDelay * JITTER_FACTOR * (Math.random() - 0.5) * 2
    const delayWithJitter = exponentialDelay + jitter

    return Math.max(BASE_DELAY_MS, delayWithJitter)  // Never less than 1s
  }

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
            autoReveal: message.payload.autoReveal || false,
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
        // Server acknowledged our ping - measure latency
        if (message.id !== undefined) {
          const pingTimestamp = pingTimestamps.get(message.id)
          if (pingTimestamp) {
            const rtt = Date.now() - pingTimestamp
            currentLatency.value = rtt
            latencyMeasurements.value.push(rtt)

            // Keep only last 3 measurements
            if (latencyMeasurements.value.length > 3) {
              latencyMeasurements.value.shift()
            }

            // Update connection quality
            connectionQuality.value = calculateQuality(latencyMeasurements.value)

            pingTimestamps.delete(message.id)
          }
        }

        // Track successful pong for network state detection
        lastSuccessfulPong.value = Date.now()
        missedPongs.value = 0
        if (networkState.value === 'unstable') {
          networkState.value = 'online'
        }
        break

      case 'error':
        logger.error('Room error:', message.payload?.message)
        toast.error(message.payload?.message || 'An error occurred')
        break

      default:
        logger.warn('Unknown message type:', message.type)
    }
  }

  // Network state detection with browser events
  function setupNetworkListeners() {
    if (!process.client) return

    let onlineDebounce: ReturnType<typeof setTimeout> | null = null
    let offlineDebounce: ReturnType<typeof setTimeout> | null = null

    const handleOnline = () => {
      // Debounce to prevent flickering on rapid transitions
      if (onlineDebounce) clearTimeout(onlineDebounce)
      onlineDebounce = setTimeout(() => {
        if (IS_DEV) {
          logger.debug('Browser detected online')
        }
        networkState.value = 'online'

        // Trigger reconnection if we're not connected
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          toast.info('Network restored. Reconnecting...')
          connectToRoom()
        }
      }, 500)
    }

    const handleOffline = () => {
      if (offlineDebounce) clearTimeout(offlineDebounce)
      offlineDebounce = setTimeout(() => {
        if (IS_DEV) {
          logger.debug('Browser detected offline')
        }
        networkState.value = 'offline'
        status.value = 'OFFLINE'
        connectionQuality.value = 'disconnected'
        toast.warning('Network connection lost')
      }, 500)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Cleanup on unmount
    onUnmounted(() => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (onlineDebounce) clearTimeout(onlineDebounce)
      if (offlineDebounce) clearTimeout(offlineDebounce)
    })
  }

  // Setup network listeners
  setupNetworkListeners()

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

        // Flush any queued messages
        await flushMessageQueue()
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
            networkState.value = 'offline'
            connectionQuality.value = 'disconnected'
            toast.error('Unable to reconnect. Please refresh the page.', 15000)
            return
          }

          status.value = 'RECONNECTING'
          connectionQuality.value = 'disconnected'

          // Calculate delay with jitter
          const delay = calculateReconnectDelay(reconnectAttempts)
          if (IS_DEV) {
            logger.debug(`Reconnecting in ${Math.round(delay)}ms (attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`)
          }

          // Progressive toast messages
          if (reconnectAttempts === 0) {
            toast.warning('Connection lost. Reconnecting...', delay + 1000)
          } else if (reconnectAttempts === 5) {
            toast.warning('Still reconnecting... This may take a moment.', delay + 1000)
          } else if (reconnectAttempts >= 10) {
            toast.error('Connection issues persist. Check your network.', delay + 1000)
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
    // Send ping to keep connection alive and measure latency
    heartbeatInterval = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        const currentPingId = pingId++
        pingTimestamps.set(currentPingId, Date.now())
        ws.send(JSON.stringify({ type: 'ping', id: currentPingId }))

        // Check if we haven't received a pong recently
        const timeSinceLastPong = Date.now() - lastSuccessfulPong.value
        if (timeSinceLastPong > HEARTBEAT_TIMEOUT_MS) {
          missedPongs.value++

          if (IS_DEV) {
            logger.debug(`Missed pong (${missedPongs.value}/${MAX_MISSED_PONGS})`)
          }

          if (missedPongs.value >= MAX_MISSED_PONGS) {
            logger.warn('Multiple missed pongs - connection unstable')
            networkState.value = 'unstable'
            // Force reconnection
            ws.close()
          } else {
            networkState.value = 'unstable'
          }
        }
      }
    }, HEARTBEAT_INTERVAL_MS)
  }

  const stopHeartbeat = () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval)
      heartbeatInterval = null
    }
  }

  // Connection quality computed properties
  const averageLatency = computed(() => {
    if (latencyMeasurements.value.length === 0) return null
    return Math.round(
      latencyMeasurements.value.reduce((a, b) => a + b, 0) / latencyMeasurements.value.length
    )
  })

  const jitter = computed(() => {
    if (latencyMeasurements.value.length < 2) return null
    const avg = averageLatency.value
    if (avg === null) return null

    const variance = latencyMeasurements.value.reduce((sum, val) =>
      sum + Math.pow(val - avg, 2), 0) / latencyMeasurements.value.length
    return Math.round(Math.sqrt(variance))
  })

  const queuedMessageCount = computed(() => messageQueue.value.length)

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
      const val1 = numericVotes[mid - 1]
      const val2 = numericVotes[mid]
      if (val1 !== undefined && val2 !== undefined) {
        return Math.round(((val1 + val2) / 2) * 10) / 10
      }
      return null
    }
    const medianVal = numericVotes[mid]
    return medianVal !== undefined ? medianVal : null
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

    const message = {
      type: 'vote',
      vote: voteValue
    }

    // If not connected, queue the message
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return queueMessage(message, 'vote')
    }

    try {
      isLoading.value = true
      ws.send(JSON.stringify(message))
      return true
    } catch (error) {
      logger.error('Failed to vote:', error)
      // Try to queue on send failure
      return queueMessage(message, 'vote')
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

    const message = {
      type: 'setStory',
      title: title.trim()
    }

    // If not connected, queue the message
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return queueMessage(message, 'setStory')
    }

    try {
      ws.send(JSON.stringify(message))
      return true
    } catch (error) {
      logger.error('Failed to set story:', error)
      return queueMessage(message, 'setStory')
    }
  }

  const setVotingScale = async (scale: string) => {
    if (!isJoined.value) {
      toast.error('Must join room before changing voting scale')
      return false
    }

    const message = {
      type: 'setScale',
      scale
    }

    // If not connected, queue the message
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return queueMessage(message, 'setScale')
    }

    try {
      ws.send(JSON.stringify(message))
      return true
    } catch (error) {
      logger.error('Failed to set voting scale:', error)
      return queueMessage(message, 'setScale')
    }
  }

  const setAutoReveal = async (autoReveal: boolean) => {
    if (!isJoined.value) {
      toast.error('Must join room before changing auto-reveal setting')
      return false
    }

    const message = {
      type: 'setAutoReveal',
      autoReveal
    }

    // If not connected, queue the message
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return queueMessage(message, 'setAutoReveal')
    }

    try {
      ws.send(JSON.stringify(message))
      return true
    } catch (error) {
      logger.error('Failed to set auto-reveal:', error)
      return queueMessage(message, 'setAutoReveal')
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
      autoReveal: false,
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

    // Connection quality monitoring
    connectionQuality: readonly(connectionQuality),
    currentLatency: readonly(currentLatency),
    averageLatency,
    jitter,
    networkState: readonly(networkState),
    queuedMessageCount,

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
    setAutoReveal,
  }
}

// Type-safe injection key for providing/injecting the poker room composable
export type PokerRoomComposable = ReturnType<typeof usePokerRoom>
export const PokerRoomKey: InjectionKey<PokerRoomComposable> = Symbol('pokerRoom')
