# llama-launcher Improvement Plans — Master Index

## Overview
Individual improvement plan files reference specific code locations and current implementation details. Follow these improvement plans one at a time starting with 02. When all tasks for one are done, mark the task finished and move to the next file. This will be a large task so be breif and consise. Do not load in full files and use LSPs to read code. Focus on keeping context as short as possible.

## Plan Files

| # | File | Improvement | Priority |
|---|------|-------------|----------|
| 1 | `07_improvements_02.md` | Model alias support + HuggingFace quantization detection | High |
| 2 | `07_improvements_03.md` | Fix dashboard GPU metrics | High |
| 3 | `07_improvements_04.md` | Fix view icon and stop server functionality | High |
| 4 | `07_improvements_05.md` | Fix logs section attaching/capturing output | High |
| 5 | `07_improvements_06.md` | Add all llama-server CLI options to launch page | Medium |
| 6 | `07_improvements_07.md` | Don't emit default CLI arguments | Medium |
| 7 | `07_improvements_08.md` | Add models section | Medium |
| 8 | `07_improvements_09.md` | Quick launcher for pre-existing config files | Low |

## Key Code Locations (Quick Reference)

### Frontend
- `ui/src/modules/launch/LaunchPage.tsx` — Launch page (model selection, port, templates, parameter form)
- `ui/src/modules/dashboard/DashboardPage.tsx` — System/GPU metrics (broken GPU metrics)
- `ui/src/modules/servers/ServersPage.tsx` — Server list
- `ui/src/modules/servers/ServerDetailPage.tsx` — Server detail view (view/stop, metrics)
- `ui/src/modules/logs/LogsPage.tsx` — Log viewer with WebSocket streaming
- `ui/src/modules/daemon/DaemonPage.tsx` — Daemon control UI
- `ui/src/templates/llama-templates.json` — Template definitions (4 templates)
- `ui/src/utils/templateLoader.ts` — Template matching logic
- `ui/src/services/apiService.ts` — API client
- `ui/src/services/types.ts` — TypeScript types

### Backend
- `backend/api_server.py` — REST API server (all endpoints)
- `backend/process_manager.py` — Server lifecycle, PID tracking, command building
- `backend/model_manager.py` — Model scanning, registry, HuggingFace downloads
- `backend/llama_runner.py` — CLI arg generation, n_predict clamping
- `backend/daemon.py` — Systemd service management
