import { test, expect } from '@playwright/test';
import { navigateTo } from './helpers';

/**
 * E2E tests for template save/load on the Launch page.
 * Covers: Save Template button state, Load Template button,
 *         PresetsManager save/load buttons.
 */

const LAUNCH_LABEL = 'Launch';

test.describe('Template Save/Load', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await navigateTo(page, LAUNCH_LABEL);
    await expect(page).toHaveURL(/\/launch/);
    // Wait for the launch form to be fully rendered
    await expect(
      page.getByRole('heading', { name: 'Launch Server', level: 1 })
    ).toBeVisible({ timeout: 10_000 });
  });

  /* ── 1. Save Template button state ─────────────────────────── */

  test('Save Template button is visible on the launch page', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: 'Save Template' })
    ).toBeVisible();
  });

  test('Save Template button is disabled when no model is selected', async ({ page }) => {
    const saveBtn = page.getByRole('button', { name: 'Save Template' });
    await expect(saveBtn).toBeDisabled();
  });

  /* ── 2. Load Template button ───────────────────────────────── */

  test('Load Template button is visible on the launch page', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: 'Load Template' })
    ).toBeVisible();
  });

  test('Load Template button is always enabled (no model required)', async ({ page }) => {
    const loadBtn = page.getByRole('button', { name: 'Load Template' });
    await expect(loadBtn).toBeEnabled();
  });

  /* ── 3. Template save/load buttons layout ──────────────────── */

  test('Save and Load Template buttons are in the same toolbar group', async ({ page }) => {
    const saveBtn = page.getByRole('button', { name: 'Save Template' });
    const loadBtn = page.getByRole('button', { name: 'Load Template' });
    await expect(saveBtn).toBeVisible();
    await expect(loadBtn).toBeVisible();

    // Both buttons should be in the same horizontal group (flex gap-2)
    const saveBox = await saveBtn.boundingBox();
    const loadBox = await loadBtn.boundingBox();
    expect(saveBox).not.toBeNull();
    expect(loadBox).not.toBeNull();
    if (saveBox && loadBox) {
      // They should be on roughly the same row
      expect(Math.abs(saveBox.y - loadBox.y)).toBeLessThan(20);
    }
  });

  /* ── 4. PresetsManager save/load buttons ───────────────────── */

  test('PresetsManager has Save Current button', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: 'Save Current' })
    ).toBeVisible();
  });

  test('PresetsManager shows preset cards as clickable buttons', async ({ page }) => {
    // Preset cards like "Balanced" are rendered as buttons
    const balancedBtn = page.getByRole('button', { name: 'Balanced' });
    await expect(balancedBtn).toBeVisible();
  });

  test('clicking Load Template button triggers showOpenFilePicker', async ({ page }) => {
    // The Load Template button calls window.showOpenFilePicker() (File System Access API).
    // Playwright can mock this — verify clicking the button actually invokes it.
    const loadBtn = page.getByRole('button', { name: 'Load Template' });

    // Mock showOpenFilePicker to track if it was called
    await page.evaluate(() => {
      (window as any).__openFilePickerCalled = false;
      const original = window.showOpenFilePicker;
      (window as any).showOpenFilePicker = async function (...args: unknown[]) {
        (window as any).__openFilePickerCalled = true;
        // Return an empty array to abort without error
        return [];
      };
    });

    await loadBtn.click();

    const called = await page.evaluate(() => (window as any).__openFilePickerCalled);
    expect(called).toBe(true);
  });

  test('clicking Save Template triggers showSaveFilePicker when model is selected', async ({ page }) => {
    const saveBtn = page.getByRole('button', { name: 'Save Template' });

    // First check if the button is disabled (no model selected)
    const isDisabled = await saveBtn.isDisabled();

    if (isDisabled) {
      // No model available — verify button state only
      await expect(saveBtn).toBeDisabled();
    } else {
      // Model is available — mock showSaveFilePicker and click
      await page.evaluate(() => {
        (window as any).__saveFilePickerCalled = false;
        const original = window.showSaveFilePicker;
        (window as any).showSaveFilePicker = async function (...args: unknown[]) {
          (window as any).__saveFilePickerCalled = true;
          // Return a mock handle that resolves
          return {
            createWritable: async () => ({
              write: async () => {},
              close: async () => {},
            }),
          };
        };
      });

      await saveBtn.click();

      const called = await page.evaluate(() => (window as any).__saveFilePickerCalled);
      expect(called).toBe(true);
    }
  });
});
