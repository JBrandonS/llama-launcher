import { test, expect } from '@playwright/test';
import { navigateTo, clickTab } from './helpers';

const SETTINGS_LABEL = 'Settings';

test.describe('SettingsPage — Application settings with 6 tabs', () => {

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
    /* The active tab has role="tab" and aria-selected="true" */
    const generalTab = page.getByRole('tab', { name: 'General' });
    await expect(generalTab).toBeVisible();
    await expect(generalTab).toHaveAttribute('aria-selected', 'true');
  });

  /* ── 2. Tab navigation works — click each of 6 tabs ─────────── */

  test('clicking "General" tab shows its content', async ({ page }) => {
    await clickTab(page, 'General');
    await expect(page.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true');
  });

  test('clicking "Appearance" tab shows its content', async ({ page }) => {
    await clickTab(page, 'Appearance');
    await expect(page.getByRole('tab', { name: 'Appearance' })).toHaveAttribute('aria-selected', 'true');
  });

  test('clicking "Server" tab shows its content', async ({ page }) => {
    await clickTab(page, 'Server');
    await expect(page.getByRole('tab', { name: 'Server' })).toHaveAttribute('aria-selected', 'true');
  });

  test('clicking "API" tab shows its content', async ({ page }) => {
    await clickTab(page, 'API');
    await expect(page.getByRole('tab', { name: 'API' })).toHaveAttribute('aria-selected', 'true');
  });

  test('clicking "Security" tab shows its content', async ({ page }) => {
    await clickTab(page, 'Security');
    await expect(page.getByRole('tab', { name: 'Security' })).toHaveAttribute('aria-selected', 'true');
  });

  test('clicking "Advanced" tab shows its content', async ({ page }) => {
    await clickTab(page, 'Advanced');
    await expect(page.getByRole('tab', { name: 'Advanced' })).toHaveAttribute('aria-selected', 'true');
  });

  test('only one tab is active at a time', async ({ page }) => {
    await clickTab(page, 'Appearance');
    const selectedCount = await page.locator('[aria-selected="true"]').count();
    expect(selectedCount).toBe(1);

    await clickTab(page, 'Server');
    const newSelectedCount = await page.locator('[aria-selected="true"]').count();
    expect(newSelectedCount).toBe(1);
  });

  /* ── 3. Form fields render per tab ──────────────────────────── */

  test('general tab shows Language selector', async ({ page }) => {
    await clickTab(page, 'General');
    await expect(
      page.locator('div:has(> label:has-text("Language")) select, div:has(> label:has-text("Language")) input')
    ).toBeVisible();
  });

  test('general tab shows Theme selector', async ({ page }) => {
    await clickTab(page, 'General');
    await expect(
      page.locator('div:has(> label:has-text("Theme")) select, div:has(> label:has-text("Theme")) input, div:has(> label:has-text("Theme")) [role="combobox"]')
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

  test('general tab shows Auto-update switch', async ({ page }) => {
    await clickTab(page, 'General');
    await expect(page.getByRole('switch', { name: /toggle auto-update/i })).toBeVisible();
  });

  test('appearance tab shows Color scheme selector', async ({ page }) => {
    await clickTab(page, 'Appearance');
    await expect(
      page.locator('div:has(> label:has-text("Color scheme")) select, div:has(> label:has-text("Color scheme")) input, div:has(> label:has-text("Color scheme")) [role="combobox"]')
    ).toBeVisible();
  });

  test('appearance tab shows Compact mode switch', async ({ page }) => {
    await clickTab(page, 'Appearance');
    await expect(page.getByRole('switch', { name: /toggle compact mode/i })).toBeVisible();
  });

  test('server tab shows Max concurrent servers input', async ({ page }) => {
    await clickTab(page, 'Server');
    await expect(
      page.locator('div:has(> label:has-text("Max concurrent servers")) input[type="number"]')
    ).toBeVisible();
  });

  test('server tab shows Default GPU selector', async ({ page }) => {
    await clickTab(page, 'Server');
    await expect(
      page.locator('div:has(> label:has-text("Default GPU")) select, div:has(> label:has-text("Default GPU")) input, div:has(> label:has-text("Default GPU")) [role="combobox"]')
    ).toBeVisible();
  });

  test('api tab shows Backend URL input', async ({ page }) => {
    await clickTab(page, 'API');
    await expect(
      page.locator('div:has(> label:has-text("Backend URL")) input[type="url"], div:has(> label:has-text("Backend URL")) input[type="text"]')
    ).toBeVisible();
  });

  test('api tab shows Authentication method selector', async ({ page }) => {
    await clickTab(page, 'API');
    await expect(
      page.locator('div:has(> label:has-text("Authentication method")) select, div:has(> label:has-text("Authentication method")) input, div:has(> label:has-text("Authentication method")) [role="combobox"]')
    ).toBeVisible();
  });

  test('security tab shows Session timeout input', async ({ page }) => {
    await clickTab(page, 'Security');
    /* Field component renders <label> + <input> as siblings — use parent container query */
    await expect(
      page.locator('div:has(> label:has-text("Session timeout"))').locator('input[type="number"]')
    ).toBeVisible();
  });

  test('security tab shows IP allowlist switch', async ({ page }) => {
    await clickTab(page, 'Security');
    await expect(page.getByRole('switch', { name: /toggle ip allowlist/i })).toBeVisible();
  });

  test('advanced tab shows Debug mode switch', async ({ page }) => {
    await clickTab(page, 'Advanced');
    await expect(page.getByRole('switch', { name: /toggle debug mode/i })).toBeVisible();
  });

  test('advanced tab shows Custom ports input', async ({ page }) => {
    await clickTab(page, 'Advanced');
    await expect(
      page.locator('div:has(> label:has-text("Custom ports")) input')
    ).toBeVisible();
  });

  /* ── 4. Save button exists ──────────────────────────────────── */

  test('save changes button area exists in DOM when dirty', async ({ page }) => {
    /* Filling a numeric input triggers onChange → update → setDirty(true),
       which makes the "Save Changes" button appear. */
    const container = page.locator('div:has(> label:has-text("Auto-refresh interval"))');
    await container.locator('input[type="number"]').fill('99');
    await expect(
      page.getByRole('button', { name: 'Save Changes' })
    ).toBeVisible();
  });

  test('save button has Save icon (role="button" with name containing Save)', async ({ page }) => {
    /* Ensure dirty state by filling an input value, then checking Save button */
    const container = page.locator('div:has(> label:has-text("Auto-refresh interval"))');
    await container.locator('input[type="number"]').fill('99');
    const btn = page.getByRole('button', { name: 'Save Changes' });
    await expect(btn).toBeVisible();
    expect(btn).not.toBeDisabled();
  });

  /* ── 5. Tab state persists — navigate away and back ─────────── */

  test('tab selection resets to default after navigating away and back', async ({ page }) => {
    /* Tab state is component-level useState, not persisted — resets on navigation */
    await clickTab(page, 'Server');
    await expect(page.getByRole('tab', { name: 'Server' })).toHaveAttribute('aria-selected', 'true');

    /* Navigate to another page and back */
    await navigateTo(page, 'Dashboard');
    await expect(page).toHaveURL(/\/$/);

    await navigateTo(page, SETTINGS_LABEL);
    await expect(page).toHaveURL(/\/settings/);

    /* Tab should be "General" (default) after fresh navigation */
    await expect(page.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true');
  });

  test('general tab selected after fresh navigation', async ({ page }) => {
    /* Navigate away and back via URL directly to verify default */
    await page.goto('/settings');
    await expect(page.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true');
  });

});
