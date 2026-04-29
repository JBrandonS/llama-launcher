# Prompt: Redesign Model Selection on Launch Page

## Goal
Replace the manual "Model Name" and "Model Path" text inputs on the Launch Page with a model selection dropdown (showing detected GGUF models from the backend `/models` endpoint) and a file picker button (native file dialog for `.gguf` files). Remove the manual model path input entirely.

## Current State
- **File:** `ui/src/modules/launch/LaunchPage.tsx`
- **Current UX:** Two `NumberInput` fields — "Model Name" (HuggingFace ID) and "Model Path" (local GGUF path) at lines 357-370
- **State:** `modelName` (string, line 156) and `modelPath` (string, line 157)
- **Backend:** `GET /models` returns `[{id, path, size_bytes, size_human, last_modified, tags}]`
- **API Service:** `ui/src/services/apiService.ts` — no `getModels()` method yet
- **Types:** `ui/src/services/types.ts` — no Model type yet
- **Tests:** None exist for UI components

## Changes Required

### 1. Add Model type to `ui/src/services/types.ts`
Add a `ModelInfo` interface after the existing `ServerInfo` interface (around line 13), before the `// ─── Metrics Types` comment:

```typescript
// ─── Model Types ──────────────────────────────────────────────
export interface ModelInfo {
  id: string;
  path: string;
  size_bytes: number;
  size_human: string;
  last_modified: string;
  tags: string[];
}
```

### 2. Add `getModels()` to `ui/src/services/apiService.ts`
- Add `ModelInfo` to the import from `'./types'` (line 1-12)
- Add `getModels()` method after the existing server methods (after line 82, before the Metrics section):

```typescript
// ── Models ──────────────────────────────────────────────────
async getModels(): Promise<ModelInfo[]> {
  const res = await request('/models');
  return res.ok ? (res.data as ModelInfo[]) : [];
},
```

### 3. Redesign Launch Page (`ui/src/modules/launch/LaunchPage.tsx`)

#### 3.1. State Changes
- **Remove** `modelPath` state (line 157) — no longer needed
- **Rename** `modelName` → `selectedModelPath` (line 156) — now holds the selected model's file path
- **Add** `models` state: `useState<ModelInfo[]>([])` — from the API
- **Add** `modelDropdownOpen` state: `useState(false)` — for dropdown toggle
- **Add** `fileInputRef` using `useRef<HTMLInputElement>(null)` — for file picker

#### 3.2. Imports
Add to existing imports (line 1-18):
- Add `ChevronDown, FolderOpen` to lucide-react imports
- Add `ModelInfo` to types import
- Add `useQuery` to react-query imports (already imported at line 3)

#### 3.3. Data Fetching
Add a query to fetch models (after the settings query, around line 176):

```typescript
const { data: models = [] } = useQuery({
  queryKey: ['models'],
  queryFn: () => apiService.getModels(),
  staleTime: 60_000,
  retry: 2,
});
```

#### 3.4. Search Params Update
Update the search params effect (line 183-190) to only set `selectedModelPath` from the `path` param:

```typescript
useEffect(() => {
  const p = searchParams.get('path');
  if (p) setSelectedModelPath(p);
}, [searchParams]);
```

#### 3.5. Validation Update
Update `validateForm` call (line 277) to use `selectedModelPath` instead of both `modelName` and `modelPath`:

```typescript
const validationErrors = validateForm(form, selectedModelPath, '', port);
```

#### 3.6. Launch Config Update
Update the launch config (line 287-294) to use `selectedModelPath`:

```typescript
const config = {
  model: selectedModelPath,
  port: port || (settings?.apiPort ?? 8501),
  args: { ...form },
  env: {},
};
```

#### 3.7. UI Changes — Replace "Model & Port" Card (lines 354-389)
Replace the existing two `NumberInput` fields with a dropdown + file picker:

```tsx
<div className="space-y-4 rounded-lg border bg-card p-4 shadow-sm">
  <h2 className="text-sm font-semibold">Model & Port</h2>
  <div className="grid gap-4 sm:grid-cols-2">
    {/* Model Selector Row */}
    <div className="sm:col-span-2">
      <label className="block text-sm font-medium mb-1">Model</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <button
            type="button"
            onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
            className={cn(
              'w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none transition-colors',
              'focus:border-ring focus:ring-2 focus:ring-ring/20',
              'flex items-center justify-between text-left',
              !selectedModelPath && 'text-muted-foreground'
            )}
          >
            <span className="truncate">
              {selectedModelPath
                ? selectedModelPath.split('/').pop()
                : 'Select a model...'}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>

          {/* Dropdown */}
          {modelDropdownOpen && (
            <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-card shadow-lg">
              {models.length > 0 ? (
                models.map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => {
                      setSelectedModelPath(model.path);
                      setModelDropdownOpen(false);
                    }}
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors',
                      model.path === selectedModelPath && 'bg-accent'
                    )}
                  >
                    <div className="font-medium truncate">{model.path.split('/').pop()}</div>
                    <div className="text-xs text-muted-foreground truncate">{model.path}</div>
                    <div className="text-xs text-muted-foreground">{model.size_human}</div>
                  </button>
                ))
              ) : (
                <div className="p-3 text-sm text-muted-foreground">No local models found</div>
              )}
            </div>
          )}
        </div>

        {/* File Picker Button */}
        <input
          type="file"
          accept=".gguf"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && file.webkitRelativePath) {
              setSelectedModelPath(file.webkitRelativePath);
            } else if (file && file.path) {
              setSelectedModelPath(file.path);
            }
            e.target.value = ''; // Reset for re-selection
          }}
          className="hidden"
          ref={fileInputRef}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'rounded-md border bg-transparent px-3 py-2 text-sm outline-none transition-colors',
            'hover:bg-accent flex items-center gap-2'
          )}
          title="Select GGUF file from disk"
        >
          <FolderOpen className="h-4 w-4" />
          <span className="hidden sm:inline">Browse</span>
        </button>
      </div>
    </div>
  </div>

  {/* Port Input */}
  <div className="mt-2">
    <NumberInput
      label="Port"
      value={displayPort}
      onChange={(v) => {
        const num = parseInt(String(v), 10);
        setPort(isNaN(num) ? null : num);
      }}
      min={1024}
      max={65535}
      hint={
        existingPorts.has(displayPort)
          ? 'Port already in use by another server'
          : `API will listen on port ${displayPort}`
      }
    />
  </div>
</div>
```

#### 3.8. Click Outside Handler
Add a click-outside handler to close the dropdown (add after state declarations):

```typescript
useEffect(() => {
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('[data-model-dropdown]')) {
      setModelDropdownOpen(false);
    }
  }

  if (modelDropdownOpen) {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }
}, [modelDropdownOpen]);
```

Add `data-model-dropdown` attribute to the dropdown container wrapper.

### 4. Add UI Tests (`ui/src/modules/launch/LaunchPage.test.tsx`)
Create a test file to verify:
- Dropdown renders and shows models from the API
- Selecting a model updates the selected path
- File picker button triggers the file dialog
- Manually typed model name/path is no longer allowed
- Launch button is disabled when no model is selected

## Testing
- Run `npm test` to ensure the new tests pass.
- Run the application and verify the dropdown populates and allows file selection.

## Constraints
- Model path input should be completely removed.
- The existing dropdown for GPU layers and context size can remain as they are.
- File picker should accept `.gguf` files only.
- Follow existing codebase patterns: React Query for data fetching, sonner for toasts, Tailwind CSS for styling, `cn()` utility for class merging.
- Use `lucide-react` icons (ChevronDown, FolderOpen).
- No `as any` or `@ts-ignore` — use proper typing.

## Example Usage
1. User opens Launch Page.
2. Dropdown shows detected GGUF models from the backend.
3. User clicks dropdown to select a model.
4. User can also click the folder icon to manually select a GGUF file.
5. User clicks "Launch Server" and the server starts with the selected model.
