import { ref } from 'vue'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  duration?: number
}

const toasts = ref<Toast[]>([])
let nextId = 0

export function useToast() {
  const addToast = (type: Toast['type'], message: string, duration = 5000) => {
    const id = `toast-${nextId++}`
    const toast: Toast = { id, type, message, duration }

    toasts.value.push(toast)

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }
  }

  const removeToast = (id: string) => {
    const index = toasts.value.findIndex(t => t.id === id)
    if (index !== -1) {
      toasts.value.splice(index, 1)
    }
  }

  const success = (message: string, duration?: number) => {
    addToast('success', message, duration)
  }

  const error = (message: string, duration?: number) => {
    addToast('error', message, duration)
  }

  const warning = (message: string, duration?: number) => {
    addToast('warning', message, duration)
  }

  const info = (message: string, duration?: number) => {
    addToast('info', message, duration)
  }

  return {
    toasts,
    success,
    error,
    warning,
    info,
    removeToast,
  }
}
