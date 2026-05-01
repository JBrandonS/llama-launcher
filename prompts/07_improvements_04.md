# Plan: Fix View Icon and Stop Server Functionality

## Problem
View icon and stop server functionality are broken in the server list and server detail pages.

## Current State
- `ui/src/modules/servers/ServersPage.tsx` — Server list with sorting, search, pagination, stop action
- `ui/src/modules/servers/ServerDetailPage.tsx` — Server detail view with status, GPU metrics, memory, uptime, stop/refresh buttons
- `backend/api_server.py` — `/servers/<id>/stop` endpoint
- `backend/process_manager.py` — `stop_server()` method, PID tracking in `~/.llama_launcher/pids/`

## Root Cause Analysis
Likely issues:
1. **View icon**: The view action navigates to `/servers/:serverId` but the route may not match or the icon button may not have an `onClick` handler
2. **Stop server**: The stop action may fail because:
   - PID file not found in `~/.llama_launcher/pids/`
   - Process not detected by psutil
   - API endpoint returns error not handled in frontend
   - `stop_server()` in `process_manager.py` doesn't properly terminate the process
3. **Server list stop**: May call wrong endpoint or not invalidate queries after stopping

## Implementation Plan

### 1. Backend: Robust Server Stop (`backend/process_manager.py`)
- Ensure `stop_server(server_id)` handles missing PID files gracefully
- Add fallback: if PID file missing, search for process by command-line arguments
- Use psutil to find process matching the llama-server command for the given server
- Send SIGTERM first, then SIGKILL after timeout (graceful shutdown)
- Return proper status in response (success/error with message)
- Clean up PID file after successful stop
- Add logging for stop operations

### 2. Backend: Server Stop API (`backend/api_server.py`)
- Ensure `POST /servers/<id>/stop` endpoint:
  - Validates server ID exists
  - Calls `process_manager.stop_server(server_id)`
  - Returns proper JSON response with status
  - Handles exceptions (server not found, stop failed)
- Add `GET /servers/<id>/status` endpoint for quick status check
- Ensure response format matches frontend expectations

### 3. Frontend: Server List Stop (`ui/src/modules/servers/ServersPage.tsx`)
- Verify stop button has correct `onClick` handler
- Call `apiService.stopServer(server.id)`
- Invalidate `['servers']` query after stop (re-fetch server list)
- Show toast notification on success/failure
- Disable stop button while action in progress
- Handle case where server is already stopped/stopping

### 4. Frontend: Server Detail Stop (`ui/src/modules/servers/ServerDetailPage.tsx`)
- Verify stop button has correct `onClick` handler
- Call `apiService.stopServer(serverId)`
- Show confirmation dialog before stopping
- Update server status after stop (poll or refetch)
- Show toast notification on success/failure
- Navigate back to server list after stop

### 5. Frontend: View Icon (`ui/src/modules/servers/ServersPage.tsx`)
- Verify view icon button navigates to `/servers/:serverId`
- Use `useNavigate()` hook from react-router-dom
- Ensure route `/servers/:serverId` exists in `App.tsx`
- Add proper styling for view icon (cursor pointer, hover state)

### 6. PID Management (`backend/process_manager.py`)
- Ensure PID files are written correctly when server starts
- PID file format: `~/.llama_launcher/pids/<server_id>.pid` containing just the PID number
- On startup, check PID files and update server status
- Handle stale PID files (process no longer running)

### Files to Modify
- `backend/process_manager.py` — Robust stop_server with fallback process detection
- `backend/api_server.py` — Server stop API endpoint with proper error handling
- `ui/src/modules/servers/ServersPage.tsx` — Fix stop and view actions
- `ui/src/modules/servers/ServerDetailPage.tsx` — Fix stop action with confirmation
- `ui/src/services/apiService.ts` — Verify stopServer method
