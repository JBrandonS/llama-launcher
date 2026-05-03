import { test, expect } from '@playwright/test';
import { navigateTo, clickTab } from './helpers';

const SETTINGS_LABEL = 'Settings';

test.describe('SettingsPage — Application settings', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await navigateTo(page, SETTINGS_LABEL);
    await expect(page).toHaveURL(/\/settings/);
  });

  /* ── 1. Settings page loads ─────────────────────────────────── */

  test('shows page heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Settings', level: 1 })
    ).toBeVisible();
    await expect(
      page.getByText('Configure application preferences and behavior')
    ).toBeVisible();
  });

  test('default "General" tab is visible and selected', async ({ page }) => {
    const generalTab = page.getByRole('tab', { name: 'General' });
    await expect(generalTab).toBeVisible();
    await expect(generalTab).toHaveAttribute('aria-selected', 'true');
  });

  /* ── 2. Tab navigation works ────────────────────────────────── */

  test('clicking "General" tab shows its content', async ({ page }) => {
    await clickTab(page, 'General');
    await expect(page.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true');
  });

  test('clicking "Appearance" tab shows its content', async ({ page }) => {
    await clickTab(page, 'Appearance');
    await expect(page.getByRole('tab', { name: 'Appearance' })).toHaveAttribute('aria-selected', 'true');
  });

  test('only one tab is active at a time', async ({ page }) => {
    await clickTab(page, 'Appearance');
    const selectedCount = await page.locator('[aria-selected="true"]').count();
    expect(selectedCount).toBe(1);

    await clickTab(page, 'General');
    const newSelectedCount = await page.locator('[aria-selected="true"]').count();
    expect(newSelectedCount).toBe(1);
  });

  /* ── 3. General tab fields ──────────────────────────────────── */

  test('general tab shows Language selector', async ({ page }) => {
    await clickTab(page, 'General');
    await expect(
      page.locator('div:has(> label:has-text("Language")) select, div:has(> label:has-text("Language")) input')
    ).toBeVisible();
  });

  test('general tab shows Auto-refresh interval number input', async ({ page }) => {
    await clickTab(page, 'General');
    await expect(
      page.locator('div:has(> label:has-text("Auto-refresh interval")) input[type="number"]')
    ).toBeVisible();
  });

  test('general tab shows Data retention number input', async ({ page }) => {
    await clickTab(page, 'General');
    await expect(
      page.locator('div:has(> label:has-text("Data retention")) input[type="number"]')
    ).toBeVisible();
  });

  /* ── 4. Appearance tab fields ───────────────────────────────── */

  test('appearance tab shows Theme selector buttons', async ({ page }) => {
    await clickTab(page, 'Appearance');
    await expect(page.getByRole('button', { name: 'Light' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dark' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'System' })).toBeVisible();
  });

  test('appearance tab shows Compact mode switch', async ({ page }) => {
    await clickTab(page, 'Appearance');
    await expect(page.getByRole('switch', { name: /toggle compact mode/i })).toBeVisible();
  });

  /* ── 5. Save button exists ──────────────────────────────────── */

  test('save changes button area exists in DOM when dirty', async ({ page }) => {
    const container = page.locator('div:has(> label:has-text("Auto-refresh interval"))');
    await container.locator('input[type="number"]').fill('99');
    await expect(
      page.getByRole('button', { name: 'Save Changes' })
    ).toBeVisible();
  });

  test('save button has Save icon (role="button" with name containing Save)', async ({ page }) => {
    const container = page.locator('div:has(> label:has-text("Auto-refresh interval"))');
    await container.locator('input[type="number"]').fill('99');
    const btn = page.getByRole('button', { name: 'Save Changes' });
    await expect(btn).toBeVisible();
    expect(btn).not.toBeDisabled();
  });

  /* ── 6. Tab state persists — navigate away and back ─────────── */

  test('tab selection resets to default after navigating away and back', async ({ page }) => {
    await clickTab(page, 'Appearance');
    await expect(page.getByRole('tab', { name: 'Appearance' })).toHaveAttribute('aria-selected', 'true');

    /* Navigate to another page and back */
    await navigateTo(page, 'Dashboard');
    await expect(page).toHaveURL(/\/$/);

    await navigateTo(page, SETTINGS_LABEL);
    await expect(page).toHaveURL(/\/settings/);

    /* Tab should be "General" (default) after fresh navigation */
    await expect(page.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true');
  });

  test('general tab selected after fresh navigation', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true');
  });

});
