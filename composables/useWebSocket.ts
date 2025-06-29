import { ref, onUnmounted, nextTick, readonly } from 'vue'

export interface WebSocketState {
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  reconnectAttempts: number
}

export interface UseWebSocketOptions {
  autoReconnect?: boolean
  maxReconnectAttempts?: number
  reconnectDelay?: number
  onOpen?: () => void
  onClose?: () => void
  onError?: (error: Event) => void
  onMessage?: (data: any) => void
}

export function useWebSocket(url: string, options: UseWebSocketOptions = {}) {
  const {
    autoReconnect = true,
    maxReconnectAttempts = 5,
    reconnectDelay = 1000,
    onOpen,
    onClose,
    onError,
    onMessage,
  } = options

  const socket = ref<WebSocket | null>(null)
  const state = ref<WebSocketState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    reconnectAttempts: 0,
  })

  let reconnectTimer: number | null = null

  const connect = async () => {
    if (socket.value?.readyState === WebSocket.OPEN) {
      return
    }

    state.value.isConnecting = true
    state.value.error = null

    try {
      socket.value = new WebSocket(url)

      socket.value.onopen = () => {
        state.value.isConnected = true
        state.value.isConnecting = false
        state.value.reconnectAttempts = 0
        state.value.error = null
        onOpen?.()
      }

      socket.value.onclose = () => {
        state.value.isConnected = false
        state.value.isConnecting = false
        onClose?.()

        // Auto-reconnect if enabled and we haven't exceeded max attempts
        if (
          autoReconnect &&
          state.value.reconnectAttempts < maxReconnectAttempts
        ) {
          scheduleReconnect()
        }
      }

      socket.value.onerror = (error) => {
        state.value.error = 'WebSocket connection error'
        state.value.isConnecting = false
        onError?.(error)
      }

      socket.value.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          onMessage?.(data)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }
    } catch (error) {
      state.value.isConnecting = false
      state.value.error = 'Failed to create WebSocket connection'
      console.error('WebSocket connection failed:', error)
    }
  }

  const scheduleReconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
    }

    state.value.reconnectAttempts++
    const delay = reconnectDelay * Math.pow(2, state.value.reconnectAttempts - 1)

    reconnectTimer = setTimeout(() => {
      connect()
    }, delay) as unknown as number
  }

  const disconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }

    if (socket.value) {
      socket.value.close()
      socket.value = null
    }

    state.value.isConnected = false
    state.value.isConnecting = false
    state.value.reconnectAttempts = 0
  }

  const send = (data: any) => {
    if (socket.value?.readyState === WebSocket.OPEN) {
      socket.value.send(JSON.stringify(data))
      return true
    } else {
      console.warn('WebSocket is not connected. Message not sent:', data)
      return false
    }
  }

  const reconnect = () => {
    disconnect()
    nextTick(() => {
      connect()
    })
  }

  // Clean up on unmount
  onUnmounted(() => {
    disconnect()
  })

  return {
    connect,
    disconnect,
    reconnect,
    send,
    state: readonly(state),
    socket: readonly(socket),
  }
}
