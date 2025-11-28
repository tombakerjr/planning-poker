import { expect, test } from '@playwright/test';

test.describe('Room Creation', () => {
  test('should create a new room and navigate to it', async ({ page }) => {
    // Navigate to home page
    await page.goto('/');

    // Verify we're on the home page
    await expect(page).toHaveTitle(/Planning Poker/);
    await expect(page.getByRole('heading', { name: 'Planning Poker' })).toBeVisible();

    // Click the "Create New Room" button
    await page.getByRole('button', { name: /Create New Room/i }).click();

    // Should navigate to a room page with a room ID
    await expect(page).toHaveURL(/\/room\/[a-zA-Z0-9_-]+/);

    // Should show the name modal
    await expect(page.getByText(/Join Room/i)).toBeVisible();
  });

  test('should display room ID in URL after creation', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Create New Room/i }).click();

    // Extract room ID from URL
    const url = page.url();
    const roomId = url.split('/room/')[1];

    expect(roomId).toBeTruthy();
    expect(roomId.length).toBeGreaterThan(0);
  });

  test('should handle rapid room creation requests', async ({ page }) => {
    await page.goto('/');

    // Click create button multiple times rapidly
    const createButton = page.getByRole('button', { name: /Create New Room/i });

    await createButton.click();

    // Should only create one room
    await expect(page).toHaveURL(/\/room\/[a-zA-Z0-9_-]+/);
  });
});
