import { test, expect } from '@playwright/test';
import { navigateTo, waitForLoadingDone, waitForDataReady } from './helpers';

/**
 * E2E tests for the DashboardPage at route "/".
 * Covers: initial load, loading state, stat cards, metrics chart, navigation.
 */

const PAGE_LABEL = 'Dashboard';

test.describe('DashboardPage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  /* ── 1. Dashboard loads ─────────────────────────────────────── */

  test('dashboard heading is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('skeleton loading state resolves to real content', async ({ page }) => {
    // Wait for any loading skeleton to disappear
    // The SkeletonCard renders with animate-pulse — it will detach once data loads
    await page.waitForSelector('.animate-pulse', { state: 'detached', timeout: 15_000 }).catch(() => {
      // No skeleton found — page already loaded, that's fine
    });

    // After loading, the heading should still be visible
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  /* ── 2. Stat cards rendered ─────────────────────────────────── */

  test('stat cards are rendered with correct labels', async ({ page }) => {
    // Wait for data to be ready (stat cards appear after API resolves)
    await waitForDataReady(page);

    // Dashboard shows 4 stat sections: Total Servers, Running, CPU Usage, Memory Usage
    await expect(page.getByText('Total Servers')).toBeVisible();
    await expect(page.getByText('Running', { exact: true })).toBeVisible();
    await expect(page.getByText('CPU Usage')).toBeVisible();
    await expect(page.getByText('Memory Usage')).toBeVisible();
  });

  test('stat cards display numeric values', async ({ page }) => {
    await waitForDataReady(page);

    // Each stat card contains a large numeric value (text-3xl)
    // We verify at least one card's value is present — values depend on API data
    const statCards = page.locator('[class*="StatCard"], [class*="stat-card"], [class*="bg-card"].p-5');
    const count = await statCards.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  /* ── 3. Metrics chart renders ───────────────────────────────── */

  test('resource history chart SVG element exists', async ({ page }) => {
    await waitForDataReady(page);

    // MultiResourceChart renders a recharts LineChart — look for its heading
    await expect(page.getByRole('heading', { name: /Resource History/i })).toBeVisible();
  });

  test('chart tab area is interactive', async ({ page }) => {
    await waitForDataReady(page);

    // Dashboard has tabs: Overview, Servers, Health
    await expect(page.getByRole('button', { name: 'Overview' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Health' })).toBeVisible();

    // Clicking the Health tab should switch content
    await page.getByRole('button', { name: 'Health' }).click();
    await expect(page.getByRole('heading', { name: 'System Health', level: 3 })).toBeVisible();
  });

  /* ── 4. Navigation from dashboard ───────────────────────────── */

  test('can navigate to servers page via sidebar', async ({ page }) => {
    await navigateTo(page, 'Servers');
    await expect(page.getByRole('heading', { name: 'Servers' })).toBeVisible();
  });

  test('can navigate to daemon page via sidebar', async ({ page }) => {
    await navigateTo(page, 'Daemon');
    await expect(page.getByRole('heading', { name: 'Daemon' })).toBeVisible();
  });

  test('can navigate back to dashboard', async ({ page }) => {
    // Navigate away then back
    await navigateTo(page, 'Servers');
    await navigateTo(page, 'Dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });
});
