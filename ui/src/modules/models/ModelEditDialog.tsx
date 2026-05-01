import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil } from 'lucide-react';
import { cn } from '@utils/cn';
import { apiService } from '@services/apiService';
import { BaseDialog } from '@components/common/BaseDialog';
import type { ModelInfo } from '@services/types';

interface ModelEditDialogProps {
  model: ModelInfo;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ModelEditDialog({ model, open, onClose, onSuccess }: ModelEditDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(model.id);
  const [aliases, setAliases] = useState((model.aliases || []).join(', '));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const aliasList = aliases.split(',').map((a) => a.trim()).filter(Boolean);
      const ok = await apiService.updateModel(model.id, {
        name: name || undefined,
        aliases: aliasList.length > 0 ? aliasList : undefined,
      });
      if (ok) {
        queryClient.invalidateQueries({ queryKey: ['models/types'] });
        toast.success(`Model "${model.id}" updated`);
        onSuccess();
      } else {
        toast.error('Failed to update model');
      }
    } catch {
      toast.error('Failed to update model');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BaseDialog open={open} onClose={onClose} title="Edit Model">
      <div className="mb-4">
        <label className="mb-1.5 block text-sm font-medium">Model ID</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
        />
      </div>
      <div className="mb-5">
        <label className="mb-1.5 block text-sm font-medium">
          Aliases <span className="ml-2 text-xs text-muted-foreground">(comma-separated)</span>
        </label>
        <input
          type="text"
          value={aliases}
          onChange={(e) => setAliases(e.target.value)}
          placeholder="e.g., llama2, llm"
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent">
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
            saving || !name.trim() ? 'opacity-50 cursor-not-allowed' : ''
          )}
        >
          <Pencil className="h-3.5 w-3.5" />
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </BaseDialog>
  );
}
