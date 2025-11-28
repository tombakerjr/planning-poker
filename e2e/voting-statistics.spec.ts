import { expect, test } from '@playwright/test';

test.describe('Voting Statistics', () => {
  test('should display statistics when votes are revealed', async ({ page }) => {
    // Create room and join
    await page.goto('/');
    await page.getByRole('button', { name: /Create New Room/i }).click();
    await expect(page.getByText(/Connected/i)).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder(/Enter your name/i).fill('StatsUser');
    await page.getByRole('button', { name: /Join Room/i }).click();

    // Vote
    await page.getByRole('button', { name: '5' }).click();

    // Reveal votes
    await page.getByRole('button', { name: /Reveal Votes/i }).click();

    // Statistics should be displayed
    await expect(page.getByText('Mode')).toBeVisible();
    await expect(page.getByText('Average')).toBeVisible();
    await expect(page.getByText('Median')).toBeVisible();
    await expect(page.getByText('Consensus')).toBeVisible();

    // Mode should show the vote value
    await expect(page.getByText('5').first()).toBeVisible();

    // Consensus should show 100% for single voter
    await expect(page.getByText('100%')).toBeVisible();
  });

  test('should display consensus bar with color coding', async ({ page }) => {
    // Create room and join
    await page.goto('/');
    await page.getByRole('button', { name: /Create New Room/i }).click();
    await expect(page.getByText(/Connected/i)).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder(/Enter your name/i).fill('ConsensusUser');
    await page.getByRole('button', { name: /Join Room/i }).click();

    // Vote
    await page.getByRole('button', { name: '3' }).click();

    // Reveal votes
    await page.getByRole('button', { name: /Reveal Votes/i }).click();

    // Consensus bar should be visible with strong consensus message
    await expect(page.getByText('Consensus Level')).toBeVisible();
    await expect(page.getByText('Strong consensus!')).toBeVisible();
  });

  test('should display vote distribution chart', async ({ page }) => {
    // Create room and join
    await page.goto('/');
    await page.getByRole('button', { name: /Create New Room/i }).click();
    await expect(page.getByText(/Connected/i)).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder(/Enter your name/i).fill('DistributionUser');
    await page.getByRole('button', { name: /Join Room/i }).click();

    // Vote
    await page.getByRole('button', { name: '8' }).click();

    // Reveal votes
    await page.getByRole('button', { name: /Reveal Votes/i }).click();

    // Distribution chart should be visible
    await expect(page.getByText('Vote Distribution')).toBeVisible();

    // Vote count should be shown
    await expect(page.getByText('Based on 1 vote')).toBeVisible();
  });

  test('should exclude ? votes from statistics with note', async ({ page }) => {
    // Create room and join
    await page.goto('/');
    await page.getByRole('button', { name: /Create New Room/i }).click();
    await expect(page.getByText(/Connected/i)).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder(/Enter your name/i).fill('UnsureUser');
    await page.getByRole('button', { name: /Join Room/i }).click();

    // Vote with ?
    await page.getByRole('button', { name: '?' }).click();

    // Reveal votes
    await page.getByRole('button', { name: /Reveal Votes/i }).click();

    // Excluded votes note should appear
    await expect(page.getByText('Excluded from statistics')).toBeVisible();
    await expect(page.getByText(/voted "?"/)).toBeVisible();
  });

  test('should hide statistics and show voting cards after new round', async ({ page }) => {
    // Create room and join
    await page.goto('/');
    await page.getByRole('button', { name: /Create New Room/i }).click();
    await expect(page.getByText(/Connected/i)).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder(/Enter your name/i).fill('RoundUser');
    await page.getByRole('button', { name: /Join Room/i }).click();

    // Vote and reveal
    await page.getByRole('button', { name: '5' }).click();
    await page.getByRole('button', { name: /Reveal Votes/i }).click();

    // Statistics visible
    await expect(page.getByText('Mode')).toBeVisible();

    // Start new round
    await page.getByRole('button', { name: /New Round/i }).click();

    // Statistics should be hidden
    await expect(page.getByText('Mode')).not.toBeVisible();

    // Voting cards should be visible again
    await expect(page.getByRole('button', { name: '5' })).toBeVisible();
  });

  test('should show std dev and range for numeric scales', async ({ page }) => {
    // Create room and join
    await page.goto('/');
    await page.getByRole('button', { name: /Create New Room/i }).click();
    await expect(page.getByText(/Connected/i)).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder(/Enter your name/i).fill('NumericUser');
    await page.getByRole('button', { name: /Join Room/i }).click();

    // Vote
    await page.getByRole('button', { name: '13' }).click();

    // Reveal votes
    await page.getByRole('button', { name: /Reveal Votes/i }).click();

    // Numeric stats should be visible
    await expect(page.getByText('Std Dev')).toBeVisible();
    await expect(page.getByText('Range')).toBeVisible();
  });
});
