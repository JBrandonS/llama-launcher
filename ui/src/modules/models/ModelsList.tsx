import type { ModelInfo } from '@services/types';
import { ModelCard } from './ModelCard';
import type { ServerInfo } from '@services/types';

interface ModelsListProps {
  models: ModelInfo[];
  onModelClick: (model: ModelInfo) => void;
  onEdit: (model: ModelInfo) => void;
  onDelete: (model: ModelInfo) => void;
  runningModels?: Map<string, ServerInfo>;
}

export function ModelsList({ models, onModelClick, onEdit, onDelete, runningModels }: ModelsListProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {models.map((model) => (
        <ModelCard
          key={model.id}
          model={model}
          onClick={() => onModelClick(model)}
          onEdit={() => onEdit(model)}
          onDelete={() => onDelete(model)}
          runningServer={runningModels?.get(model.path)}
        />
      ))}
    </div>
  );
}
