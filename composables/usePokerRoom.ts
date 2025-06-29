import { ref, computed, readonly } from 'vue'
import { useWebSocket } from '@vueuse/core'

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
  type: 'join' | 'vote' | 'reveal' | 'reset' | 'update' | 'error' | 'connected'
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

  // Generate a unique user ID for this session
  const userId = `user-${Math.random().toString(36).substring(2, 9)}`

  // WebSocket connection using @vueuse/core
  const runtimeConfig = useRuntimeConfig()
  
  // In production, use the same origin but with ws/wss protocol
  // In development, use the configured websocket URL
  const websocketUrl = runtimeConfig.public.websocketUrl || (() => {
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      return `${protocol}//${window.location.host}`
    }
    return 'ws://localhost:8787' // Fallback for SSR
  })()
  
  // We'll set up the WebSocket connection after joining
  let wsConnection: ReturnType<typeof useWebSocket> | null = null

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

      case 'error':
        console.error('Room error:', message.payload?.message)
        break

      default:
        console.warn('Unknown message type:', message.type)
    }
  }

  // Computed properties
  const myVote = computed(() => {
    if (!currentUser.value) return null
    const participant = roomState.value.participants.find(
      p => p.id === userId // Use our generated userId instead of currentUser.id
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

  // Connection status
  const status = ref<'CLOSED' | 'CONNECTING' | 'OPEN'>('CLOSED')

  // Actions
  const joinRoom = (name: string) => {
    if (!name.trim()) {
      console.error('Name is required to join room')
      return false
    }

    // Set up the current user
    currentUser.value = {
      id: userId,
      name: name.trim()
    }

    // Create protocol header for authentication (room:userId encoded in base64url)
    const auth = `${roomId}:${userId}`
    const protocol = btoa(auth).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

    // Set up WebSocket connection
    wsConnection = useWebSocket(websocketUrl, {
      protocols: [protocol, 'poker'],
      onConnected: () => {
        console.log('Connected to poker room:', roomId)
        status.value = 'OPEN'
        // Send join message
        wsConnection?.send(JSON.stringify({
          type: 'join',
          name: name.trim()
        }))
        isJoined.value = true
      },
      onDisconnected: () => {
        console.log('Disconnected from poker room:', roomId)
        status.value = 'CLOSED'
        isJoined.value = false
      },
      onError: (ws, error) => {
        console.error('WebSocket error:', error)
        status.value = 'CLOSED'
      },
      onMessage: (ws, event) => {
        try {
          const data = JSON.parse(event.data)
          handleMessage(data)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      },
    })

    // Open the connection
    status.value = 'CONNECTING'
    wsConnection.open()
    
    return true
  }

  const vote = (voteValue: string | number | null) => {
    if (!isJoined.value || !wsConnection) {
      console.error('Must join room before voting')
      return false
    }

    wsConnection.send(JSON.stringify({
      type: 'vote',
      vote: voteValue
    }))
    return true
  }

  const revealVotes = () => {
    if (!isJoined.value || !wsConnection) {
      console.error('Must join room before revealing votes')
      return false
    }

    wsConnection.send(JSON.stringify({
      type: 'reveal'
    }))
    return true
  }

  const resetRound = () => {
    if (!isJoined.value || !wsConnection) {
      console.error('Must join room before resetting round')
      return false
    }

    wsConnection.send(JSON.stringify({
      type: 'reset'
    }))
    return true
  }

  const connectToRoom = () => {
    if (wsConnection) {
      status.value = 'CONNECTING'
      wsConnection.open()
    }
  }

  const leaveRoom = () => {
    if (wsConnection) {
      wsConnection.close()
    }
    currentUser.value = null
    isJoined.value = false
    status.value = 'CLOSED'
    roomState.value = {
      participants: [],
      votesRevealed: false,
      storyTitle: '',
    }
  }

  return {
    // State
    roomState: readonly(roomState),
    currentUser: readonly(currentUser),
    isJoined: readonly(isJoined),
    status, // WebSocket status from @vueuse/core

    // Computed
    myVote,
    votingComplete,
    averageVote,

    // Actions
    connectToRoom,
    leaveRoom,
    joinRoom,
    vote,
    revealVotes,
    resetRound,
  }
}
