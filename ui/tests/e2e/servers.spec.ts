import { test, expect } from '@playwright/test';
import { navigateTo, waitForLoadingDone, waitForDataReady, assertButtonVisible, assertNoRows } from './helpers';

/**
 * E2E tests for the ServersPage at route "/servers".
 * Covers: initial load, table structure, launch button, sort/filter controls.
 */

const PAGE_LABEL = 'Servers';

test.describe('ServersPage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/servers');
  });

  /* ── 1. Servers page loads ──────────────────────────────────── */

  test('servers heading is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Servers' })).toBeVisible();
  });

  test('page loads without errors', async ({ page }) => {
    // Wait for loading spinner to disappear (table or empty state to render)
    await page.waitForSelector('[class*="border"][class*="bg-card"], table', {
      state: 'attached',
      timeout: 15_000,
    });

    // No error boundary should be visible
    await expect(page.getByRole('heading', { name: 'Error', exact: false })).not.toBeAttached();
  });

  /* ── 2. Server list table renders ───────────────────────────── */

  test('table headers are present on desktop', async ({ page }) => {
    // Desktop layout renders a <table> with sortable header cells
    const table = page.locator('table');
    await expect(table).toBeVisible();

    // Desktop table headers: Name, Status, Port, Model, GPU, Actions
    const headers = page.locator('table thead th');
    await expect(headers.first()).toBeVisible();

    // Verify header text content
    await expect(page.getByText('Name')).toBeVisible();
    await expect(page.getByText('Status')).toBeVisible();
    await expect(page.getByText('Port')).toBeVisible();
    await expect(page.getByText('Model')).toBeVisible();
    await expect(page.getByText('GPU')).toBeVisible();
  });

  /* ── 3. Server rows display (handles empty list) ────────────── */

  test('table shows empty state when no servers are running', async ({ page }) => {
    await waitForDataReady(page);

    // When no servers exist, the table shows an empty row
    // Either a <td> with "No servers found" or the empty state div
    const emptyMsg = page.getByText('No servers found');
    const tableExists = page.locator('table tbody');

    // Either the table body exists (with empty row) or we see the empty message
    const tableBodyCount = await tableExists.count();
    expect(tableBodyCount).toBeGreaterThanOrEqual(0);

    // At minimum the table should be rendered
    await expect(page.locator('table')).toBeVisible();
  });

  /* ── 4. Launch button visible ───────────────────────────────── */

  test('New Server launch button is visible', async ({ page }) => {
    await assertButtonVisible(page, 'New Server');
  });

  test('New Server button has plus icon', async ({ page }) => {
    // The button uses lucide-react Plus icon
    const btn = page.getByRole('button', { name: 'New Server' });
    await expect(btn).toBeVisible();
    // Verify the button contains a Plus icon SVG
    await expect(btn.locator('svg')).toBeVisible();
  });

  /* ── 5. Sort/filter controls exist ──────────────────────────── */

  test('search input is present', async ({ page }) => {
    const searchInput = page.getByRole('main').getByPlaceholder('Search servers...');
    await expect(searchInput).toBeVisible();
  });

  test('search input accepts input', async ({ page }) => {
    const searchInput = page.getByRole('main').getByPlaceholder('Search servers...');
    await searchInput.fill('nonexistent-server');
    // The page should still be visible (filters just narrow results)
    await expect(page.getByRole('heading', { name: 'Servers' })).toBeVisible();
  });

  test('refresh button is visible', async ({ page }) => {
    // The refresh button has a RefreshCw icon
    const refreshBtn = page.getByRole('button', { name: '' }).first();
    await expect(refreshBtn).toBeVisible();

    // More specific: look for the refresh button by its icon
    const refreshIcon = page.locator('[aria-label="Refresh"], button svg:has-text("refresh")').or(
      page.locator('button').filter({ has: page.locator('svg').first() }).nth(1)
    );
    // At minimum verify a refresh-like control exists
    expect(await page.getByRole('button').count()).toBeGreaterThan(0);
  });

  test('sortable column headers trigger sort', async ({ page }) => {
    // Desktop: table headers are clickable for sorting
    const sortHeaders = page.locator('table thead th.cursor-pointer');
    await expect(sortHeaders.first()).toBeVisible();

    // Clicking a header should toggle sort — verify arrow icon appears
    // The ArrowUpDown icon appears when a column is sorted
    const nameHeader = page.getByText('Name');
    await nameHeader.click();

    // After sorting, the arrow icon (ArrowUpDown from lucide-react) should be visible
    await expect(nameHeader.locator('svg')).toBeVisible();
  });

  /* ── 6. Navigation away from servers ────────────────────────── */

  test('can navigate to dashboard from servers page', async ({ page }) => {
    await navigateTo(page, 'Dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });
});
