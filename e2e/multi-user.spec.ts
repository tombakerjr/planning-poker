import { test, expect } from '@playwright/test';

test.describe('Multi-User Voting', () => {
  test('should handle two users voting in same room', async ({ browser }) => {
    // Create two browser contexts (separate users)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // User 1 creates room
      await page1.goto('/');
      await page1.getByRole('button', { name: /Create New Room/i }).click();

      // Wait for connection
      await expect(page1.getByText(/Connected/i)).toBeVisible({ timeout: 10000 });

      // Get room URL
      const roomUrl = page1.url();

      // User 1 joins
      await page1.getByPlaceholder(/Enter your name/i).fill('Alice');
      await page1.getByRole('button', { name: /Join Room/i }).click();
      await expect(page1.getByText('Alice')).toBeVisible();

      // User 2 joins same room
      await page2.goto(roomUrl);
      await expect(page2.getByText(/Connected/i)).toBeVisible({ timeout: 10000 });
      await page2.getByPlaceholder(/Enter your name/i).fill('Bob');
      await page2.getByRole('button', { name: /Join Room/i }).click();

      // Both users should see each other
      await expect(page1.getByText('Bob')).toBeVisible();
      await expect(page2.getByText('Alice')).toBeVisible();

      // Verify participant count
      await expect(page1.getByText('2')).toBeVisible(); // Participant count
      await expect(page2.getByText('2')).toBeVisible();

      // User 1 votes
      await page1.getByRole('button', { name: '5' }).click();

      // User 2 should see voting progress updated
      await expect(page2.getByText('1/2')).toBeVisible(); // 1 of 2 voted

      // User 2 votes
      await page2.getByRole('button', { name: '8' }).click();

      // Both should see voting complete
      await expect(page1.getByText('2/2')).toBeVisible();
      await expect(page2.getByText('2/2')).toBeVisible();

      // Reveal button should appear for both
      await expect(page1.getByRole('button', { name: /Reveal Votes/i })).toBeVisible();
      await expect(page2.getByRole('button', { name: /Reveal Votes/i })).toBeVisible();

      // User 1 reveals
      await page1.getByRole('button', { name: /Reveal Votes/i }).click();

      // Both should see revealed votes
      await expect(page1.getByText('Alice')).toBeVisible();
      await expect(page1.getByText('5')).toBeVisible();
      await expect(page1.getByText('Bob')).toBeVisible();
      await expect(page1.getByText('8')).toBeVisible();

      await expect(page2.getByText('Alice')).toBeVisible();
      await expect(page2.getByText('5')).toBeVisible();
      await expect(page2.getByText('Bob')).toBeVisible();
      await expect(page2.getByText('8')).toBeVisible();
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('should show waiting state when not all users voted', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // User 1 creates and joins
      await page1.goto('/');
      await page1.getByRole('button', { name: /Create New Room/i }).click();
      await expect(page1.getByText(/Connected/i)).toBeVisible({ timeout: 10000 });

      const roomUrl = page1.url();

      await page1.getByPlaceholder(/Enter your name/i).fill('Alice');
      await page1.getByRole('button', { name: /Join Room/i }).click();

      // User 2 joins
      await page2.goto(roomUrl);
      await expect(page2.getByText(/Connected/i)).toBeVisible({ timeout: 10000 });
      await page2.getByPlaceholder(/Enter your name/i).fill('Bob');
      await page2.getByRole('button', { name: /Join Room/i }).click();

      // Only User 1 votes
      await page1.getByRole('button', { name: '3' }).click();

      // Reveal button should NOT appear (not all voted)
      await expect(page1.getByRole('button', { name: /Reveal Votes/i })).not.toBeVisible();
      await expect(page2.getByRole('button', { name: /Reveal Votes/i })).not.toBeVisible();

      // Should show voting progress
      await expect(page1.getByText('1/2')).toBeVisible();
      await expect(page2.getByText('1/2')).toBeVisible();
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('should sync new round across all users', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Setup: Both users join and complete a voting round
      await page1.goto('/');
      await page1.getByRole('button', { name: /Create New Room/i }).click();
      await expect(page1.getByText(/Connected/i)).toBeVisible({ timeout: 10000 });

      const roomUrl = page1.url();

      await page1.getByPlaceholder(/Enter your name/i).fill('Alice');
      await page1.getByRole('button', { name: /Join Room/i }).click();

      await page2.goto(roomUrl);
      await expect(page2.getByText(/Connected/i)).toBeVisible({ timeout: 10000 });
      await page2.getByPlaceholder(/Enter your name/i).fill('Bob');
      await page2.getByRole('button', { name: /Join Room/i }).click();

      // Both vote
      await page1.getByRole('button', { name: '5' }).click();
      await page2.getByRole('button', { name: '8' }).click();

      // Reveal
      await page1.getByRole('button', { name: /Reveal Votes/i }).click();

      // User 1 starts new round
      await page1.getByRole('button', { name: /New Round/i }).click();

      // Both users should see cleared votes
      await expect(page1.getByRole('button', { name: '5' })).not.toHaveClass(/ring-2/);
      await expect(page2.getByRole('button', { name: '8' })).not.toHaveClass(/ring-2/);

      // Both should be able to vote again
      await page1.getByRole('button', { name: '13' }).click();
      await page2.getByRole('button', { name: '21' }).click();

      await expect(page1.getByRole('button', { name: '13' })).toHaveClass(/ring-2/);
      await expect(page2.getByRole('button', { name: '21' })).toHaveClass(/ring-2/);
    } finally {
      await context1.close();
      await context2.close();
    }
  });
});
