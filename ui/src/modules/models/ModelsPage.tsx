import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, Filter, Loader2, Database } from 'lucide-react';
import { cn } from '@utils/cn';
import { apiService } from '@services/apiService';
import type { ModelInfo, ModelTypeGroup } from '@services/types';
import { ModelsList } from './ModelsList';
import { ModelEditDialog } from './ModelEditDialog';
import { ModelDeleteDialog } from './ModelDeleteDialog';

type SortField = 'name' | 'size' | 'modified';
type SortDirection = 'asc' | 'desc';
type FilterType = 'all' | 'local' | 'huggingface' | 'template';

interface ModelWithSize extends ModelInfo {
  _sizeNum: number;
}

export function ModelsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [editingModel, setEditingModel] = useState<ModelInfo | null>(null);
  const [deletingModel, setDeletingModel] = useState<ModelInfo | null>(null);

  const { data: modelTypes, isLoading } = useQuery({
    queryKey: ['models/types'],
    queryFn: apiService.getModelTypes,
    staleTime: 30_000,
  });

  const allModels = useMemo(() => {
    if (!modelTypes) return [];
    return modelTypes.flatMap((g: ModelTypeGroup) =>
      g.models.map((m) => ({
        ...m,
        _sizeNum: m.size_bytes || 0,
      }))
    );
  }, [modelTypes]);

  const filteredAndSorted = useMemo(() => {
    let models = allModels;

    // Filter by type
    if (filterType !== 'all') {
      models = models.filter((m) => m.type === filterType);
    }

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase();
      models = models.filter(
        (m) =>
          m.id.toLowerCase().includes(q) ||
          m.path.toLowerCase().includes(q) ||
          (m.aliases || []).some((a) => a.toLowerCase().includes(q))
      );
    }

    // Sort
    models.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = a.id.localeCompare(b.id);
          break;
        case 'size':
          cmp = (a._sizeNum || 0) - (b._sizeNum || 0);
          break;
        case 'modified':
          cmp = (a.last_modified || '').localeCompare(b.last_modified || '');
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return models as ModelWithSize[];
  }, [allModels, filterType, search, sortField, sortDir]);

  const handleModelClick = (model: ModelInfo) => {
    navigate(`/launch?path=${encodeURIComponent(model.path)}`);
  };

  const handleDelete = async () => {
    if (!deletingModel) return;
    try {
      await apiService.deleteModel(deletingModel.id);
      toast.success(`Model "${deletingModel.id}" removed`);
      setDeletingModel(null);
    } catch {
      toast.error('Failed to remove model');
    }
  };

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allModels.length };
    allModels.forEach((m) => {
      const t = m.type || 'local';
      counts[t] = (counts[t] || 0) + 1;
    });
    return counts;
  }, [allModels]);

  const typeLabels: Record<string, string> = {
    all: 'All Models',
    local: 'Local Models',
    huggingface: 'Hugging Face',
    template: 'Templates',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Models</h1>
          <p className="text-sm text-muted-foreground">
            Browse and manage your model library
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Database className="h-4 w-4" />
          <span>{allModels.length} model{allModels.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search models..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
          />
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-1 rounded-lg border p-1">
          {(Object.keys(typeLabels) as FilterType[]).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                filterType === type
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {typeLabels[type]}
              {typeCounts[type] !== undefined && (
                <span className="ml-1 opacity-70">{typeCounts[type]}</span>
              )}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
            className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="name">Name</option>
            <option value="size">Size</option>
            <option value="modified">Modified</option>
          </select>
          <button
            onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
            className="rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors hover:bg-accent focus:border-primary"
            title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
          >
            {sortDir === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-card py-20">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading models...</p>
        </div>
      ) : filteredAndSorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-card py-20">
          <Database className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-lg font-medium">No models found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {search || filterType !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Add models by placing .gguf files in your model search paths'}
          </p>
        </div>
      ) : (
        <ModelsList
          models={filteredAndSorted}
          onModelClick={handleModelClick}
          onEdit={(m) => setEditingModel(m)}
          onDelete={(m) => setDeletingModel(m)}
        />
      )}

      {/* Edit Dialog */}
      {editingModel && (
        <ModelEditDialog
          model={editingModel}
          open={!!editingModel}
          onClose={() => setEditingModel(null)}
          onSuccess={() => {
            toast.success(`Model "${editingModel.id}" updated`);
            setEditingModel(null);
          }}
        />
      )}

      {/* Delete Dialog */}
      {deletingModel && (
        <ModelDeleteDialog
          model={deletingModel}
          open={!!deletingModel}
          onClose={() => setDeletingModel(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
