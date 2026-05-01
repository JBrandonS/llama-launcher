import { X, AlertTriangle } from 'lucide-react';
import type { ModelInfo } from '@services/types';

interface ModelDeleteDialogProps {
  model: ModelInfo;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ModelDeleteDialog({
  model,
  open,
  onClose,
  onConfirm,
}: ModelDeleteDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Dialog */}
      <div className="relative w-full max-w-sm rounded-xl border bg-card p-6 shadow-xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-destructive">
            Remove Model
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Warning */}
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-medium">This action cannot be undone.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              This will only remove the model from the launcher registry.
              The model file at{' '}
              <code className="rounded bg-destructive/10 px-1 py-0.5 text-xs">
                {model.path}
              </code>{' '}
              will not be deleted.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
