import type { ModelInfo } from '@services/types';
import React from 'react';
import {
  Pencil,
  Trash2,
  HardDrive,
  Globe,
  Bookmark,
  File,
  Clock,
} from 'lucide-react';
import { cn } from '@utils/cn';

interface ModelCardProps {
  model: ModelInfo;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const typeIcons: Record<string, typeof File> = {
  local: HardDrive,
  huggingface: Globe,
  template: Bookmark,
};

const typeColors: Record<string, string> = {
  local: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  huggingface: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  template: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

export function ModelCard({ model, onClick, onEdit, onDelete }: ModelCardProps) {
  const typeIcon = typeIcons[model.type || 'local'] || File;
  const typeColor = typeColors[model.type || 'local'] || typeColors.local;

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
  };

  const formatDate = (iso?: string) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div
      className={cn(
        'group relative rounded-xl border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-lg',
        'cursor-pointer'
      )}
      onClick={onClick}
    >
      {/* Type badge */}
      <div className="mb-3 flex items-center justify-between">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize',
            typeColor
          )}
        >
          {React.createElement(typeIcon, { className: 'h-3 w-3' })}
          {model.type || 'local'}
        </span>
        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Edit model"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            title="Remove model"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Model name */}
      <h3 className="mb-1 truncate text-sm font-semibold" title={model.id}>
        {model.id}
      </h3>

      {/* Path */}
      <p
        className="mb-3 line-clamp-2 text-xs text-muted-foreground"
        title={model.path}
      >
        {model.path}
      </p>

      {/* Footer */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {model.size_bytes > 0 && (
          <span className="flex items-center gap-1">
            <HardDrive className="h-3 w-3" />
            {formatSize(model.size_bytes)}
          </span>
        )}
        {model.last_modified && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDate(model.last_modified)}
          </span>
        )}
        {(model.aliases?.length || 0) > 0 && (
          <span className="flex items-center gap-1">
            <Bookmark className="h-3 w-3" />
            {model.aliases!.length}
          </span>
        )}
      </div>
    </div>
  );
}
