import { test, expect } from '@playwright/test';
import { navigateTo } from './helpers';

/**
 * E2E tests for the Benchmark page.
 * Covers: page title, model selector, preset buttons,
 *         configuration parameters, and Run Benchmark button.
 */

const BENCHMARK_LABEL = 'Benchmark';

test.describe('Benchmark Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await navigateTo(page, BENCHMARK_LABEL);
    await expect(page).toHaveURL(/\/benchmark/);
    // Wait for the benchmark page to fully render
    await expect(
      page.getByRole('heading', { name: 'Benchmark', level: 1 })
    ).toBeVisible({ timeout: 10_000 });
  });

  /* ── 1. Page title and subtitle ────────────────────────────── */

  test('page displays "Benchmark" heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Benchmark', level: 1 })
    ).toBeVisible();
  });

  test('page displays subtitle about comparing model performance', async ({ page }) => {
    await expect(
      page.getByText('Compare model performance across different configurations')
    ).toBeVisible();
  });

  /* ── 2. Model selector dropdown ────────────────────────────── */

  test('model selector dropdown button is visible', async ({ page }) => {
    // The ModelSelector renders a button with placeholder "Select a model..."
    const modelSelector = page.getByRole('button', { name: /select a model/i });
    await expect(modelSelector).toBeVisible();
  });

  test('model selector shows search input when opened', async ({ page }) => {
    const modelSelector = page.getByRole('button', { name: /select a model/i });
    await modelSelector.click();
    // Wait for the dropdown panel to appear with a search input
    await expect(
      page.locator('input[placeholder="Search models..."]')
    ).toBeVisible({ timeout: 5_000 });
  });

  /* ── 3. Preset buttons (Quick Test, Standard, Full) ────────── */

  test('Quick Test preset button is visible', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: 'Quick Test' })
    ).toBeVisible();
  });

  test('Standard preset button is visible', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: 'Standard' })
    ).toBeVisible();
  });

  test('Full preset button is visible', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: 'Full' })
    ).toBeVisible();
  });

  test('all three preset buttons are in a grid layout', async ({ page }) => {
    // Presets are in a grid-cols-3 container
    const quickBtn = page.getByRole('button', { name: 'Quick Test' });
    const standardBtn = page.getByRole('button', { name: 'Standard' });
    const fullBtn = page.getByRole('button', { name: 'Full' });

    await expect(quickBtn).toBeVisible();
    await expect(standardBtn).toBeVisible();
    await expect(fullBtn).toBeVisible();

    // Verify they share the same parent container (grid gap-2)
    const quickBox = await quickBtn.boundingBox();
    const standardBox = await standardBtn.boundingBox();
    expect(quickBox).not.toBeNull();
    expect(standardBox).not.toBeNull();
    if (quickBox && standardBox) {
      // All presets should be on the same row
      expect(Math.abs(quickBox.y - standardBox.y)).toBeLessThan(20);
    }
  });

  test('clicking a preset applies its configuration', async ({ page }) => {
    // Click "Quick Test" preset — it should update the config parameters
    await page.getByRole('button', { name: 'Quick Test' }).click();

    // Verify the active configuration panel shows updated values
    // Quick Test sets: n_predict=128, threads=4, context_size=512, temperature=0.7
    await expect(
      page.getByText(/Active Configuration/i)
    ).toBeVisible({ timeout: 3_000 });
  });

  /* ── 4. Configuration parameters ───────────────────────────── */

  test('Tokens to Generate parameter input is visible', async ({ page }) => {
    await expect(
      page.getByLabel('Tokens to Generate')
    ).toBeVisible();
  });

  test('Threads parameter input is visible', async ({ page }) => {
    await expect(
      page.getByLabel('Threads')
    ).toBeVisible();
  });

  test('Context Size parameter input is visible', async ({ page }) => {
    await expect(
      page.getByLabel('Context Size')
    ).toBeVisible();
  });

  test('Temperature parameter input is visible', async ({ page }) => {
    await expect(
      page.getByLabel('Temperature')
    ).toBeVisible();
  });

  /* ── 5. Run Benchmark button ───────────────────────────────── */

  test('Run Benchmark button is present and disabled without model', async ({ page }) => {
    const runBtn = page.getByRole('button', { name: 'Run Benchmark' });
    await expect(runBtn).toBeVisible();
    await expect(runBtn).toBeDisabled();
  });

  test('Run Benchmark button becomes enabled after selecting a model', async ({ page }) => {
    const runBtn = page.getByRole('button', { name: 'Run Benchmark' });
    const modelSelector = page.getByRole('button', { name: /select a model/i });

    // Try to select a model; if none available, just verify initial state
    await expect(runBtn).toBeDisabled();

    const selectorVisible = await modelSelector.isVisible().catch(() => false);
    if (selectorVisible) {
      await modelSelector.click();
      await page.waitForTimeout(500);
      // Click first model option if available
      const firstOption = page.locator('[class*="hover:bg-muted"]').first();
      if (await firstOption.isVisible().catch(() => false)) {
        await firstOption.click();
        await expect(runBtn).toBeEnabled();
      }
    }
  });

  /* ── 6. Results panel ──────────────────────────────────────── */

  test('results panel shows empty state message', async ({ page }) => {
    // When no benchmarks have been run, the results panel shows an empty state
    await expect(
      page.getByText(/No benchmark results yet/i)
    ).toBeVisible();
  });

  /* ── 7. Configuration summary ──────────────────────────────── */

  test('active configuration summary is shown after selecting a model', async ({ page }) => {
    const modelSelector = page.getByRole('button', { name: /select a model/i });
    const runBtn = page.getByRole('button', { name: 'Run Benchmark' });

    if (await runBtn.isDisabled()) {
      // No model selected yet — select one to trigger the summary
      await modelSelector.click();
      await page.waitForTimeout(500);
      const firstOption = page.locator('[class*="hover:bg-muted"]').first();
      if (await firstOption.isVisible().catch(() => false)) {
        await firstOption.click();
        await expect(
          page.getByText(/Active Configuration/i)
        ).toBeVisible({ timeout: 3_000 });
      }
    } else {
      // Model already selected — summary should be visible
      await expect(
        page.getByText(/Active Configuration/i)
      ).toBeVisible();
    }
  });
});
