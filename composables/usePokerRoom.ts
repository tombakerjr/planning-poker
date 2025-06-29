import { ref, computed } from 'vue'
import { useWebSocket } from './useWebSocket'

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

  // WebSocket connection
  const wsUrl = computed(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}/api/room/${roomId}/ws`
  })

  const { connect, disconnect, send, state: wsState } = useWebSocket(wsUrl.value, {
    onMessage: handleMessage,
    onOpen: () => {
      console.log('Connected to room:', roomId)
    },
    onClose: () => {
      console.log('Disconnected from room:', roomId)
      isJoined.value = false
    },
    onError: (error) => {
      console.error('WebSocket error:', error)
    },
  })

  function handleMessage(message: RoomMessage) {
    switch (message.type) {
      case 'connected':
        // Store the session ID provided by the server
        if (message.payload?.sessionId && currentUser.value) {
          currentUser.value.id = message.payload.sessionId
        }
        break

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
      p => p.id === currentUser.value?.id
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
  const joinRoom = (name: string) => {
    if (!name.trim()) {
      console.error('Name is required to join room')
      return false
    }

    // Set up the current user (ID will be set when server responds with sessionId)
    currentUser.value = {
      id: '', // Will be set by the server response
      name: name.trim()
    }

    const success = send({
      type: 'join',
      payload: { name: name.trim() }
    })

    if (success) {
      isJoined.value = true
    }

    return success
  }

  const vote = (voteValue: string | number | null) => {
    if (!isJoined.value) {
      console.error('Must join room before voting')
      return false
    }

    return send({
      type: 'vote',
      payload: { vote: voteValue }
    })
  }

  const revealVotes = () => {
    if (!isJoined.value) {
      console.error('Must join room before revealing votes')
      return false
    }

    return send({
      type: 'reveal'
    })
  }

  const resetRound = () => {
    if (!isJoined.value) {
      console.error('Must join room before resetting round')
      return false
    }

    return send({
      type: 'reset'
    })
  }

  const connectToRoom = () => {
    connect()
  }

  const leaveRoom = () => {
    disconnect()
    currentUser.value = null
    isJoined.value = false
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
    wsState,

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
