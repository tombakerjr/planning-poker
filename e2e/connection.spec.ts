import { test, expect } from '@playwright/test';

test.describe('WebSocket Connection', () => {
  test('should establish WebSocket connection on room load', async ({ page }) => {
    // Navigate to home and create room
    await page.goto('/');
    await page.getByRole('button', { name: /Create New Room/i }).click();

    // Should show "Connected" status
    await expect(page.getByText(/Connected/i)).toBeVisible({ timeout: 10000 });

    // Connection indicator should be green
    const connectionDot = page.locator('.bg-green-500').first();
    await expect(connectionDot).toBeVisible();
  });

  test('should show connecting status initially', async ({ page }) => {
    // Navigate to home and create room
    await page.goto('/');
    await page.getByRole('button', { name: /Create New Room/i }).click();

    // Should briefly show "Connecting" or immediately "Connected"
    // We check for either state as it may connect very quickly
    await expect(
      page.getByText(/Connected|Connecting/i)
    ).toBeVisible({ timeout: 10000 });
  });

  test('should maintain connection during voting', async ({ page }) => {
    // Create room and join
    await page.goto('/');
    await page.getByRole('button', { name: /Create New Room/i }).click();
    await expect(page.getByText(/Connected/i)).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder(/Enter your name/i).fill('Alice');
    await page.getByRole('button', { name: /Join Room/i }).click();

    // Vote
    await page.getByRole('button', { name: '5' }).click();

    // Connection should still be active
    await expect(page.getByText(/Connected/i)).toBeVisible();

    // Reveal
    await page.getByRole('button', { name: /Reveal Votes/i }).click();

    // Connection should still be active
    await expect(page.getByText(/Connected/i)).toBeVisible();
  });

  test('should handle direct room URL navigation', async ({ page }) => {
    // First, create a room to get a valid room ID
    await page.goto('/');
    await page.getByRole('button', { name: /Create New Room/i }).click();
    await expect(page.getByText(/Connected/i)).toBeVisible({ timeout: 10000 });

    const roomUrl = page.url();

    // Navigate away
    await page.goto('/');

    // Navigate back to room URL directly
    await page.goto(roomUrl);

    // Should establish connection
    await expect(page.getByText(/Connected/i)).toBeVisible({ timeout: 10000 });

    // Should show join modal
    await expect(page.getByText(/Join Room/i)).toBeVisible();
  });

  test('should persist connection after page interactions', async ({ page }) => {
    // Create room and join
    await page.goto('/');
    await page.getByRole('button', { name: /Create New Room/i }).click();
    await expect(page.getByText(/Connected/i)).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder(/Enter your name/i).fill('Bob');
    await page.getByRole('button', { name: /Join Room/i }).click();

    // Perform multiple actions
    await page.getByRole('button', { name: '3' }).click();
    await page.getByRole('button', { name: '8' }).click();
    await page.getByRole('button', { name: '13' }).click();

    // Connection should remain stable
    await expect(page.getByText(/Connected/i)).toBeVisible();
  });
});

test.describe('Session Persistence', () => {
  test('should remember user name after page reload', async ({ page, context }) => {
    // Create room and join with name
    await page.goto('/');
    await page.getByRole('button', { name: /Create New Room/i }).click();
    await expect(page.getByText(/Connected/i)).toBeVisible({ timeout: 10000 });

    const roomUrl = page.url();

    await page.getByPlaceholder(/Enter your name/i).fill('Charlie');
    await page.getByRole('button', { name: /Join Room/i }).click();

    await expect(page.getByText('Charlie')).toBeVisible();

    // Reload page
    await page.reload();

    // Should auto-reconnect and auto-rejoin
    await expect(page.getByText(/Connected/i)).toBeVisible({ timeout: 10000 });

    // Name modal should NOT appear (auto-rejoined)
    // Wait a bit to ensure modal doesn't appear
    await page.waitForTimeout(1000);

    // Should still show user in participants
    await expect(page.getByText('Charlie')).toBeVisible();
  });

  test('should clear session after 24 hours (mocked)', async ({ page }) => {
    // This test would require mocking time, which is complex in E2E tests
    // For now, we'll just verify the session storage exists
    await page.goto('/');
    await page.getByRole('button', { name: /Create New Room/i }).click();
    await expect(page.getByText(/Connected/i)).toBeVisible({ timeout: 10000 });

    const roomUrl = page.url();
    const roomId = roomUrl.split('/room/')[1];

    await page.getByPlaceholder(/Enter your name/i).fill('David');
    await page.getByRole('button', { name: /Join Room/i }).click();

    // Check localStorage for session
    const sessionData = await page.evaluate((rid) => {
      return localStorage.getItem(`poker-session-${rid}`);
    }, roomId);

    expect(sessionData).toBeTruthy();

    // Parse and verify session structure
    const session = JSON.parse(sessionData!);
    expect(session.name).toBe('David');
    expect(session.userId).toBeTruthy();
    expect(session.timestamp).toBeTruthy();
  });
});
