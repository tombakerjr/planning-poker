import { nanoid } from 'nanoid';
import { computed, type InjectionKey, onUnmounted, readonly, ref, watch } from 'vue';

import { useSessionStorage, type VotingRound } from './useSessionStorage';
import { useToast } from './useToast';

// Client-side logger implementation
// Note: Cannot import ~/server/utils/logger here because:
// 1. Composables run in browser context (client-side)
// 2. Server utilities may have Node.js dependencies unavailable in browser
// 3. Importing server code into client bundle increases bundle size unnecessarily
// 4. Proper separation of concerns: client logging vs server logging have different needs
const logger = {
  debug: (...args: any[]) => console.debug('[PokerRoom]', ...args),
  info: (...args: any[]) => console.info('[PokerRoom]', ...args),
  warn: (...args: any[]) => console.warn('[PokerRoom]', ...args),
  error: (...args: any[]) => console.error('[PokerRoom]', ...args),
};

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
  timerEndTime?: number | null
  timerAutoReveal?: boolean
}

export interface RoomMessage {
  type: 'update' | 'error' | 'ping' | 'pong'
  payload?: any
  id?: number  // For ping/pong latency measurement
  maintenance?: boolean  // True when server is in maintenance mode
}

export interface QueuedMessage {
  message: any
  timestamp: number
  action: 'vote' | 'setStory' | 'setScale' | 'setAutoReveal' | 'startTimer' | 'cancelTimer' | 'setTimerAutoReveal'
}

export type ConnectionQuality = 'good' | 'fair' | 'poor' | 'disconnected';
export type NetworkState = 'online' | 'offline' | 'unstable';

const MAX_RECONNECT_ATTEMPTS = 15;  // Increased for flaky connections
const MAX_RECONNECT_DELAY_MS = 60000;  // 60 seconds max delay
const BASE_DELAY_MS = 1000;  // 1 second base delay
const JITTER_FACTOR = 0.3;  // ±30% randomization
const HEARTBEAT_INTERVAL_MS = 25000; // 25 seconds (less than server's 30s)
const HEARTBEAT_TIMEOUT_MS = 35000;  // 35 seconds (allow 1 missed heartbeat)
const MAX_MISSED_PONGS = 2;  // Force reconnect after 2 missed pongs
const MAX_NAME_LENGTH = 50;
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_QUEUE_SIZE = 10;
const MAX_MESSAGE_AGE_MS = 15000;  // 15 seconds
const LATENCY_MEASUREMENT_WINDOW = 10;  // Keep last 10 samples for accurate jitter calculation
const QUEUE_FLUSH_DELAY_MS = 150;  // 150ms between sends = ~6.7 msg/sec (safe under 10 msg/sec limit)
const IS_DEV = process.env.NODE_ENV === 'development';

export function usePokerRoom(roomId: string) {
  const toast = useToast();
  const sessionStorage = useSessionStorage();

  // Session tracking state for history
  const sessionJoinedAt = ref<number | null>(null);
  const completedRounds = ref<VotingRound[]>([]);
  // Flag to prevent double-saving session (leaveRoom + onUnmounted)
  let sessionSaved = false;

  const roomState = ref<RoomState>({
    participants: [],
    votesRevealed: false,
    storyTitle: '',
    votingScale: 'fibonacci',
    autoReveal: false,
    timerEndTime: null,
    timerAutoReveal: false,
  });

  const currentUser = ref<{ id: string; name: string } | null>(null);
  const isJoined = ref(false);
  const status = ref<'CONNECTING' | 'OPEN' | 'CLOSED' | 'RECONNECTING' | 'OFFLINE'>('CLOSED');
  const isLoading = ref(false);

  // Connection quality monitoring
  const latencyMeasurements = ref<number[]>([]);
  const currentLatency = ref<number | null>(null);
  const connectionQuality = ref<ConnectionQuality>('disconnected');
  const networkState = ref<NetworkState>('online');
  const lastSuccessfulPong = ref<number>(Date.now());
  const missedPongs = ref<number>(0);

  // Maintenance mode (received from server via pong)
  // INTENTIONALLY global (not room-scoped): When the server enters maintenance mode,
  // ALL rooms should show the overlay. This allows app.vue to display the maintenance
  // message regardless of which room the user is in. The server broadcasts maintenance
  // status via pong messages to all connected clients.
  const maintenance = useState('maintenance-mode', () => false);

  // Message queue
  const messageQueue = ref<QueuedMessage[]>([]);

  // Timer state (computed locally from timerEndTime)
  const timerRemaining = ref<number | null>(null);
  const timerExpired = ref<boolean>(false);
  let timerInterval: ReturnType<typeof setInterval> | null = null;
  let expiredResetTimeout: ReturnType<typeof setTimeout> | null = null;

  let ws: WebSocket | null = null;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  // Bug fix: Use ref for reconnectAttempts so UI updates reactively
  const reconnectAttemptsRef = ref<number>(0);
  let pingId = 0;
  const pingTimestamps = new Map<number, number>();

  // Connection quality calculation
  function calculateQuality(measurements: number[]): ConnectionQuality {
    if (measurements.length === 0) return 'disconnected';

    const avgLatency = measurements.reduce((a, b) => a + b, 0) / measurements.length;

    // Calculate jitter (standard deviation)
    const variance = measurements.reduce((sum, val) =>
      sum + Math.pow(val - avgLatency, 2), 0) / measurements.length;
    const jitter = Math.sqrt(variance);

    // Good: Low latency AND stable
    if (avgLatency < 200 && jitter < 50) return 'good';

    // Poor: High latency OR very unstable
    if (avgLatency > 500 || jitter > 150) return 'poor';

    // Fair: Everything in between
    return 'fair';
  }

  // Timer interval management
  function stopTimerInterval() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    // Also clear the expired reset timeout to prevent memory leaks
    if (expiredResetTimeout) {
      clearTimeout(expiredResetTimeout);
      expiredResetTimeout = null;
    }
  }

  // Handle timer expiration - extracted to avoid duplication
  function handleTimerExpiration() {
    timerExpired.value = true;
    stopTimerInterval();
    // Reset expired flag after 3 seconds (for UI feedback)
    // Clear any existing timeout first to prevent multiple scheduled resets
    if (expiredResetTimeout) {
      clearTimeout(expiredResetTimeout);
    }
    expiredResetTimeout = setTimeout(() => {
      timerExpired.value = false;
      expiredResetTimeout = null;
    }, 3000);
  }

  function updateTimerState() {
    const endTime = roomState.value.timerEndTime;

    if (endTime === null || endTime === undefined) {
      // No timer running
      stopTimerInterval();
      timerRemaining.value = null;
      // Don't reset timerExpired here - let it stay true briefly for UI feedback
      return;
    }

    // Calculate remaining time
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
    timerRemaining.value = remaining;

    if (remaining === 0) {
      // Timer just expired
      handleTimerExpiration();
      return;
    }

    // Start interval if not already running
    if (!timerInterval) {
      timerExpired.value = false;
      timerInterval = setInterval(() => {
        const currentEndTime = roomState.value.timerEndTime;
        if (currentEndTime === null || currentEndTime === undefined) {
          stopTimerInterval();
          timerRemaining.value = null;
          return;
        }

        const nowInner = Date.now();
        const remainingInner = Math.max(0, Math.ceil((currentEndTime - nowInner) / 1000));
        timerRemaining.value = remainingInner;

        if (remainingInner === 0) {
          handleTimerExpiration();
        }
      }, 1000);
    }
  }

  // Message queue management
  function queueMessage(message: any, action: QueuedMessage['action']): boolean {
    // Don't queue if connection is open
    if (ws?.readyState === WebSocket.OPEN) return false;

    // Remove stale messages (>15s old)
    messageQueue.value = messageQueue.value.filter(
      m => Date.now() - m.timestamp < MAX_MESSAGE_AGE_MS,
    );

    // For votes: replace existing queued vote (deduplication)
    if (action === 'vote') {
      messageQueue.value = messageQueue.value.filter(m => m.action !== 'vote');
    }

    // Check size limit
    if (messageQueue.value.length >= MAX_QUEUE_SIZE) {
      toast.warning('Message queue full. Please wait for reconnection.');
      return false;
    }

    // Add to queue
    messageQueue.value.push({ message, timestamp: Date.now(), action });
    toast.info(`Message queued. Will send when reconnected. (${messageQueue.value.length} queued)`);
    return true;
  }

  async function flushMessageQueue() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    // Remove stale messages before flushing
    const validMessages = messageQueue.value.filter(
      m => Date.now() - m.timestamp < MAX_MESSAGE_AGE_MS,
    );

    const expiredCount = messageQueue.value.length - validMessages.length;

    // Send each queued message
    // NOTE: Error handling here is intentional per design doc (2025-01-10-connection-resilience-design.md:627-631)
    // If ws.send() fails, we skip the message and continue flushing remaining messages.
    // This is NOT a race condition - it's deterministic error handling.
    //
    // Rationale for not re-queuing failed messages:
    // 1. If send fails, connection is likely closing/closed (even though we just checked OPEN state)
    // 2. Connection close will trigger onclose handler -> reconnection -> another flush attempt
    // 3. By then, failed messages would likely exceed MAX_MESSAGE_AGE_MS (15s) and be stale anyway
    // 4. For real-time planning poker, fail-fast is better than complex retry logic
    // 5. Users see ConnectionIndicator and can manually re-trigger actions if needed
    //
    // This scenario is extremely rare (connection would have to close immediately after onopen,
    // during the flush window), and the impact is acceptable for this use case.
    for (const queued of validMessages) {
      try {
        ws.send(JSON.stringify(queued.message));
        // Delay between sends to avoid server rate limiting
        await new Promise(resolve => setTimeout(resolve, QUEUE_FLUSH_DELAY_MS));
      } catch (error) {
        logger.error('Failed to flush queued message:', error);
        // Continue to next message (don't re-queue failures - see comment above)
      }
    }

    // Clear queue after flush (intentionally clears ALL messages, even if some failed to send)
    // See rationale above - we don't retry failed messages in this design
    messageQueue.value = [];

    // User feedback
    if (validMessages.length > 0) {
      toast.success(`Reconnected! Sent ${validMessages.length} queued message(s).`);
    }
    if (expiredCount > 0) {
      toast.info(`${expiredCount} stale message(s) discarded.`);
    }
  }

  function calculateReconnectDelay(attempt: number): number {
    // Exponential: 1s, 2s, 4s, 8s, 16s, 32s, 60s, 60s...
    const exponentialDelay = Math.min(
      BASE_DELAY_MS * Math.pow(2, attempt),
      MAX_RECONNECT_DELAY_MS,
    );

    // Add jitter to prevent thundering herd
    const jitter = exponentialDelay * JITTER_FACTOR * (Math.random() - 0.5) * 2;
    const delayWithJitter = exponentialDelay + jitter;

    // Ensure delay is between min and max bounds
    return Math.max(BASE_DELAY_MS, Math.min(MAX_RECONNECT_DELAY_MS, delayWithJitter));
  }

  // Try to restore user session from localStorage
  const getUserSession = () => {
    if (process.client) {
      const stored = localStorage.getItem(`poker-session-${roomId}`);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          localStorage.removeItem(`poker-session-${roomId}`);
        }
      }
    }
    return null;
  };

  const saveUserSession = (userId: string, name: string) => {
    if (process.client) {
      localStorage.setItem(`poker-session-${roomId}`, JSON.stringify({ userId, name, timestamp: Date.now() }));
    }
  };

  // Generate or restore user ID
  const existingSession = getUserSession();
  const userId = existingSession?.userId || `user-${nanoid()}`;

  if (IS_DEV) {
    logger.debug('Room ID:', roomId);
    logger.debug('User ID:', userId);
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
            timerEndTime: message.payload.timerEndTime ?? null,
            timerAutoReveal: message.payload.timerAutoReveal || false,
          };
          // Update timer countdown based on new timerEndTime
          updateTimerState();
        }
        break;

      case 'ping':
        // Respond to server ping
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
        break;

      case 'pong':
        // Server acknowledged our ping - measure latency
        if (message.id !== undefined) {
          const pingTimestamp = pingTimestamps.get(message.id);
          if (pingTimestamp) {
            const rtt = Date.now() - pingTimestamp;
            currentLatency.value = rtt;
            latencyMeasurements.value.push(rtt);

            // Keep only last N measurements for better jitter accuracy
            if (latencyMeasurements.value.length > LATENCY_MEASUREMENT_WINDOW) {
              latencyMeasurements.value.shift();
            }

            // Update connection quality
            connectionQuality.value = calculateQuality(latencyMeasurements.value);

            pingTimestamps.delete(message.id);
          }
        }

        // Track successful pong for network state detection
        lastSuccessfulPong.value = Date.now();
        missedPongs.value = 0;
        if (networkState.value === 'unstable') {
          networkState.value = 'online';
        }

        // Check for maintenance mode from server
        if (message.maintenance !== undefined) {
          maintenance.value = message.maintenance;
        }
        break;

      case 'error':
        logger.error('Room error:', message.payload?.message);
        toast.error(message.payload?.message || 'An error occurred');
        break;

      default:
        logger.warn('Unknown message type:', message.type);
    }
  }

  // Network state detection with browser events
  function setupNetworkListeners() {
    if (!process.client) return;

    let onlineDebounce: ReturnType<typeof setTimeout> | null = null;
    let offlineDebounce: ReturnType<typeof setTimeout> | null = null;

    const handleOnline = () => {
      // Debounce to prevent flickering on rapid transitions
      if (onlineDebounce) clearTimeout(onlineDebounce);
      onlineDebounce = setTimeout(() => {
        if (IS_DEV) {
          logger.debug('Browser detected online');
        }
        networkState.value = 'online';

        // Trigger reconnection if we're not connected (and not already connecting)
        if (!ws || (ws.readyState !== WebSocket.OPEN && ws.readyState !== WebSocket.CONNECTING)) {
          toast.info('Network restored. Reconnecting...');
          connectToRoom();
        }
      }, 500);
    };

    const handleOffline = () => {
      if (offlineDebounce) clearTimeout(offlineDebounce);
      offlineDebounce = setTimeout(() => {
        if (IS_DEV) {
          logger.debug('Browser detected offline');
        }
        networkState.value = 'offline';
        status.value = 'OFFLINE';
        connectionQuality.value = 'disconnected';
        toast.warning('Network connection lost');
      }, 500);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cleanup on unmount
    onUnmounted(() => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (onlineDebounce) clearTimeout(onlineDebounce);
      if (offlineDebounce) clearTimeout(offlineDebounce);
    });
  }

  // Setup network listeners
  setupNetworkListeners();

  // WebSocket connection functions
  const connectToRoom = () => {
    if (ws) {
      ws.close();
    }

    if (!process.client) {
      return;
    }

    if (IS_DEV) {
      logger.debug('Connecting to room via WebSocket...');
    }
    status.value = 'CONNECTING';

    // Construct WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/room/${roomId}/ws`;

    if (IS_DEV) {
      logger.debug('WebSocket URL:', wsUrl);
    }

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = async () => {
        if (IS_DEV) {
          logger.debug('WebSocket connection opened');
        }

        const wasReconnecting = reconnectAttemptsRef.value > 0;
        const hasQueuedMessages = messageQueue.value.length > 0;

        status.value = 'OPEN';
        // Set connectionQuality to 'fair' as temporary state while awaiting first pong
        // This prevents showing "Disconnected" during the brief window before latency is measured.
        // The actual quality will be calculated from real measurements within ~100ms.
        connectionQuality.value = 'fair';
        reconnectAttemptsRef.value = 0; // Reset reconnection counter on successful connection

        // Send authentication message
        if (ws) {
          ws.send(JSON.stringify({
            type: 'auth',
            userId: userId,
          }));
        }

        // Start heartbeat
        startHeartbeat();

        // Flush any queued messages
        await flushMessageQueue();

        // Only show generic reconnect toast if queue was empty
        // (flushMessageQueue shows more informative toast if messages were sent)
        if (wasReconnecting && !hasQueuedMessages) {
          toast.success('Reconnected successfully!');
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleMessage(data);
        } catch (error) {
          logger.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        logger.error('WebSocket error:', error);
      };

      ws.onclose = (event) => {
        if (IS_DEV) {
          logger.debug('WebSocket closed:', event.code, event.reason);
        }
        stopHeartbeat();

        // Attempt to reconnect with exponential backoff
        if (event.code !== 1000) { // 1000 = normal closure
          if (reconnectAttemptsRef.value >= MAX_RECONNECT_ATTEMPTS) {
            logger.error('Max reconnection attempts reached. Please refresh the page.');
            status.value = 'CLOSED';
            networkState.value = 'offline';
            connectionQuality.value = 'disconnected';
            toast.error('Unable to reconnect. Please refresh the page.', 15000);
            return;
          }

          status.value = 'RECONNECTING';
          connectionQuality.value = 'disconnected';

          // Calculate delay with jitter
          const delay = calculateReconnectDelay(reconnectAttemptsRef.value);
          if (IS_DEV) {
            logger.debug(`Reconnecting in ${Math.round(delay)}ms (attempt ${reconnectAttemptsRef.value + 1}/${MAX_RECONNECT_ATTEMPTS})`);
          }

          // Progressive toast messages
          if (reconnectAttemptsRef.value === 0) {
            toast.warning('Connection lost. Reconnecting...', delay + 1000);
          } else if (reconnectAttemptsRef.value === 5) {
            toast.warning('Still reconnecting... This may take a moment.', delay + 1000);
          } else if (reconnectAttemptsRef.value >= 10) {
            toast.error('Connection issues persist. Check your network.', delay + 1000);
          }

          reconnectTimeout = setTimeout(() => {
            if (status.value === 'RECONNECTING') {
              reconnectAttemptsRef.value++;
              connectToRoom();
            }
          }, delay);
        } else {
          status.value = 'CLOSED';
        }
      };
    } catch (error) {
      logger.error('Failed to create WebSocket:', error);
      status.value = 'CLOSED';
    }
  };

  const closeConnection = () => {
    if (ws) {
      ws.close(1000, 'User closed connection');
      ws = null;
    }
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    stopHeartbeat();
    stopTimerInterval();

    // Clear connection monitoring state to prevent memory leaks
    pingTimestamps.clear();
    latencyMeasurements.value = [];
    currentLatency.value = null;
    connectionQuality.value = 'disconnected';
    reconnectAttemptsRef.value = 0;

    status.value = 'CLOSED';
  };

  const startHeartbeat = () => {
    stopHeartbeat();

    // Helper to send a ping and track it for latency measurement
    const sendPing = () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        const currentPingId = pingId++;
        pingTimestamps.set(currentPingId, Date.now());
        ws.send(JSON.stringify({ type: 'ping', id: currentPingId }));
      }
    };

    // Send immediate ping to get latency measurement quickly after connection
    sendPing();

    // Then send periodic pings to keep connection alive and monitor latency
    heartbeatInterval = setInterval(() => {
      sendPing();

      // Check if we haven't received a pong recently
      const timeSinceLastPong = Date.now() - lastSuccessfulPong.value;
      if (timeSinceLastPong > HEARTBEAT_TIMEOUT_MS) {
        missedPongs.value++;

        if (IS_DEV) {
          logger.debug(`Missed pong (${missedPongs.value}/${MAX_MISSED_PONGS})`);
        }

        if (missedPongs.value >= MAX_MISSED_PONGS) {
          logger.warn('Multiple missed pongs - connection unstable');
          networkState.value = 'unstable';
          // Force reconnection
          if (ws) ws.close();
        } else {
          networkState.value = 'unstable';
        }
      }
    }, HEARTBEAT_INTERVAL_MS);
  };

  const stopHeartbeat = () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  };

  // Connection quality computed properties
  const averageLatency = computed(() => {
    if (latencyMeasurements.value.length === 0) return null;
    return Math.round(
      latencyMeasurements.value.reduce((a, b) => a + b, 0) / latencyMeasurements.value.length,
    );
  });

  const jitter = computed(() => {
    if (latencyMeasurements.value.length < 2) return null;
    const avg = averageLatency.value;
    if (avg === null) return null;

    const variance = latencyMeasurements.value.reduce((sum, val) =>
      sum + Math.pow(val - avg, 2), 0) / latencyMeasurements.value.length;
    return Math.round(Math.sqrt(variance));
  });

  const queuedMessageCount = computed(() => messageQueue.value.length);

  // Computed properties
  const myVote = computed(() => {
    if (!currentUser.value) return null;
    const participant = roomState.value.participants.find(
      p => p.id === userId,
    );
    return participant?.vote || null;
  });

  const votingComplete = computed(() => {
    const activeParticipants = roomState.value.participants.filter(p => p.vote !== null);
    return activeParticipants.length === roomState.value.participants.length &&
           roomState.value.participants.length > 0;
  });

  const averageVote = computed(() => {
    if (!roomState.value.votesRevealed) return null;

    const numericVotes = roomState.value.participants
      .map(p => p.vote)
      .map(vote => {
        // Convert known string representations to numbers (e.g., '½' → 0.5)
        if (vote === '½') return 0.5;
        return vote;
      })
      .filter((vote): vote is number => typeof vote === 'number');

    if (numericVotes.length === 0) return null;

    const sum = numericVotes.reduce((acc, vote) => acc + vote, 0);
    return Math.round((sum / numericVotes.length) * 10) / 10;
  });

  const medianVote = computed(() => {
    if (!roomState.value.votesRevealed) return null;

    const numericVotes = roomState.value.participants
      .map(p => p.vote)
      .map(vote => {
        // Convert known string representations to numbers (e.g., '½' → 0.5)
        if (vote === '½') return 0.5;
        return vote;
      })
      .filter((vote): vote is number => typeof vote === 'number')
      .sort((a, b) => a - b);

    if (numericVotes.length === 0) return null;

    const mid = Math.floor(numericVotes.length / 2);
    if (numericVotes.length % 2 === 0) {
      const val1 = numericVotes[mid - 1];
      const val2 = numericVotes[mid];
      if (val1 !== undefined && val2 !== undefined) {
        return Math.round(((val1 + val2) / 2) * 10) / 10;
      }
      return null;
    }
    const medianVal = numericVotes[mid];
    return medianVal !== undefined ? medianVal : null;
  });

  const consensusPercentage = computed(() => {
    if (!roomState.value.votesRevealed) return null;

    const votes = roomState.value.participants
      .map(p => p.vote)
      .filter(vote => vote !== null);

    if (votes.length === 0) return null;

    // Count occurrences of each vote
    const voteCounts = new Map<string | number, number>();
    votes.forEach(vote => {
      const count = voteCounts.get(vote!) || 0;
      voteCounts.set(vote!, count + 1);
    });

    // Find the most common vote count
    const maxCount = Math.max(...Array.from(voteCounts.values()));

    // Calculate percentage of participants who voted for the most common value
    return Math.round((maxCount / votes.length) * 100);
  });

  // Actions
  const joinRoom = async (name: string) => {
    const trimmedName = name.trim().substring(0, MAX_NAME_LENGTH);

    if (!trimmedName) {
      logger.error('Name is required to join room');
      return false;
    }

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      logger.error('WebSocket is not connected');
      return false;
    }

    try {
      // Set up the current user
      currentUser.value = {
        id: userId,
        name: trimmedName,
      };

      // Save session for recovery
      saveUserSession(userId, trimmedName);

      // Track session for recent rooms (Phase 6)
      sessionJoinedAt.value = Date.now();
      sessionStorage.addRecentRoom({
        roomId,
        name: trimmedName,
        storyTitle: roomState.value.storyTitle || undefined,
      });

      // Send join message via WebSocket
      ws.send(JSON.stringify({
        type: 'join',
        name: trimmedName,
      }));

      isJoined.value = true;
      return true;
    } catch (error) {
      logger.error('Failed to join room:', error);
      return false;
    }
  };

  // Try to auto-rejoin if we have a saved session
  const tryAutoRejoin = () => {
    const session = getUserSession();
    if (session && session.name) {
      // Check if session is recent (verify timestamp exists to avoid NaN)
      if (session.timestamp && (Date.now() - session.timestamp) < SESSION_EXPIRY_MS) {
        return joinRoom(session.name);
      } else {
        // Clear old or invalid session
        if (process.client) {
          localStorage.removeItem(`poker-session-${roomId}`);
        }
      }
    }
    return false;
  };

  const vote = async (voteValue: string | number | null) => {
    if (!isJoined.value) {
      toast.error('Must join room before voting');
      return false;
    }

    const message = {
      type: 'vote',
      vote: voteValue,
    };

    // If not connected, queue the message
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return queueMessage(message, 'vote');
    }

    try {
      isLoading.value = true;
      ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      logger.error('Failed to vote:', error);
      // Try to queue on send failure
      return queueMessage(message, 'vote');
    } finally {
      isLoading.value = false;
    }
  };

  const revealVotes = async () => {
    if (!isJoined.value) {
      toast.error('Must join room before revealing votes');
      return false;
    }

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      toast.error('Not connected to room');
      return false;
    }

    try {
      isLoading.value = true;
      ws.send(JSON.stringify({
        type: 'reveal',
      }));

      toast.success('Votes revealed!');
      return true;
    } catch (error) {
      logger.error('Failed to reveal votes:', error);
      toast.error('Failed to reveal votes');
      return false;
    } finally {
      isLoading.value = false;
    }
  };

  const resetRound = async () => {
    if (!isJoined.value) {
      toast.error('Must join room before resetting round');
      return false;
    }

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      toast.error('Not connected to room');
      return false;
    }

    try {
      isLoading.value = true;
      ws.send(JSON.stringify({
        type: 'reset',
      }));

      toast.success('New round started!');
      return true;
    } catch (error) {
      logger.error('Failed to reset round:', error);
      toast.error('Failed to start new round');
      return false;
    } finally {
      isLoading.value = false;
    }
  };

  const setStoryTitle = async (title: string) => {
    if (!isJoined.value) {
      toast.error('Must join room before setting story');
      return false;
    }

    const message = {
      type: 'setStory',
      title: title.trim(),
    };

    // If not connected, queue the message
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return queueMessage(message, 'setStory');
    }

    try {
      ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      logger.error('Failed to set story:', error);
      return queueMessage(message, 'setStory');
    }
  };

  const setVotingScale = async (scale: string) => {
    if (!isJoined.value) {
      toast.error('Must join room before changing voting scale');
      return false;
    }

    const message = {
      type: 'setScale',
      scale,
    };

    // If not connected, queue the message
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return queueMessage(message, 'setScale');
    }

    try {
      ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      logger.error('Failed to set voting scale:', error);
      return queueMessage(message, 'setScale');
    }
  };

  const setAutoReveal = async (autoReveal: boolean) => {
    if (!isJoined.value) {
      toast.error('Must join room before changing auto-reveal setting');
      return false;
    }

    const message = {
      type: 'setAutoReveal',
      autoReveal,
    };

    // If not connected, queue the message
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return queueMessage(message, 'setAutoReveal');
    }

    try {
      ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      logger.error('Failed to set auto-reveal:', error);
      return queueMessage(message, 'setAutoReveal');
    }
  };

  // Valid timer durations (must match server-side VALID_TIMER_DURATIONS)
  const VALID_TIMER_DURATIONS = [30, 60, 120, 300] as const;

  const startTimer = async (duration: number) => {
    if (!isJoined.value) {
      toast.error('Must join room before starting timer');
      return false;
    }

    // Validate duration client-side
    if (!VALID_TIMER_DURATIONS.includes(duration as typeof VALID_TIMER_DURATIONS[number])) {
      toast.error('Invalid timer duration. Use 30, 60, 120, or 300 seconds.');
      return false;
    }

    const message = {
      type: 'startTimer',
      duration,
    };

    // If not connected, queue the message
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return queueMessage(message, 'startTimer');
    }

    try {
      ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      logger.error('Failed to start timer:', error);
      return queueMessage(message, 'startTimer');
    }
  };

  const cancelTimer = async () => {
    if (!isJoined.value) {
      toast.error('Must join room before canceling timer');
      return false;
    }

    const message = {
      type: 'cancelTimer',
    };

    // If not connected, queue the message
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return queueMessage(message, 'cancelTimer');
    }

    try {
      ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      logger.error('Failed to cancel timer:', error);
      return queueMessage(message, 'cancelTimer');
    }
  };

  const setTimerAutoReveal = async (enabled: boolean) => {
    if (!isJoined.value) {
      toast.error('Must join room before changing timer auto-reveal setting');
      return false;
    }

    const message = {
      type: 'setTimerAutoReveal',
      enabled,
    };

    // If not connected, queue the message
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return queueMessage(message, 'setTimerAutoReveal');
    }

    try {
      ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      logger.error('Failed to set timer auto-reveal:', error);
      return queueMessage(message, 'setTimerAutoReveal');
    }
  };

  const leaveRoom = () => {
    // Save session to history before leaving (Phase 6)
    // Only save once - prevents duplicate saves if leaveRoom called before unmount
    if (sessionJoinedAt.value && currentUser.value && !sessionSaved) {
      sessionSaved = true;
      sessionStorage.addSessionToHistory({
        roomId,
        userName: currentUser.value.name,
        joinedAt: sessionJoinedAt.value,
        participantCount: roomState.value.participants.length,
        roundCount: completedRounds.value.length,
        rounds: completedRounds.value,
        votingScale: roomState.value.votingScale || 'fibonacci',
      });
    }

    closeConnection();
    currentUser.value = null;
    isJoined.value = false;
    sessionJoinedAt.value = null;
    completedRounds.value = [];
    // Reset sessionSaved so future sessions can be saved (e.g., if user rejoins)
    sessionSaved = false;
    roomState.value = {
      participants: [],
      votesRevealed: false,
      storyTitle: '',
      votingScale: 'fibonacci',
      autoReveal: false,
      timerEndTime: null,
      timerAutoReveal: false,
    };
    // Clear timer state
    stopTimerInterval();
    timerRemaining.value = null;
    timerExpired.value = false;
    // Don't clear session on leave - keep it for potential rejoin
  };

  // Watch for story title changes to update recent rooms (Phase 6)
  watch(() => roomState.value.storyTitle, (newTitle) => {
    if (newTitle && isJoined.value) {
      sessionStorage.updateRecentRoomStory(roomId, newTitle);
    }
  });

  // Watch for votes revealed to track completed rounds (Phase 6)
  watch(() => roomState.value.votesRevealed, (revealed, wasRevealed) => {
    // When votes are revealed (transition from hidden to revealed)
    // Check wasRevealed !== undefined to avoid false positive on initial render/reconnect
    if (revealed && wasRevealed === false && isJoined.value) {
      const votes: Record<string, string | number | null> = {};
      roomState.value.participants.forEach(p => {
        votes[p.name] = p.vote;
      });

      completedRounds.value.push({
        storyTitle: roomState.value.storyTitle || 'Untitled',
        votes,
        average: averageVote.value,
        median: medianVote.value,
        consensus: consensusPercentage.value,
        completedAt: Date.now(),
      });
    }
  });

  // Clean up on component unmount
  onUnmounted(() => {
    // Save session to history when component unmounts (Phase 6)
    // Only save if not already saved by leaveRoom()
    if (sessionJoinedAt.value && currentUser.value && !sessionSaved) {
      sessionSaved = true;
      sessionStorage.addSessionToHistory({
        roomId,
        userName: currentUser.value.name,
        joinedAt: sessionJoinedAt.value,
        participantCount: roomState.value.participants.length,
        roundCount: completedRounds.value.length,
        rounds: completedRounds.value,
        votingScale: roomState.value.votingScale || 'fibonacci',
      });
    }
    closeConnection();
    // Clean up timer interval
    stopTimerInterval();
  });

  return {
    // State
    roomState: readonly(roomState),
    currentUser: readonly(currentUser),
    isJoined: readonly(isJoined),
    status,
    isLoading: readonly(isLoading),
    reconnectAttempts: readonly(reconnectAttemptsRef),

    // Connection quality monitoring
    connectionQuality: readonly(connectionQuality),
    currentLatency: readonly(currentLatency),
    averageLatency,
    jitter,
    networkState: readonly(networkState),
    queuedMessageCount,
    maintenance: readonly(maintenance),

    // Timer state
    timerRemaining: readonly(timerRemaining),
    timerExpired: readonly(timerExpired),

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
    startTimer,
    cancelTimer,
    setTimerAutoReveal,
  };
}

// Type-safe injection key for providing/injecting the poker room composable
export type PokerRoomComposable = ReturnType<typeof usePokerRoom>;
export const PokerRoomKey: InjectionKey<PokerRoomComposable> = Symbol('pokerRoom');
