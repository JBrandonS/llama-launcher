# Plan: Fix Dashboard GPU Metrics

## Problem
Dashboard GPU metrics are not working correctly. The system metrics display shows incomplete or missing GPU data.

## Current State
- `ui/src/modules/dashboard/DashboardPage.tsx` — Dashboard with GPU metrics display
- Uses `SystemMetrics` type with GPU-specific fields
- Backend provides `/metrics` endpoint for system metrics
- Backend provides `/metrics/gpu` endpoint (if llama.cpp server is running) for GPU-specific data
- Dashboard polls for metrics at intervals

## Root Cause Analysis
The dashboard likely has one or more of these issues:
1. `/metrics` endpoint returns data but frontend doesn't parse GPU fields correctly
2. `/metrics/gpu` endpoint not available when no llama.cpp server is running
3. psutil GPU detection fails on Linux (requires `pynvml` for NVIDIA or `pynvml`/`pyamdgpuinfo` for AMD)
4. WebSocket metrics from llama.cpp not properly connected
5. Error state not displayed when GPU metrics unavailable

## Implementation Plan

### 1. Backend: Robust GPU Metrics (`backend/api_server.py`)
- Ensure `/metrics` endpoint returns complete `SystemMetrics` object with all GPU fields
- Add fallback: when no GPU data available, return `{"gpu_available": false, "gpu": null}` instead of errors
- Use try/except around all GPU metric collection to prevent endpoint failures
- Add `GET /health` endpoint to check if GPU tools are available

### 2. Backend: GPU Detection (`backend/api_server.py` or new module)
- Gracefully handle missing GPU libraries (pynvml, pyamdgpuinfo, nvidia-ml-py)
- Detect available GPU backend at startup and log which one is active
- Fallback chain: NVIDIA (pynvml) → AMD (pyamdgpuinfo) → None
- When no GPU library available, return CPU-only metrics without errors

### 3. Frontend: Error Handling (`ui/src/modules/dashboard/DashboardPage.tsx`)
- Add "No GPU detected" state when `gpu_available` is false
- Add loading state during initial metrics fetch
- Add retry mechanism when metrics endpoint temporarily fails
- Display meaningful error message when metrics unavailable

### 4. Frontend: Metrics Parsing (`ui/src/modules/dashboard/DashboardPage.tsx`)
- Verify `SystemMetrics` type matches backend response structure
- Handle null/undefined GPU fields gracefully
- Add type guards for optional GPU data
- Ensure real-time WebSocket updates work for GPU metrics

### 5. Frontend: GPU Metrics Display (`ui/src/modules/dashboard/DashboardPage.tsx`)
- Show GPU name, memory used/total, memory %, utilization %
- Show temperature if available
- Show power draw if available
- Color-code memory usage (green < 70%, yellow < 90%, red >= 90%)
- Show utilization with sparkline or trend indicator

### Files to Modify
- `ui/src/modules/dashboard/DashboardPage.tsx` — Fix metrics fetching, display, error handling
- `ui/src/services/types.ts` — Verify `SystemMetrics` type has all GPU fields
- `ui/src/services/apiService.ts` — Ensure metrics endpoint calls handle errors
- `backend/api_server.py` — Add robust GPU metrics with fallbacks
