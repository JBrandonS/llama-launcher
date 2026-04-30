import { test, expect } from '@playwright/test';
import { navigateTo, assertPath } from './helpers';

const sidebarLabels = ['Launch', 'Dashboard', 'Servers', 'Daemon', 'Logs', 'Settings'];

test.describe('Navigation', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    // Wait for sidebar links to be reachable
    await page.waitForSelector('nav a', { timeout: 10_000 });
  });

  /* ── 1. Sidebar renders all navigation links ──────────────────── */

  test('sidebar renders all 6 navigation links', async ({ page }) => {
    const links = page.getByRole('link');
    for (const label of sidebarLabels) {
      await expect(page.getByRole('link', { name: label })).toBeVisible();
    }
    expect(await links.count()).toBeGreaterThanOrEqual(sidebarLabels.length);
  });

  /* ── 2. Navigation to each page updates URL ───────────────────── */

  test('clicking each sidebar link navigates to the correct route', async ({ page }) => {
    const routeMap: Record<string, string> = {
      Launch: '/launch',
      Dashboard: '/',
      Servers: '/servers',
      Daemon: '/daemon',
      Logs: '/logs',
      Settings: '/settings',
    };

    for (const label of sidebarLabels) {
      await navigateTo(page, label);
      await assertPath(page, routeMap[label]);
    }
  });

  /* ── 3. Active link highlighting ──────────────────────────────── */

  test('active NavLink has aria-current="page"', async ({ page }) => {
    for (const label of sidebarLabels) {
      await navigateTo(page, label);
      const activeLink = page.getByRole('link', { name: label }).last();
      await expect(activeLink).toHaveAttribute('aria-current', 'page');
    }
  });

  /* ── 4. Error boundary handles unknown routes ─────────────────── */

  test('unknown route shows ErrorBoundary / 404', async ({ page }) => {
    await page.goto('http://localhost:3000/nonexistent');
    await page.waitForSelector('h1', { timeout: 10_000 });
    await expect(page.getByRole('heading', { level: 1 })).toContainText('404');
    await expect(page.getByText('Page not found')).toBeVisible();
  });

  /* ── 5. Navigation persists across page loads ─────────────────── */

  test('navigated route persists after page reload', async ({ page }) => {
    // Navigate to Servers page
    await navigateTo(page, 'Servers');
    await assertPath(page, '/servers');

    // Reload the page
    await page.reload({ waitUntil: 'networkidle', timeout: 15_000 });

    // Verify the route is still /servers after reload
    await assertPath(page, '/servers');
    await expect(page.getByRole('link', { name: 'Servers' }).last()).toHaveAttribute('aria-current', 'page');
  });
});
