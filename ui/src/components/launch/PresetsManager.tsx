import { useState, useEffect, useCallback } from 'react';
import { cn } from '@utils/cn';
import { Loader2, Check, Plus, Trash2, Save } from 'lucide-react';

interface PresetValue {
  gpu_layers?: number;
  context_size?: number;
  threads?: number;
  temp?: number;
  top_k?: number;
  top_p?: number;
  min_p?: number;
  typical_p?: number;
  penalty_range?: number;
  repeat_penalty?: number;
  repeat_last_n?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  mirostat?: number;
  mirostat_tau?: number;
  mirostat_eta?: number;
  seed?: number;
  n_predict?: number;
  num_keep?: number;
  rope_freq_scale?: number;
  logit_bias?: Record<string, number>;
  grammar_file?: string;
  batch_size?: number;
  cache_reuse?: number;
}

export interface Preset {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  values: PresetValue;
  isCustom?: boolean;
}

const BUILTIN_PRESETS: Preset[] = [
  {
    id: 'fast',
    name: 'Fast',
    description: 'Low latency, minimal context, greedy decoding',
    icon: (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>,
    values: {
      gpu_layers: -1,
      context_size: 2048,
      threads: 4,
      temp: 0.8,
      top_k: 10,
      top_p: 0.9,
      n_predict: 256,
    },
  },
  {
    id: 'balanced',
    name: 'Balanced',
    description: 'Default trade-off between speed and quality',
    icon: (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="16" /><line x1="8" x2="16" y1="12" y2="12" /></svg>,
    values: {
      gpu_layers: -1,
      context_size: 4096,
      threads: 4,
      temp: 0.7,
      top_k: 40,
      top_p: 0.95,
      min_p: 0.05,
      repeat_penalty: 1.1,
      n_predict: 512,
    },
  },
  {
    id: 'creative',
    name: 'Creative',
    description: 'Higher temperature, diverse outputs, longer context',
    icon: (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a7 7 0 0 1 7 7c0 3.5-2.5 6.5-5 9l-2 2-2-2c-2.5-2.5-5-5.5-5-9a7 7 0 0 1 7-7z" /><path d="M9 12l2 2 4-4" /></svg>,
    values: {
      gpu_layers: -1,
      context_size: 8192,
      threads: 8,
      temp: 0.9,
      top_k: 50,
      top_p: 0.98,
      min_p: 0.03,
      typical_p: 1.0,
      repeat_penalty: 1.05,
      presence_penalty: 0.3,
      frequency_penalty: 0.3,
      n_predict: 1024,
    },
  },
  {
    id: 'precise',
    name: 'Precise',
    description: 'Low temperature, deterministic, focused output',
    icon: (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>,
    values: {
      gpu_layers: -1,
      context_size: 4096,
      threads: 4,
      temp: 0.2,
      top_k: 10,
      top_p: 0.8,
      min_p: 0.1,
      repeat_penalty: 1.2,
      repeat_last_n: 64,
      presence_penalty: 0.5,
      frequency_penalty: 0.5,
      n_predict: 256,
    },
  },
  {
    id: 'max-context',
    name: 'Maximum Context',
    description: 'Maximum context window for long-document understanding',
    icon: (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>,
    values: {
      gpu_layers: -1,
      context_size: 32768,
      threads: 8,
      temp: 0.7,
      top_k: 40,
      top_p: 0.95,
      min_p: 0.05,
      repeat_penalty: 1.1,
      n_predict: 2048,
      cache_reuse: 512,
    },
  },
];

const CUSTOM_PRESETS_KEY = 'llama-launcher-custom-presets';

interface PresetsManagerProps {
  selectedPreset: string;
  onPresetChange: (id: string) => void;
  onApplyPreset: (preset: Preset) => void;
}

export function PresetsManager({
  selectedPreset,
  onPresetChange,
  onApplyPreset,
}: PresetsManagerProps) {
  const [customPresets, setCustomPresets] = useState<Preset[]>([]);
  const [saving, setSaving] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [customName, setCustomName] = useState('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CUSTOM_PRESETS_KEY);
      if (stored) {
        setCustomPresets(JSON.parse(stored));
      }
    } catch {
      setCustomPresets([]);
    }
  }, []);

  const allPresets = [...BUILTIN_PRESETS, ...customPresets];
  const activePreset = allPresets.find((p) => p.id === selectedPreset) ?? BUILTIN_PRESETS[1];

  const handleSaveCustom = useCallback(async () => {
    if (!customName.trim()) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 100));

    const newPreset: Preset = {
      id: `custom-${Date.now()}`,
      name: customName.trim(),
      description: 'User-defined preset',
      icon: (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>,
      values: activePreset?.values ?? {},
      isCustom: true,
    };

    const updated = [...customPresets, newPreset];
    setCustomPresets(updated);
    try {
      localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(updated));
    } catch {
      // localStorage quota exceeded
    }
    setCustomName('');
    setShowSaveDialog(false);
    setSaving(false);
  }, [customName, customPresets, activePreset]);

  const handleDeleteCustom = useCallback(
    (id: string) => {
      const updated = customPresets.filter((p) => p.id !== id);
      setCustomPresets(updated);
      try {
        localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(updated));
      } catch {
        // localStorage quota exceeded — preset lost on reload
      }
      if (selectedPreset === id) {
        onPresetChange('balanced');
        onApplyPreset(BUILTIN_PRESETS[1]);
      }
    },
    [customPresets, selectedPreset, onPresetChange, onApplyPreset]
  );

  const handleSelect = useCallback(
    (preset: Preset) => {
      onPresetChange(preset.id);
      onApplyPreset(preset);
    },
    [onPresetChange, onApplyPreset]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-sm font-medium">
          <svg
            className="h-3.5 w-3.5 text-muted-foreground"
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          Preset Template
        </label>
        {!showSaveDialog && (
          <button
            type="button"
            onClick={() => setShowSaveDialog(true)}
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Plus className="h-3 w-3" />
            Save Current
          </button>
        )}
      </div>

      {showSaveDialog && (
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="mb-2 text-sm font-medium">Save as Custom Preset</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Preset name..."
              className="flex-1 rounded-md border bg-transparent px-3 py-1.5 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveCustom();
                if (e.key === 'Escape') setShowSaveDialog(false);
              }}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowSaveDialog(false)}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveCustom}
              disabled={!customName.trim() || saving}
              className={cn(
                'inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground',
                !customName.trim() || saving ? 'cursor-not-allowed opacity-50' : 'hover:bg-primary/90'
              )}
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {allPresets.map((p) => {
          const Icon = p.icon;
          const isActive = selectedPreset === p.id;
          return (
            <div
              key={p.id}
              className={cn(
                'group relative rounded-lg border p-4 text-left transition-all',
                isActive
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border hover:border-accent hover:bg-accent/30'
              )}
            >
              <button
                type="button"
                onClick={() => handleSelect(p)}
                className="w-full"
              >
                <div className="flex items-center gap-2">
                  <Icon
                    className={cn(
                      'h-4 w-4 transition-colors',
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    )}
                  />
                  <span className="font-medium">{p.name}</span>
                  {isActive && <Check className="ml-auto h-4 w-4 text-primary" />}
                  {p.isCustom && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCustom(p.id);
                      }}
                      className="ml-auto hidden shrink-0 rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:block"
                      title="Delete custom preset"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.values.gpu_layers !== undefined && (
                    <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                      gpu={p.values.gpu_layers === -1 ? 'all' : p.values.gpu_layers}
                    </span>
                  )}
                  {p.values.context_size !== undefined && (
                    <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                      ctx={p.values.context_size}
                    </span>
                  )}
                  {p.values.threads !== undefined && (
                    <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                      thr={p.values.threads}
                    </span>
                  )}
                  {p.values.temp !== undefined && (
                    <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                      t={p.values.temp}
                    </span>
                  )}
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
