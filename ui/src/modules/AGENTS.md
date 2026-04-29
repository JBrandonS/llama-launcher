# ui/src/modules — Frontend Module Knowledge Base

**Parent:** ../../AGENTS.md
**Commit:** d48f2b16d255bf57a6e760eac2cf101a351d2fa0
**Branch:** main

## MODULE SCOPE
React frontend page components — 6 route-level pages (Dashboard, Servers, Server Detail, Settings, Daemon, Logs). Lazy-loaded via React Router v6. Uses React Query for data, sonner for toasts, Tailwind CSS for styling.

## MODULE STRUCTURE
```
ui/src/modules/
├── dashboard/
│   └── DashboardPage.tsx       # System overview cards (4 stat cards)
├── servers/
│   ├── ServersPage.tsx          # Server list table with search, sort, pagination
│   └── ServerDetailPage.tsx     # Per-server detail: GPU, tokens, launch config
├── settings/
│   └── SettingsPage.tsx         # Placeholder — coming soon (Section H)
├── daemon/
│   └── DaemonPage.tsx           # Auto-launch daemon control panel
├── logs/
│   └── LogsPage.tsx             # Log viewer with filtering, WebSocket tail, export
└── metrics/                     # Empty directory — placeholder
```

## KEY SYMBOLS
| Symbol | Type | File | Role |
|--------|------|------|------|
| `DashboardPage` | function component | dashboard/DashboardPage.tsx | Overview stat cards (total servers, running, CPU, memory) |
| `ServersPage` | function component | servers/ServersPage.tsx | Server list with search, sort, pagination (10/page) |
| `ServerRow` | function component | servers/ServersPage.tsx | Single server row with stop button, detail link |
| `StatusBadge` | function component | servers/ServersPage.tsx | Color-coded status: running/success, stopping/warning, starting/info, neutral |
| `formatUptime` | function | servers/ServersPage.tsx | Seconds → "Nh Nm" or "Nm" |
| `ServerDetailPage` | function component | servers/ServerDetailPage.tsx | Per-server detail: GPU stats, token usage, session info, launch config |
| `statusVariant` | function | servers/ServerDetailPage.tsx | Status string → badge variant mapping |
| `statusLabel` | function | servers/ServerDetailPage.tsx | Status string → display label mapping |
| `formatBytes` | function | servers/ServerDetailPage.tsx | Bytes → "X GB" / "X MB" |
| `formatNumber` | function | servers/ServerDetailPage.tsx | Number with decimal formatting |
| `SettingsPage` | function component | settings/SettingsPage.tsx | Placeholder — not implemented |
| `DaemonPage` | function component | daemon/DaemonPage.tsx | Auto-launch daemon control (start/stop/refresh) |
| `LogsPage` | function component | logs/LogsPage.tsx | Log viewer with level filter, server filter, search, WebSocket follow mode |
| `LEVEL_CONFIG` | constant | logs/LogsPage.tsx | Level→icon/color mapping (DEBUG/INFO/WARNING/ERROR/CRITICAL/ALL) |
| `formatTimestamp` | function | logs/LogsPage.tsx | ISO timestamp → "HH:MM:SS.mmm" |
| `escapeHtml` | function | logs/LogsPage.tsx | Sanitize log messages before rendering |
| `formatUptime` | function | daemon/DaemonPage.tsx | Seconds → "Nh Nm" or "Nm" |

## ROUTING
All pages lazy-loaded via React Router v6 in `ui/src/app/App.tsx`:
- `/` → DashboardPage
- `/servers` → ServersPage
- `/servers/:serverId` → ServerDetailPage
- `/daemon` → DaemonPage
- `/logs` → LogsPage
- `/settings` → SettingsPage

Each route wrapped in `<ErrorBoundary>` with loading spinner (`Loader2`).

## CONVENTIONS
- **Data fetching:** React Query (`useQuery` + `useMutation`) — staleTime=60s, retry=2
- **Refetch intervals:** Servers page polls every 5s, daemon every 15s, logs every 10s
- **WebSocket logs:** `wsService.subscribeToLogs(serverId, callback)` for real-time follow mode
- **Path aliases:** `@components`, `@services`, `@utils`, `@hooks`, `@styles`
- **Styling:** Tailwind CSS with `cn()` utility (clsx + tailwind-merge)
- **Icons:** `lucide-react` (Loader2, Play, Square, RefreshCw, etc.)
- **Dark mode:** class-based (`darkMode: 'class'` in Tailwind config)
- **Toast notifications:** `sonner` (not react-hot-toast)
- **Pagination:** Manual slice-based, 10 items per page, shown at bottom of table
- **State management:** React Query cache — `useQueryClient().invalidateQueries()` for optimistic updates
- **Error states:** Inline error display per component, global ErrorBoundary fallback
- **Responsive:** `sm:` breakpoint (640px) for card grids and flex layouts
- **Form elements:** sonner toasts for feedback, no form libraries used

## ANTI-PATTERNS
- **No `react-query` polling without cleanup** — refetchInterval auto-cleanup on unmount
- **No direct API calls** — always via `apiService` methods
- **No raw WebSocket usage** — always via `wsService` with exponential backoff
- **No hardcoded colors** — use Tailwind semantic tokens (primary, destructive, muted-foreground, etc.)
- **No `dangerouslySetInnerHTML` with untrusted data** — `escapeHtml()` used before rendering
- **No form libraries** — controlled inputs with native onChange
- **No `react-hot-toast`** — project uses `sonner`
- **No direct router.push** — `window.location.href` used for server detail navigation (URL navigation)

## DEPENDENCIES
| Dependency | Usage |
|------------|-------|
| `react` | All components |
| `@tanstack/react-query` | Data fetching, mutations, cache invalidation |
| `react-router-dom` | Routing (useParams, Link, lazy routes) |
| `lucide-react` | Icons (Loader2, Play, Square, RefreshCw, Search, etc.) |
| `sonner` | Toast notifications |
| `@/utils/cn` | clsx + twMerge utility |
| `@services/apiService` | REST API client |
| `@services/wsService` | WebSocket with exponential backoff |
| `@services/types` | TypeScript types (ServerInfo, LogEntry, GPUInfo, etc.) |

## PAGES SUMMARY
| Page | Key Features | Complexity |
|------|-------------|------------|
| Dashboard | 4 stat cards, no data fetching (placeholder values) | Low |
| Servers | Table, search, sort, pagination, stop server mutation, status badges | High |
| ServerDetail | GPU metrics, token usage, launch config JSON, restart/stop mutations | High |
| Settings | Placeholder only | Low |
| Daemon | Start/stop daemon, monitored servers list, config display, error list | Medium |
| Logs | Level/server filtering, WebSocket real-time tail, search, export, load-more | High |
