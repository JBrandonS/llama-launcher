# Plan: Add Models Section

## Problem
No dedicated section to list, search, and manage all known models and templates. Users must navigate to the launch page to see available models.

## Current State
- `ui/src/modules/launch/LaunchPage.tsx` — Model selection dropdown shows local models
- `backend/model_manager.py` — ModelManager with local scanning + HuggingFace downloads
- `backend/api_server.py` — `/models` endpoint returns `ModelInfo` list
- `ui/src/templates/llama-templates.json` — Template definitions with model references
- `ui/src/utils/templateLoader.ts` — Template matching logic
- `ui/src/services/types.ts` — `ModelInfo` type has `id`, `path`, `size_human`

## Implementation Plan

### 1. Create Models Page (`ui/src/modules/models/ModelsPage.tsx`)
New page with the following features:

**Header Section**
- Title: "Models"
- Search bar to filter models by name, path, or alias
- Sort dropdown: Sort by name, type, size, path, last used

**Model List**
- Table or card view of all known models
- Columns: Name, Type, Size, Path, Actions
- Type column: Local file, HuggingFace template, Custom
- Actions: Launch, Edit, Delete, Download (for HuggingFace models)

**Model Cards**
- Model name (from path or alias)
- Type badge (Local, HuggingFace, Template)
- Size (from file or HuggingFace API)
- Path (truncated with tooltip for full path)
- Quantization tag (Q4_K_M, Q8_0, etc.)
- Template association (if used in a template)
- Last used timestamp (if tracked)

### 2. Create Models List Component (`ui/src/modules/models/ModelsList.tsx`)
- Reusable component for displaying model list
- Supports table view and card view (toggle)
- Implements search filtering (client-side)
- Implements sorting (client-side)
- Pagination for large lists (50 models per page)

### 3. Create Model Card Component (`ui/src/modules/models/ModelCard.tsx`)
- Single model display component
- Shows: name, type, size, path, quantization, actions
- Click to navigate to launch page with model pre-selected
- Right-click menu: Launch, Edit, Delete, Copy Path

### 4. Create Model Edit Dialog (`ui/src/modules/models/ModelEditDialog.tsx`)
- Dialog for editing model properties
- Fields: Name, Path, Aliases (comma-separated), Template association
- For HuggingFace models: Model ID, Quantization selection
- Save/Cancel buttons
- Validation: Path exists, Model ID format valid

### 5. Create Model Delete Confirmation (`ui/src/modules/models/ModelDeleteDialog.tsx`)
- Confirmation dialog before deleting a model
- Shows model name and path
- Warning: "This will remove the model from the registry. The file will NOT be deleted from disk."
- Confirm/Cancel buttons

### 6. Backend: Model Registry API (`backend/api_server.py`)
- `GET /models` — List all models (already exists, enhance with additional fields)
- `POST /models` — Add a new model manually (path, name, aliases)
- `PUT /models/<id>` — Update model properties
- `DELETE /models/<id>` — Remove model from registry (not from disk)
- `GET /models/types` — List all model types for sorting/grouping

### 7. Backend: Model Registry Enhancement (`backend/model_manager.py`)
- Add `add_model()` method to manually register a model
- Add `update_model()` method to update model properties
- Add `remove_model()` method to remove from registry
- Add `get_models_by_type()` method for sorting/grouping
- Store model aliases in registry
- Track last used timestamp

### 8. Backend: Model Type Detection
- Detect model type from path:
  - Local file: `.gguf` extension, file exists on disk
  - HuggingFace: Contains `/` and ends with `:tag` pattern
  - Template: Reference in template definitions
- Group models by type in API response

### 9. Frontend: Model Types (`ui/src/services/types.ts`)
```typescript
interface ModelInfo {
  id: string;
  path: string;
  size_human: string;
  type: 'local' | 'huggingface' | 'template';
  aliases?: string[];
  quantization?: string;
  templateId?: string;
  lastUsed?: string;
  sizeBytes?: number;
}

interface ModelTypeGroup {
  type: string;
  models: ModelInfo[];
}
```

### 10. Add Route to App (`ui/src/app/App.tsx`)
Add new route:
```typescript
const ModelsPage = lazy(() => import('@modules/models/ModelsPage').then(m => ({ default: m.ModelsPage })));

// In Routes:
<Route path="/models" element={
  <ErrorBoundary><ModelsPage /></ErrorBoundary>
} />
```

### 11. Add Sidebar Navigation
Add "Models" link to Sidebar component:
- Icon: `Database` from lucide-react
- Label: "Models"
- Route: `/models`

### Files to Create
- `ui/src/modules/models/ModelsPage.tsx` — Main models page
- `ui/src/modules/models/ModelsList.tsx` — Models list component
- `ui/src/modules/models/ModelCard.tsx` — Single model card
- `ui/src/modules/models/ModelEditDialog.tsx` — Edit model dialog
- `ui/src/modules/models/ModelDeleteDialog.tsx` — Delete confirmation

### Files to Modify
- `backend/api_server.py` — Add model CRUD endpoints
- `backend/model_manager.py` — Add model registry methods
- `ui/src/app/App.tsx` — Add ModelsPage route
- `ui/src/services/types.ts` — Extend ModelInfo type
- `ui/src/services/apiService.ts` — Add model CRUD methods
- `ui/src/components/common/Sidebar.tsx` — Add Models navigation link
