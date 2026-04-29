# ui/ — Frontend Module Knowledge Base

**Parent:** ../AGENTS.md
**Commit:** d48f2b16d255bf57a6e760eac2cf101a351d2fa0
**Branch:** main

## MODULE SCOPE
React 18 + TypeScript frontend — Vite 6 build, React Router v6 lazy routes, React Query data layer, Tailwind CSS styling, Playwright E2E. Served by dev server on port 3000 with `/api` proxy to backend.

## MODULE STRUCTURE
```
ui/
├── index.html                    # Vite HTML entry point
├── package.json                  # Vite, React, React Query, Tailwind, Vitest, Playwright
├── vite.config.ts                # Vite 6 + 7 path aliases, dev proxy (3000 → backend:8290)
├── tsconfig.json                 # Strict TS: noUnusedLocals, noUnusedParameters
├── tsconfig.node.json            # Node-tooling TS config
├── vitest.config.ts              # Vitest: jsdom, globals=true
├── vitest.setup.ts               # Imports @testing-library/jest-dom
├── tailwind.config.js            # class-based dark mode, CSS variable tokens
├── postcss.config.js             # PostCSS (Tailwind + CSS plugins)
├── eslint.config.js              # ESLint 9 flat config, react-hooks plugin
├── .prettierrc                   # Prettier: semi, singleQuote=false, printWidth=100
├── .env / .env.example           # Environment variables
├── public/                       # Static assets
├── dist/                         # [BUILT OUTPUT — should be gitignored]
├── launcher.py                   # Desktop UI entry (pywebview + http.server threads)
└── src/
    ├── main.tsx                  # React root render
    ├── app/
    │   └── App.tsx               # Router shell, lazy routes, ErrorBoundary per route
    ├── modules/                  # 6 page components (lazy-loaded)
    ├── services/                 # API, WS, error clients + shared types
    ├── components/               # Shared UI: common, tables, forms, charts
    ├── state/                    # React Query cache setup
    ├── utils/
    │   └── cn.ts                 # clsx + tailwind-merge class merger
    ├── hooks/                    # Custom React hooks
    └── styles/
        └── globals.css           # Tailwind directives, CSS variable tokens
```

## KEY SYMBOLS
| Symbol | Type | File | Role |
|--------|------|------|------|
| `App` | function component | app/App.tsx | Router shell, lazy routes, ErrorBoundary per route |
| `main()` | function | launcher.py | Desktop UI entry (pywebview + dual http.server threads) |
| `apiService` | object | services/apiService.ts | REST API client (getServers, launchServer, stopServer, etc.) |
| `wsService` | object | services/wsService.ts | WebSocket with exponential backoff (subscribeToLogs, subscribeToMetrics) |
| `errorService` | object | services/errorService.ts | Error handling/reporting |
| `ServerInfo` | interface | services/types.ts | Server state type |
| `LogEntry` | interface | services/types.ts | Log entry type |
| `GPUInfo` | interface | services/types.ts | GPU metrics type |
| `cn()` | function | utils/cn.ts | clsx + tailwind-merge utility for conditional class names |
| `globals.css` | file | styles/globals.css | Tailwind directives, CSS custom properties for theming |

## PATH ALIASES
7 `@`-prefixed aliases in `vite.config.ts` + `tsconfig.json`:
- `@/*` → `src/*`
- `@components/*` → `src/components/*`
- `@modules/*` → `src/modules/*`
- `@services/*` → `src/services/*`
- `@state/*` → `src/state/*`
- `@utils/*` → `src/utils/*`
- `@hooks/*` → `src/hooks/*`
- `@styles/*` → `src/styles/*`

## DEV SERVER
- **Port:** 3000 (`vite.config.ts`)
- **API proxy:** `/api` → `http://127.0.0.1:8290` (backend api_server)
- **Build:** `tsc -b && vite build`

## CONVENTIONS
- **Data fetching:** React Query (`useQuery` + `useMutation`) — staleTime=60s, retry=2
- **WS reconnect:** exponential backoff, baseDelay=1s, maxRetries=10, cap=30s
- **Styling:** Tailwind CSS with `cn()` utility, class-based dark mode
- **Icons:** `lucide-react` only
- **No hardcoded colors:** Use Tailwind semantic tokens (primary, destructive, muted-foreground)
- **No `dangerouslySetInnerHTML`** with untrusted data — use `escapeHtml()` guard
- **No form libraries:** Native controlled inputs
- **Pagination:** Manual slice-based, 10 items per page
- **Responsive:** `sm:` breakpoint (640px)
- **Test framework:** Vitest (unit) + Playwright (E2E) — NOT jest

## ANTI-PATTERNS
- **`ui/dist/` committed to git** — build artifacts should be gitignored
- **No direct API calls** — always via `apiService` methods
- **No raw WebSocket usage** — always via `wsService` with exponential backoff
- **No hardcoded colors** — use Tailwind semantic tokens
- **No `dangerouslySetInnerHTML` with untrusted data** — `escapeHtml()` guard required
- **No form libraries** — controlled inputs with native onChange
- **No `react-hot-toast`** — project uses `sonner`
- **No direct `router.push`** — `window.location.href` used for server detail navigation

## DEPENDENCIES
| Dependency | Version | Usage |
|------------|---------|-------|
| `react` | 18 | All components |
| `react-dom` | 18 | DOM rendering |
| `react-router-dom` | 6 | Routing (lazy routes, ErrorBoundary) |
| `@tanstack/react-query` | — | Data fetching, mutations, cache |
| `@tanstack/react-query-devtools` | — | Dev tools |
| `vite` | 6 | Build tool, dev server |
| `@vitejs/plugin-react` | — | Fast Refresh |
| `tailwindcss` | — | CSS framework |
| `postcss` | — | CSS processing |
| `autoprefixer` | — | CSS vendor prefixes |
| `lucide-react` | — | Icons |
| `sonner` | — | Toast notifications |
| `recharts` | — | Charts (dashboard metrics) |
| `clsx` | — | Conditional class names |
| `tailwind-merge` | — | Class name conflict resolution |
| `@testing-library/react` | — | React component testing |
| `@testing-library/jest-dom` | — | Custom matchers |
| `vitest` | 2.1.0 | Unit test runner |
| `@playwright/test` | 1.49.0 | E2E testing |
| `jsdom` | — | DOM environment for Vitest |

## COMMANDS
```bash
# Dev server
cd ui && npm run dev

# Build
cd ui && npm run build

# Unit tests
cd ui && npm run test

# Test UI
cd ui && npm run test:ui

# E2E tests
cd ui && npm run test:e2e

# Type check
cd ui && npx tsc -b --noEmit
```
