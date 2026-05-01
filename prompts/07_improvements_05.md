# Plan: Fix Logs Section Attaching/Capturing Output

## Problem
Logs section not attaching/capturing output from llama-server processes. The log viewer shows no data or incomplete logs.

## Current State
- `ui/src/modules/logs/LogsPage.tsx` — Log viewer with search, level filtering, pause/play, copy/download
- Uses WebSocket for real-time log streaming
- `backend/api_server.py` — `/logs` endpoint and WebSocket log endpoint
- `backend/process_manager.py` — Server process management, log file handling
- `backend/daemon.py` — Daemon with log output handling

## Root Cause Analysis
Likely issues:
1. **Log file not created**: llama-server stdout/stderr not redirected to log file
2. **Log file path mismatch**: Backend and frontend expect different log file paths
3. **WebSocket not connecting**: Log WebSocket endpoint not properly implemented
4. **Log parsing**: Log lines not parsed correctly (missing timestamps, wrong format)
5. **Log rotation**: Log files not rotated, causing performance issues
6. **Permission issues**: Backend cannot read log files
7. **Real-time streaming**: Log file tailing not implemented (reads static file, doesn't follow)

## Implementation Plan

### 1. Backend: Log File Creation (`backend/process_manager.py`)
- When starting llama-server, redirect stdout/stderr to log file
- Log file path: `~/.llama_launcher/logs/<server_id>.log`
- Create log directory if it doesn't exist
- Use Python's `subprocess.Popen` with `stdout=open(log_file, 'a')` and `stderr=subprocess.STDOUT`
- Ensure log file is writable by the backend process

### 2. Backend: Log API Endpoints (`backend/api_server.py`)
- Add `GET /logs/<server_id>` — Return last N lines of server log file
- Add `GET /logs/<server_id>/tail` — Stream new log lines (Server-Sent Events or WebSocket)
- Add `GET /logs/daemon` — Return daemon log lines
- Add `GET /logs/daemon/tail` — Stream daemon log lines
- Support query params: `lines=100`, `follow=true`, `filter=INFO|WARN|ERROR`

### 3. Backend: Log WebSocket (`backend/api_server.py`)
- Implement WebSocket endpoint at `ws://host/logs/<server_id>`
- Open log file and send new lines as they appear
- Handle client disconnect gracefully
- Support `since` parameter to resume from specific offset
- Send heartbeat/ping to keep connection alive

### 4. Backend: Log Parsing (`backend/api_server.py` or new module)
- Parse llama-server log format: `[timestamp] [level] message`
- Extract timestamp, level, and message from each line
- Handle multi-line log entries (stack traces, etc.)
- Normalize log levels (INFO, WARN, ERROR, DEBUG, TRACE)
- Handle missing timestamps (use file read time)

### 5. Frontend: Log Viewer Fix (`ui/src/modules/logs/LogsPage.tsx`)
- Connect to WebSocket for real-time log streaming
- Display logs with proper formatting (timestamp, level, message)
- Color-code log levels (ERROR=red, WARN=yellow, INFO=green, DEBUG=blue)
- Implement search/filter functionality
- Add pause/play for streaming
- Add copy/download functionality
- Handle WebSocket reconnection with exponential backoff
- Show connection status indicator

### 6. Frontend: Log Types (`ui/src/services/types.ts`)
```typescript
interface LogEntry {
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'TRACE';
  message: string;
  serverId?: string;
}

interface LogStreamState {
  connected: boolean;
  lines: LogEntry[];
  isFollowing: boolean;
  searchQuery: string;
  filterLevel: string | null;
}
```

### 7. Log Management
- Implement log rotation (max file size, max files)
- Clean up old logs (older than N days)
- Provide log download as `.log` file
- Provide log copy to clipboard

### Files to Modify
- `backend/process_manager.py` — Redirect llama-server output to log files
- `backend/api_server.py` — Log API endpoints, WebSocket, log parsing
- `ui/src/modules/logs/LogsPage.tsx` — Fix log viewer with WebSocket streaming
- `ui/src/services/types.ts` — Add LogEntry type
- `ui/src/services/apiService.ts` — Add log API methods, WebSocket connection
