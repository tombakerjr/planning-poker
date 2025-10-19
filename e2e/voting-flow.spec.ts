import { test, expect } from '@playwright/test';

test.describe('Voting Flow', () => {
  test('should complete a full voting round with single user', async ({ page }) => {
    // Create room and join
    await page.goto('/');
    await page.getByRole('button', { name: /Create New Room/i }).click();

    // Wait for connection
    await expect(page.getByText(/Connected/i)).toBeVisible({ timeout: 10000 });

    // Join room with name
    await page.getByPlaceholder(/Enter your name/i).fill('Alice');
    await page.getByRole('button', { name: /Join Room/i }).click();

    // Verify we joined successfully
    await expect(page.getByText('Alice')).toBeVisible();

    // Select a vote (e.g., "5")
    await page.getByRole('button', { name: '5' }).click();

    // Vote should be selected (card should be highlighted)
    await expect(page.getByRole('button', { name: '5' })).toHaveClass(/ring-2/);

    // Reveal button should appear when all votes are in
    await expect(page.getByRole('button', { name: /Reveal Votes/i })).toBeVisible();

    // Click reveal
    await page.getByRole('button', { name: /Reveal Votes/i }).click();

    // Vote should be visible
    await expect(page.getByText('Alice')).toBeVisible();
    await expect(page.getByText('5')).toBeVisible();

    // New Round button should appear
    await expect(page.getByRole('button', { name: /New Round/i })).toBeVisible();
  });

  test('should allow changing vote before reveal', async ({ page }) => {
    // Create room and join
    await page.goto('/');
    await page.getByRole('button', { name: /Create New Room/i }).click();
    await expect(page.getByText(/Connected/i)).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder(/Enter your name/i).fill('Bob');
    await page.getByRole('button', { name: /Join Room/i }).click();

    // Select first vote
    await page.getByRole('button', { name: '3' }).click();
    await expect(page.getByRole('button', { name: '3' })).toHaveClass(/ring-2/);

    // Change vote
    await page.getByRole('button', { name: '8' }).click();

    // Old vote should be deselected
    await expect(page.getByRole('button', { name: '3' })).not.toHaveClass(/ring-2/);

    // New vote should be selected
    await expect(page.getByRole('button', { name: '8' })).toHaveClass(/ring-2/);
  });

  test('should allow deselecting vote by clicking same card', async ({ page }) => {
    // Create room and join
    await page.goto('/');
    await page.getByRole('button', { name: /Create New Room/i }).click();
    await expect(page.getByText(/Connected/i)).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder(/Enter your name/i).fill('Charlie');
    await page.getByRole('button', { name: /Join Room/i }).click();

    // Select vote
    await page.getByRole('button', { name: '13' }).click();
    await expect(page.getByRole('button', { name: '13' })).toHaveClass(/ring-2/);

    // Click same card again to deselect
    await page.getByRole('button', { name: '13' }).click();

    // Vote should be deselected
    await expect(page.getByRole('button', { name: '13' })).not.toHaveClass(/ring-2/);

    // Reveal button should not appear (no votes)
    await expect(page.getByRole('button', { name: /Reveal Votes/i })).not.toBeVisible();
  });

  test('should support coffee break vote', async ({ page }) => {
    // Create room and join
    await page.goto('/');
    await page.getByRole('button', { name: /Create New Room/i }).click();
    await expect(page.getByText(/Connected/i)).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder(/Enter your name/i).fill('David');
    await page.getByRole('button', { name: /Join Room/i }).click();

    // Select coffee break
    await page.getByRole('button', { name: '☕️' }).click();
    await expect(page.getByRole('button', { name: '☕️' })).toHaveClass(/ring-2/);

    // Reveal
    await page.getByRole('button', { name: /Reveal Votes/i }).click();

    // Coffee should be visible
    await expect(page.getByText('☕️')).toBeVisible();
  });

  test('should reset round and allow new voting', async ({ page }) => {
    // Create room and join
    await page.goto('/');
    await page.getByRole('button', { name: /Create New Room/i }).click();
    await expect(page.getByText(/Connected/i)).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder(/Enter your name/i).fill('Eve');
    await page.getByRole('button', { name: /Join Room/i }).click();

    // Vote and reveal
    await page.getByRole('button', { name: '5' }).click();
    await page.getByRole('button', { name: /Reveal Votes/i }).click();

    // Start new round
    await page.getByRole('button', { name: /New Round/i }).click();

    // Votes should be cleared
    await expect(page.getByRole('button', { name: '5' })).not.toHaveClass(/ring-2/);

    // Should be able to vote again
    await page.getByRole('button', { name: '8' }).click();
    await expect(page.getByRole('button', { name: '8' })).toHaveClass(/ring-2/);
  });
});
