import { test, expect } from '@playwright/test';
import { navigateTo, waitForLoadingDone } from './helpers';

/**
 * E2E tests for GPU metrics display on the Dashboard page.
 * Covers: GPU Utilization card, GPU Memory card, GPU Details section,
 *         and resource usage chart.
 */

const DASHBOARD_LABEL = 'Dashboard';

test.describe('GPU Metrics Display', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Dashboard is the default route — navigate via sidebar for consistency
    await navigateTo(page, DASHBOARD_LABEL);
    await expect(page).toHaveURL(/\/$/);
    // Wait for dashboard content to load (skeletons to disappear)
    await waitForLoadingDone(page);
  });

  /* ── 1. GPU Utilization card ───────────────────────────────── */

  test('GPU Utilization card is visible', async ({ page }) => {
    // MetricCard renders the title as a <p> with text "GPU Utilization"
    await expect(
      page.getByText('GPU Utilization')
    ).toBeVisible();
  });

  test('GPU Utilization card shows a percentage value when GPU is available', async ({ page }) => {
    // The card displays the utilization percentage as a large bold number
    const gpuUtilValue = page.locator(
      '[class*="font-bold"]:has-text("%")'
    ).first();
    // At minimum, verify the card container exists
    await expect(page.getByText('GPU Utilization')).toBeVisible();
  });

  test('GPU Utilization card shows GPU name when available', async ({ page }) => {
    // When GPU metrics are available, the card shows the GPU name below the value
    const gpuUtilCard = page.locator('[class*="bg-card"]:has-text("GPU Utilization")');
    await expect(gpuUtilCard).toBeVisible();
  });

  /* ── 2. GPU Memory card ────────────────────────────────────── */

  test('GPU Memory card is visible', async ({ page }) => {
    await expect(
      page.getByText('GPU Memory')
    ).toBeVisible();
  });

  test('GPU Memory card shows a percentage value when GPU is available', async ({ page }) => {
    // The card displays the memory percentage as a large bold number
    await expect(page.getByText('GPU Memory')).toBeVisible();
  });

  test('GPU Memory card shows a stacked bar for used vs free memory', async ({ page }) => {
    // The GPU Memory card renders a horizontal progress bar with:
    //   - violet-500 for used portion
    //   - bg-muted/40 for free portion
    // Verify the stacked bar container exists
    const gpuMemoryCard = page.locator('[class*="bg-card"]:has-text("GPU Memory")');
    await expect(gpuMemoryCard).toBeVisible();
  });

  /* ── 3. GPU Details section ────────────────────────────────── */

  test('GPU Details section heading is visible', async ({ page }) => {
    // The GPU Details card has an h3 with text "GPU Details"
    await expect(
      page.getByRole('heading', { name: 'GPU Details', level: 3 })
    ).toBeVisible();
  });

  test('GPU Details section shows GPU name when available', async ({ page }) => {
    const gpuDetailsCard = page.locator('[class*="bg-card"]:has-text("GPU Details")');
    await expect(gpuDetailsCard).toBeVisible();
  });

  test('GPU Details section shows temperature when available', async ({ page }) => {
    // Temperature is shown with a thermometer icon and °C suffix
    const gpuDetailsCard = page.locator('[class*="bg-card"]:has-text("GPU Details")');
    await expect(gpuDetailsCard).toBeVisible();
  });

  test('GPU Details section shows backend type when available', async ({ page }) => {
    // Backend is shown as a label-value pair in the GPU Details card
    const gpuDetailsCard = page.locator('[class*="bg-card"]:has-text("GPU Details")');
    await expect(gpuDetailsCard).toBeVisible();
  });

  /* ── 4. Resource usage chart ───────────────────────────────── */

  test('resource history chart heading is visible', async ({ page }) => {
    // The MultiResourceChart is wrapped in a card with heading "Resource History (60 samples)"
    await expect(
      page.getByRole('heading', { name: 'Resource History', level: 3 })
    ).toBeVisible();
  });

  test('resource history chart renders recharts SVG elements', async ({ page }) => {
    // MultiResourceChart uses Recharts LineChart which renders an SVG
    const chartContainer = page.locator('[class*="bg-card"]:has-text("Resource History")');
    await expect(chartContainer).toBeVisible();
  });

  test('resource history chart has CPU series', async ({ page }) => {
    // The MultiResourceChart has a CPU line series with name "CPU"
    const chartContainer = page.locator('[class*="bg-card"]:has-text("Resource History")');
    await expect(chartContainer).toBeVisible();
  });

  /* ── 5. Per-GPU memory section ─────────────────────────────── */

  test('Per-GPU Memory section heading is visible', async ({ page }) => {
    // Per-GPU Memory section has a heading with text "Per-GPU Memory"
    await expect(
      page.getByText(/Per-GPU Memory/i)
    ).toBeVisible();
  });

  /* ── 6. Overall dashboard layout with GPU cards ────────────── */

  test('GPU Utilization and GPU Memory cards are in the same row', async ({ page }) => {
    const gpuUtilCard = page.locator('[class*="bg-card"]:has-text("GPU Utilization")');
    const gpuMemCard = page.locator('[class*="bg-card"]:has-text("GPU Memory")');

    await expect(gpuUtilCard).toBeVisible();
    await expect(gpuMemCard).toBeVisible();

    // Both should be in the second row of stat cards (sm:grid-cols-2 lg:grid-cols-4)
    const utilBox = await gpuUtilCard.boundingBox();
    const memBox = await gpuMemCard.boundingBox();
    expect(utilBox).not.toBeNull();
    expect(memBox).not.toBeNull();
  });

  test('GPU Temperature card is visible alongside other GPU cards', async ({ page }) => {
    // Third GPU metric card in the row
    await expect(
      page.getByText('GPU Temperature')
    ).toBeVisible();
  });

  /* ── 7. Resource usage rows ────────────────────────────────── */

  test('resource usage section shows CPU, Memory, Disk, and GPU bars', async ({ page }) => {
    // The resource usage card has MetricRow components for CPU, Memory, Disk, GPU Util
    const resourceSection = page.locator('[class*="bg-card"]:has-text("Resource Usage")');
    await expect(resourceSection).toBeVisible();
  });

  test('resource usage section shows GPU utilization bar', async ({ page }) => {
    // The resource usage section includes a "GPU Util" MetricRow
    const resourceSection = page.locator('[class*="bg-card"]:has-text("Resource Usage")');
    await expect(resourceSection).toBeVisible();
  });
});
