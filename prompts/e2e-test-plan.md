# E2E Playwright Test Plan

> **Date:** 2026-04-30  
> **Status:** In Progress  
> **Approach:** Full E2E with real backend + real Vite UI

---

## Architecture Summary

| Component | Port | Details |
|-----------|------|---------|
| Vite dev server | 3000 | React SPA, proxy `/api` → `http://127.0.0.1:8290` |
| Python API server | 8501 | REST-only (no WS), `/servers`, `/models`, `/metrics`, `/settings`, `/logs`, `/daemon`, `/validate` |
| Frontend `apiService` | — | Fetches from `http://localhost:8501` directly (not via proxy) |

**Port mismatch:** Vite proxy targets 8290, but `apiService.ts` uses 8501 directly. Tests should connect to 8501 directly.

**WebSocket gap:** `wsService.ts` targets `ws://localhost:8501` but `api_server.py` has no WS implementation. WS-dependent assertions will be skipped.

---

## Task Breakdown

### Phase 1: Configuration
1. **Playwright config** (`ui/playwright.config.ts`) — baseURL, webServer fixture, timeout, retries
2. **Test fixtures/helpers** (`ui/tests/e2e/helpers.ts`) — port management, API client wrappers, utility functions

### Phase 2: Page Object Models (optional but recommended)
3. **DashboardPage** — stat cards, metric charts
4. **ServersPage** — server list, actions, filters
5. **LaunchPage** — form inputs, template selector, presets
6. **SettingsPage** — tab navigation, form fields, save
7. **BasePage** — sidebar, navigation, common assertions

### Phase 3: Test Specs
8. **`navigation.spec.ts`** — sidebar nav, route transitions, active states
9. **`dashboard.spec.ts`** — loading state, stat cards, server metrics
10. **`servers.spec.ts`** — server list rendering, status badges, launch/stop buttons
11. **`launch.spec.ts`** — model selection, parameter forms, template selector
12. **`settings.spec.ts`** — tab switching, field editing, save confirmation

### Phase 4: Validation
13. **Run full suite** — `npm run test:e2e`, verify all pass
14. **Fix any failures** — adjust selectors, waits, assertions

---

## Implementation Notes

### Playwright Config (`playwright.config.ts`)
- baseURL: Vite dev server (port 3000, dynamic)
- webServer: Start Vite dev server + Python API server (port 8501, dynamic)
- use: `{ baseURL, viewport: { width: 1280, height: 720 }, trace: 'on-first-retry' }`
- timeout: 30s for navigation, 10s for actions
- retries: 1 for flaky test resilience

### Page Object Strategy
- Use `@playwright/test` page objects for common interactions
- Sidebar links: `page.getByRole('link', { name })` (React Router NavLink)
- Buttons: `page.getByRole('button', { name })`
- Form inputs: `page.getByLabel` or `page.getByTestId`
- Tables: `page.locator('table')` with specific selectors
- Loading states: `page.waitForSelector('.skeleton', { state: 'detached' })`

### Test Isolation
- Each spec runs in isolated browser context
- Clean PID files before tests
- No shared mutable state between tests

### Skip Strategy
- Skip WS-dependent assertions (no WS impl in backend)
- Skip server launch tests without actual GGUF model
- Focus on UI rendering, navigation, form interactions, data display

---

## File Locations
```
ui/
├── playwright.config.ts           ← Phase 1
└── tests/
    └── e2e/
        ├── helpers.ts             ← Phase 1
        ├── navigation.spec.ts     ← Phase 3
        ├── dashboard.spec.ts      ← Phase 3
        ├── servers.spec.ts        ← Phase 3
        ├── launch.spec.ts         ← Phase 3
        └── settings.spec.ts       ← Phase 3
```

## Execution Strategy

| Phase | Files | Parallelizable? | Agent |
|-------|-------|-----------------|-------|
| Phase 1: Config + Helpers | 2 files | No (helpers depend on config design) | @fixer |
| Phase 3: Test Specs | 5 files | Yes (independent per page) | 3x @fixer (2 files each) |
| Phase 4: Validation | Run tests | N/A | Orchestrator |

**Execution plan:** Write Phase 1 first, then launch 3 parallel @fixer instances for Phase 3 spec files.
