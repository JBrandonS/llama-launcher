import type { ModelInfo } from '@services/types';
import { ModelCard } from './ModelCard';

interface ModelsListProps {
  models: ModelInfo[];
  onModelClick: (model: ModelInfo) => void;
  onEdit: (model: ModelInfo) => void;
  onDelete: (model: ModelInfo) => void;
}

export function ModelsList({ models, onModelClick, onEdit, onDelete }: ModelsListProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {models.map((model) => (
        <ModelCard
          key={model.id}
          model={model}
          onClick={() => onModelClick(model)}
          onEdit={() => onEdit(model)}
          onDelete={() => onDelete(model)}
        />
      ))}
    </div>
  );
}
