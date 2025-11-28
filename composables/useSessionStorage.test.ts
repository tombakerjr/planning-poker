import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetSessionStorage, useSessionStorage } from './useSessionStorage';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

// Set up global mocks
vi.stubGlobal('window', { ...globalThis.window });
vi.stubGlobal('localStorage', localStorageMock);

describe('useSessionStorage', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    // Reset the singleton state between tests
    resetSessionStorage();
  });

  describe('Recent Rooms', () => {
    it('should add a room to recent rooms', () => {
      const { addRecentRoom, sortedRecentRooms } = useSessionStorage();

      addRecentRoom({
        roomId: 'test-room-1',
        name: 'Test User',
      });

      expect(sortedRecentRooms.value).toHaveLength(1);
      expect(sortedRecentRooms.value[0].roomId).toBe('test-room-1');
      expect(sortedRecentRooms.value[0].name).toBe('Test User');
    });

    it('should update existing room on re-add', () => {
      const { addRecentRoom, sortedRecentRooms } = useSessionStorage();

      addRecentRoom({
        roomId: 'test-room-1',
        name: 'User 1',
      });
      addRecentRoom({
        roomId: 'test-room-1',
        name: 'User 1 Updated',
      });

      expect(sortedRecentRooms.value).toHaveLength(1);
      expect(sortedRecentRooms.value[0].name).toBe('User 1 Updated');
    });

    it('should limit recent rooms to 10', () => {
      const { addRecentRoom, sortedRecentRooms } = useSessionStorage();

      // Add 12 rooms
      for (let i = 0; i < 12; i++) {
        addRecentRoom({
          roomId: `room-${i}`,
          name: `User ${i}`,
        });
      }

      expect(sortedRecentRooms.value).toHaveLength(10);
    });

    it('should remove a room from recent rooms', () => {
      const { addRecentRoom, removeRecentRoom, sortedRecentRooms } = useSessionStorage();

      addRecentRoom({ roomId: 'room-1', name: 'User 1' });
      addRecentRoom({ roomId: 'room-2', name: 'User 2' });

      removeRecentRoom('room-1');

      expect(sortedRecentRooms.value).toHaveLength(1);
      expect(sortedRecentRooms.value[0].roomId).toBe('room-2');
    });

    it('should update story title for recent room', () => {
      const { addRecentRoom, updateRecentRoomStory, sortedRecentRooms } = useSessionStorage();

      addRecentRoom({ roomId: 'room-1', name: 'User 1' });
      updateRecentRoomStory('room-1', 'New Story Title');

      expect(sortedRecentRooms.value[0].storyTitle).toBe('New Story Title');
    });
  });

  describe('Session History', () => {
    it('should add a session to history', () => {
      const { addSessionToHistory, sortedSessionHistory } = useSessionStorage();

      addSessionToHistory({
        roomId: 'room-1',
        userName: 'Test User',
        joinedAt: Date.now() - 60000,
        participantCount: 3,
        roundCount: 2,
        rounds: [],
        votingScale: 'fibonacci',
      });

      expect(sortedSessionHistory.value).toHaveLength(1);
      expect(sortedSessionHistory.value[0].userName).toBe('Test User');
      expect(sortedSessionHistory.value[0].leftAt).toBeDefined();
    });

    it('should calculate session statistics', () => {
      const { addSessionToHistory, sessionStats } = useSessionStorage();

      addSessionToHistory({
        roomId: 'room-1',
        userName: 'User 1',
        joinedAt: Date.now() - 60000,
        participantCount: 3,
        roundCount: 2,
        rounds: [],
        votingScale: 'fibonacci',
      });

      addSessionToHistory({
        roomId: 'room-2',
        userName: 'User 2',
        joinedAt: Date.now() - 30000,
        participantCount: 5,
        roundCount: 4,
        rounds: [],
        votingScale: 'fibonacci',
      });

      expect(sessionStats.value.totalSessions).toBe(2);
      expect(sessionStats.value.totalRounds).toBe(6);
      expect(sessionStats.value.avgParticipants).toBe(4);
    });
  });

  describe('User Preferences', () => {
    it('should update user preferences', () => {
      const { userPreferences, updatePreferences } = useSessionStorage();

      updatePreferences({ defaultVotingScale: 'powers-of-2' });

      expect(userPreferences.value.defaultVotingScale).toBe('powers-of-2');
    });

    it('should persist auto-reveal preference', () => {
      const { userPreferences, updatePreferences } = useSessionStorage();

      updatePreferences({ autoReveal: true });

      expect(userPreferences.value.autoReveal).toBe(true);
    });
  });

  describe('Export', () => {
    it('should export to JSON format', () => {
      const { addRecentRoom, exportToJSON } = useSessionStorage();

      addRecentRoom({ roomId: 'room-1', name: 'User 1' });

      const json = exportToJSON();
      const parsed = JSON.parse(json);

      expect(parsed.version).toBe('1.0');
      expect(parsed.exportedAt).toBeDefined();
      expect(parsed.recentRooms).toHaveLength(1);
    });

    it('should export to CSV format', () => {
      const { addSessionToHistory, exportToCSV } = useSessionStorage();

      addSessionToHistory({
        roomId: 'room-1',
        userName: 'User 1',
        joinedAt: Date.now() - 60000,
        participantCount: 3,
        roundCount: 2,
        rounds: [],
        votingScale: 'fibonacci',
      });

      const csv = exportToCSV();

      expect(csv).toContain('Room ID');
      expect(csv).toContain('User Name');
      expect(csv).toContain('room-1');
      expect(csv).toContain('User 1');
    });
  });
});
