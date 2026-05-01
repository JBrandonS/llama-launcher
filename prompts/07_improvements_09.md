# Plan: Quick Launcher for Pre-existing Config Files

## Problem
Users want to quickly launch servers from pre-existing configuration files without going through the full launch page form.

## Current State
- `ui/src/modules/launch/LaunchPage.tsx` — Full launch form with many fields
- `backend/api_server.py` — `/run` endpoint for launching servers
- `backend/process_manager.py` — ProcessManager.start_server() accepts config dict
- `backend/llama_runner.py` — LlamaRunner.generate_command() builds CLI from config
- No existing config file support in the app

## Implementation Plan

### 1. Config File Format
Support JSON config files with the following structure:

```json
{
  "name": "My Server Config",
  "model": "/path/to/model.gguf",
  "port": 12345,
  "args": {
    "gpu_layers": -1,
    "context_size": 8192,
    "threads": 0,
    "temp": 0.7,
    "top_k": 40,
    "top_p": 0.95,
    "n_predict": 512
  },
  "env": {
    "LLAMA_LOG_LEVEL": "info"
  }
}
```

### 2. Create Quick Launcher Page (`ui/src/modules/launch/QuickLauncherPage.tsx`)
New page (accessible at `/launch/quick` or as a separate route) with:

**File Upload Section**
- Drag-and-drop zone for config files
- "Browse" button to select config file
- Supported formats: `.json`, `.yaml`, `.yml`

**Config Preview**
- After loading a config file, show a preview:
  - Model name/path
  - Port
  - Key args (gpu_layers, threads, temp, context_size)
  - Validation status (green check or red X with errors)

**Launch Button**
- "Launch Server" button to start the server with the loaded config
- Shows loading state during launch
- Navigates to server detail page after successful launch

**Error Display**
- Show validation errors if config is invalid
- Highlight missing required fields (model, port)
- Show type errors (e.g., "port must be a number")

### 3. Backend: Config File Validation (`backend/api_server.py`)
- Add `POST /validate/config` endpoint to validate config files
- Accept JSON body with config
- Return validation result with errors
- Reuse existing validation logic from `/validate` endpoint

### 4. Backend: Quick Launch (`backend/api_server.py`)
- Add `POST /run/config` endpoint for quick launch
- Accept JSON body with config
- Validate config
- Start server with config
- Return server ID and status
- Reuse existing `start_server()` from ProcessManager

### 5. Frontend: Config Parser (`ui/src/utils/configParser.ts`)
New utility to parse and validate config files:

```typescript
interface ServerConfig {
  name?: string;
  model: string;
  port: number;
  args?: Record<string, unknown>;
  env?: Record<string, string>;
}

function parseConfig(content: string): { config: ServerConfig; errors: ValidationError[] } {
  // Parse JSON
  // Validate required fields
  // Validate field types
  // Return parsed config and errors
}

function parseYaml(content: string): { config: ServerConfig; errors: ValidationError[] } {
  // Parse YAML (use js-yaml library)
  // Validate required fields
  // Return parsed config and errors
}
```

### 6. Frontend: API Service (`ui/src/services/apiService.ts`)
Add new methods:

```typescript
async validateConfig(config: ServerConfig): Promise<ValidationResult>
async launchFromConfig(config: ServerConfig): Promise<LaunchResult>
```

### 7. Frontend: Config Import from Template (`ui/src/modules/launch/QuickLauncherPage.tsx`)
- After launching from config, offer to save as template
- "Save as Template" button in success toast
- Opens template creation dialog
- Pre-fills template name and args from config

### 8. Frontend: Recent Configs (`ui/src/modules/launch/QuickLauncherPage.tsx`)
- Store recently used config file paths in localStorage
- Show list of recent configs on page load
- Click to re-load and launch
- Clear recent configs option

### 9. Add Route to App (`ui/src/app/App.tsx`)
Add new route:
```typescript
const QuickLauncherPage = lazy(() => import('@modules/launch/QuickLauncherPage').then(m => ({ default: m.QuickLauncherPage })));

// In Routes:
<Route path="/launch/quick" element={
  <ErrorBoundary><QuickLauncherPage /></ErrorBoundary>
} />
```

### 10. Add Sidebar Navigation
Add "Quick Launch" link to Sidebar component:
- Icon: `Zap` from lucide-react
- Label: "Quick Launch"
- Route: `/launch/quick`

### Files to Create
- `ui/src/modules/launch/QuickLauncherPage.tsx` — Quick launcher page
- `ui/src/utils/configParser.ts` — Config file parser and validator

### Files to Modify
- `backend/api_server.py` — Add `/validate/config` and `/run/config` endpoints
- `ui/src/app/App.tsx` — Add QuickLauncherPage route
- `ui/src/services/apiService.ts` — Add config API methods
- `ui/src/services/types.ts` — Add ServerConfig type
- `ui/src/components/common/Sidebar.tsx` — Add Quick Launch navigation link
