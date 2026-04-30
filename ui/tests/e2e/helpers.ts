import { expect } from '@playwright/test';

type Page = import('@playwright/test').Page;

/* ── API client helpers (calls backend directly at 8501) ───────── */

/**
 * Fetch from the Python API server (bypasses Vite proxy, matches apiService.ts).
 */
export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  return fetch(`http://localhost:8501${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
}

/**
 * Wait for the API server to be reachable (used in CI or when webServer fixture isn't enough).
 */
export async function waitForApiServer(timeout = 10_000): Promise<void> {
  await fetch('http://localhost:8501/servers', { signal: AbortSignal.timeout(timeout) });
}

/* ── UI navigation helpers ─────────────────────────────────────── */

/**
 * Navigate via sidebar link by its visible text (React Router NavLink).
 */
export async function navigateTo(page: Page, label: string): Promise<void> {
  await page.getByRole('link', { name: label }).click();
  await page.waitForURL(/\/[^]*$/, { timeout: 10_000 });
}

/**
 * Assert the current URL path contains the expected segment.
 */
export async function assertPath(page: Page, expected: string): Promise<void> {
  const url = page.url();
  expect(url).toContain(expected);
}

/* ── Loading state helpers ─────────────────────────────────────── */

/**
 * Wait for skeleton loading placeholders to disappear (DashboardPage uses SkeletonCard).
 */
export async function waitForLoadingDone(page: Page, timeout = 10_000): Promise<void> {
  await page.waitForSelector('[data-testid="skeleton"], .skeleton', {
    state: 'detached',
    timeout,
  }).catch(() => {
    /* No skeleton found — already loaded */
  });
}

/**
 * Wait for React Query data to be fetched (checks for network idle via selector).
 */
export async function waitForDataReady(page: Page): Promise<void> {
  /* Wait for any table or stat card to appear */
  await Promise.race([
    page.waitForSelector('table, [class*="stat-card"], [class*="StatCard"]', { timeout: 10_000 }),
    page.waitForSelector('h1, h2', { timeout: 10_000 }),
  ]).catch(() => {
    /* Page loaded without table — that's fine */
  });
}

/* ── Form helpers ──────────────────────────────────────────────── */

/**
 * Type into a slider input (custom range input with aria-valuenow).
 */
export async function setSliderValue(page: Page, label: string, value: number): Promise<void> {
  const slider = page.getByLabel(label).locator('input[type="range"]')
    .or(page.getByLabel(label));
  await slider.evaluate((el, val) => {
    (el as HTMLInputElement).value = String(val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

/**
 * Type into a number input by label.
 */
export async function typeNumber(page: Page, label: string, value: string): Promise<void> {
  const input = page.getByLabel(label).locator('input[type="number"]')
    .or(page.getByLabel(label));
  await input.fill(value);
}

/**
 * Select an option from a native <select> by its visible text.
 */
export async function selectOption(page: Page, label: string, optionText: string): Promise<void> {
  await page.getByLabel(label).selectOption(optionText);
}

/**
 * Click a tab by its role (SettingsPage uses tablist/tab pattern).
 */
export async function clickTab(page: Page, tabLabel: string): Promise<void> {
  await page.getByRole('tab', { name: tabLabel }).click();
  await page.waitForTimeout(300); /* Let tab content render */
}

/* ── Assertion helpers ─────────────────────────────────────────── */

/**
 * Assert that a status badge exists with a specific text.
 * StatusBadge renders colored text in a span.
 */
export async function assertStatus(page: Page, status: string): Promise<void> {
  await expect(
    page.locator('[class*="StatusBadge"], [class*="status-badge"], [class*="statusBadge"]')
      .filter({ hasText: status })
  ).toBeVisible();
}

/**
 * Assert that a button with specific text is visible.
 */
export async function assertButtonVisible(page: Page, text: string): Promise<void> {
  await expect(page.getByRole('button', { name: text })).toBeVisible();
}

/**
 * Assert that a button with specific text is NOT visible.
 */
export async function assertButtonHidden(page: Page, text: string): Promise<void> {
  await expect(page.getByRole('button', { name: text })).toBeHidden();
}

/**
 * Assert that a table row exists containing specific text.
 */
export async function assertTableRowExists(page: Page, text: string): Promise<void> {
  await expect(
    page.locator('table').locator('tr').filter({ hasText: text }).first()
  ).toBeVisible();
}

/**
 * Assert that no server table rows exist (empty list).
 */
export async function assertNoRows(page: Page): Promise<void> {
  const rows = page.locator('table tbody tr').or(page.locator('[role="row"]'));
  expect(await rows.count()).toBe(0);
}

/* ── Reusable test fixtures ────────────────────────────────────── */

import { test as base } from '@playwright/test';

/* Extend base test with our helpers */
export const test = base;
export { expect };
