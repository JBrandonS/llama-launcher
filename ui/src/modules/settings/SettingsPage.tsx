import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiService } from '@services/apiService';
import { Loader2, Globe, Palette, Server, Database, Shield, Settings as SettingsIcon, Save } from 'lucide-react';
import { cn } from '@utils/cn';

// ─── UI-only settings type (frontend preferences, not sent to backend) ──
interface UISettings {
  generalLanguage: string;
  generalTheme: string;
  generalRefreshInterval: number;
  generalDataRetention: number;
  generalAutoUpdate: boolean;
  appearanceTheme: string;
  appearanceCompactMode: boolean;
  serverMaxConcurrent: number;
  serverGpuSelection: string;
  serverMemoryLimit: number;
  apiBackendUrl: string;
  apiAuthMethod: string;
  securitySessionTimeout: number;
  securityIpAllowlist: boolean;
  advancedDebugMode: boolean;
  advancedCustomPorts: string;
  advancedNetworkBindings: string;
}

// ─── Tab definitions ──────────────────────────────────────────────
type TabKey = 'general' | 'appearance' | 'server' | 'api' | 'security' | 'advanced';

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'general', label: 'General', icon: Globe },
  { key: 'appearance', label: 'Appearance', icon: Palette },
  { key: 'server', label: 'Server', icon: Server },
  { key: 'api', label: 'API', icon: Database },
  { key: 'security', label: 'Security', icon: Shield },
  { key: 'advanced', label: 'Advanced', icon: SettingsIcon },
];

const DEFAULT_SETTINGS: UISettings = {
  generalLanguage: 'en',
  generalTheme: 'system',
  generalRefreshInterval: 30,
  generalDataRetention: 7,
  generalAutoUpdate: false,
  appearanceTheme: 'system',
  appearanceCompactMode: false,
  serverMaxConcurrent: 4,
  serverGpuSelection: '0',
  serverMemoryLimit: 0,
  apiBackendUrl: 'http://localhost:8501',
  apiAuthMethod: 'none',
  securitySessionTimeout: 30,
  securityIpAllowlist: true,
  advancedDebugMode: false,
  advancedCustomPorts: '',
  advancedNetworkBindings: '127.0.0.1',
};

// ─── Form field helpers ───────────────────────────────────────────
function Field({ label, desc, children }: {
  label: string; desc?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium leading-none text-foreground">{label}</label>
      {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring dark:bg-background dark:text-foreground"
    />
  );
}

function NumberInput({ value, onChange, min, max }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (min !== undefined && n < min) return;
        if (max !== undefined && n > max) return;
        onChange(n);
      }}
      className="h-9 w-28 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring dark:bg-background dark:text-foreground"
    />
  );
}

function SelectInput({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { label: string; value: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring dark:bg-background dark:text-foreground"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function Switch({ checked, onCheckedChange, label }: {
  checked: boolean; onCheckedChange: (v: boolean) => void; label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'peer inline-flex h-[20px] w-[36px] shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        checked ? 'bg-primary' : 'bg-input'
      )}
    >
      <span
        className={cn(
          'pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0'
        )}
      />
    </button>
  );
}

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <span className="text-sm text-muted-foreground">{label}</span>
        {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

// ─── General tab ──────────────────────────────────────────────────
function GeneralTab({ settings, onChange }: { settings: UISettings; onChange: (p: Partial<UISettings>) => void }) {
  const langs = [
    { label: 'English', value: 'en' },
    { label: 'Español', value: 'es' },
    { label: 'Français', value: 'fr' },
    { label: 'Deutsch', value: 'de' },
    { label: '日本語', value: 'ja' },
  ];
  const themes = [
    { label: 'Light', value: 'light' },
    { label: 'Dark', value: 'dark' },
    { label: 'System', value: 'system' },
  ];

  return (
    <div className="space-y-6">
      <Field label="Language" desc="Interface display language">
        <SelectInput value={settings.generalLanguage ?? 'en'} onChange={(v) => onChange({ generalLanguage: v })} options={langs} />
      </Field>

      <Field label="Theme" desc="Default theme for the application">
        <SelectInput value={settings.generalTheme ?? 'system'} onChange={(v) => onChange({ generalTheme: v })} options={themes} />
      </Field>

      <Field label="Auto-refresh interval" desc="How often to refresh server data (5-300 seconds)">
        <div className="flex items-center gap-2">
          <NumberInput
            value={settings.generalRefreshInterval ?? 30}
            onChange={(v) => onChange({ generalRefreshInterval: v })}
            min={5}
            max={300}
          />
          <span className="text-sm text-muted-foreground">seconds</span>
        </div>
      </Field>

      <Field label="Data retention (days)" desc="How long to keep historical data">
        <NumberInput
          value={settings.generalDataRetention ?? 7}
          onChange={(v) => onChange({ generalDataRetention: v })}
          min={1}
          max={365}
        />
      </Field>

      <Row label="Auto-update" desc="Automatically check for and apply updates">
        <Switch
          checked={settings.generalAutoUpdate ?? false}
          onCheckedChange={(v) => onChange({ generalAutoUpdate: v })}
          label="Toggle auto-update"
        />
      </Row>
    </div>
  );
}

// ─── Appearance tab ───────────────────────────────────────────────
function AppearanceTab({ settings, onChange }: { settings: UISettings; onChange: (p: Partial<UISettings>) => void }) {
  const themes = [
    { label: 'Light', value: 'light' },
    { label: 'Dark', value: 'dark' },
    { label: 'System', value: 'system' },
  ];

  return (
    <div className="space-y-6">
      <Field label="Color scheme" desc="Theme applied to the dashboard">
        <SelectInput value={settings.appearanceTheme ?? 'system'} onChange={(v) => onChange({ appearanceTheme: v })} options={themes} />
      </Field>

      <Row label="Compact mode" desc="Reduce spacing and padding across the UI">
        <Switch
          checked={settings.appearanceCompactMode ?? false}
          onCheckedChange={(v) => onChange({ appearanceCompactMode: v })}
          label="Toggle compact mode"
        />
      </Row>

      <div className="rounded-lg border p-4 space-y-3">
        <h4 className="text-sm font-medium">Badge preview</h4>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex rounded-full border border-border px-2.5 py-0.5 text-xs font-medium">Default</span>
          <span className="inline-flex rounded-full bg-emerald-500/15 text-emerald-500 px-2.5 py-0.5 text-xs font-medium">Success</span>
          <span className="inline-flex rounded-full bg-amber-500/15 text-amber-500 px-2.5 py-0.5 text-xs font-medium">Warning</span>
          <span className="inline-flex rounded-full bg-destructive/15 text-destructive px-2.5 py-0.5 text-xs font-medium">Error</span>
          <span className="inline-flex rounded-full bg-blue-500/15 text-blue-500 px-2.5 py-0.5 text-xs font-medium">Info</span>
        </div>
      </div>
    </div>
  );
}

// ─── Server tab ───────────────────────────────────────────────────
function ServerTab({ settings, onChange }: { settings: UISettings; onChange: (p: Partial<UISettings>) => void }) {
  const gpuOpts = Array.from({ length: 8 }, (_, i) => ({ label: `GPU ${i}`, value: String(i) }));

  return (
    <div className="space-y-6">
      <Field label="Max concurrent servers" desc="Maximum servers that can run at once">
        <NumberInput
          value={settings.serverMaxConcurrent ?? 4}
          onChange={(v) => onChange({ serverMaxConcurrent: v })}
          min={1}
          max={16}
        />
      </Field>

      <Field label="Default GPU" desc="GPU index used for new server launches">
        <SelectInput value={settings.serverGpuSelection ?? '0'} onChange={(v) => onChange({ serverGpuSelection: v })} options={gpuOpts} />
      </Field>

      <Field label="Memory limit (GB)" desc="Memory cap per server, 0 = unlimited">
        <NumberInput
          value={settings.serverMemoryLimit ?? 0}
          onChange={(v) => onChange({ serverMemoryLimit: v })}
          min={0}
          max={256}
        />
      </Field>
    </div>
  );
}

// ─── API tab ──────────────────────────────────────────────────────
function ApiTab({ settings, onChange }: { settings: UISettings; onChange: (p: Partial<UISettings>) => void }) {
  const authOpts = [
    { label: 'None', value: 'none' },
    { label: 'API Key', value: 'api_key' },
    { label: 'Bearer Token', value: 'bearer' },
  ];

  return (
    <div className="space-y-6">
      <Field label="Backend URL" desc="Base URL for the API server">
        <TextInput value={settings.apiBackendUrl ?? 'http://localhost:8501'} onChange={(v) => onChange({ apiBackendUrl: v })} placeholder="http://localhost:8501" />
      </Field>

      <Field label="Authentication method" desc="How requests are authenticated to the backend">
        <SelectInput
          value={settings.apiAuthMethod ?? 'none'}
          onChange={(v) => onChange({ apiAuthMethod: v })}
          options={authOpts}
        />
      </Field>
    </div>
  );
}

// ─── Security tab ─────────────────────────────────────────────────
function SecurityTab({ settings, onChange }: { settings: UISettings; onChange: (p: Partial<UISettings>) => void }) {
  return (
    <div className="space-y-6">
      <Field label="Session timeout (minutes)" desc="Auto-logout after inactivity">
        <NumberInput
          value={settings.securitySessionTimeout ?? 30}
          onChange={(v) => onChange({ securitySessionTimeout: v })}
          min={5}
          max={480}
        />
      </Field>

      <Row label="IP allowlist" desc="Restrict access to specific IP ranges">
        <Switch
          checked={settings.securityIpAllowlist ?? false}
          onCheckedChange={(v) => onChange({ securityIpAllowlist: v })}
          label="Toggle IP allowlist"
        />
      </Row>

      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
        <h4 className="text-sm font-medium text-destructive">Security warning</h4>
        <p className="text-xs text-destructive/80">
          <strong>This project is NOT secure.</strong> It was vibe-coded as a test using local LLMs (Qwen 3.6, OpenCode, oh-my-openagent).
          Only an absolute fool would consider this project secure in any way. Do not expose it to untrusted networks.
          IP allowlist and localhost-only bindings are recommended defaults.
        </p>
      </div>
    </div>
  );
}

// ─── Advanced tab ─────────────────────────────────────────────────
function AdvancedTab({ settings, onChange }: { settings: UISettings; onChange: (p: Partial<UISettings>) => void }) {
  return (
    <div className="space-y-6">
      <Row label="Debug mode" desc="Enable verbose logging and development tools">
        <Switch
          checked={settings.advancedDebugMode ?? false}
          onCheckedChange={(v) => onChange({ advancedDebugMode: v })}
          label="Toggle debug mode"
        />
      </Row>

      <Field label="Custom ports" desc="Comma-separated custom ports (e.g. 8080,8443)">
        <TextInput
          value={settings.advancedCustomPorts ?? ''}
          onChange={(v) => onChange({ advancedCustomPorts: v })}
          placeholder="8080,8443"
        />
      </Field>

      <Field label="Network bindings" desc="Interface to bind the API server to">
        <TextInput
          value={settings.advancedNetworkBindings ?? '127.0.0.1'}
          onChange={(v) => onChange({ advancedNetworkBindings: v })}
          placeholder="127.0.0.1"
        />
      </Field>

      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
        <h4 className="text-sm font-medium text-destructive">Danger zone</h4>
        <p className="text-xs text-muted-foreground">These actions cannot be undone.</p>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Reset all settings to defaults?')) {
              onChange(DEFAULT_SETTINGS);
              toast.success('Settings reset to defaults');
            }
          }}
          className="rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────
export function SettingsPage() {
  const [tab, setTab] = useState<TabKey>('general');
  const [local, setLocal] = useState<UISettings>(() => {
    const stored = localStorage.getItem('launcher:settings');
    if (stored) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      } catch { /* ignore */ }
    }
    return DEFAULT_SETTINGS;
  });
  const [dirty, setDirty] = useState(false);
  const qc = useQueryClient();

  const { data: apiSettings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await apiService.getSettings();
      return { ...DEFAULT_SETTINGS, ...res };
    },
    staleTime: 60_000,
  });

  // Sync API data when loaded
  useEffect(() => {
    if (apiSettings) {
      setLocal((prev) => {
        // Only update if different from localStorage to avoid flash
        const stored = localStorage.getItem('launcher:settings');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            return { ...DEFAULT_SETTINGS, ...parsed };
          } catch { /* ignore */ }
        }
        return prev;
      });
    }
  }, [apiSettings]);

  const update = useCallback((partial: Partial<UISettings>) => {
    setLocal((prev) => {
      const next = { ...prev, ...partial };
      setDirty(JSON.stringify(next) !== JSON.stringify(DEFAULT_SETTINGS));
      return next;
    });
  }, []);

  const saveMutation = useMutation({
    mutationFn: (_s: UISettings) => Promise.resolve(),
    onSuccess: async () => {
      localStorage.setItem('launcher:settings', JSON.stringify(local));
      await qc.invalidateQueries({ queryKey: ['settings'] });
      setDirty(false);
      toast.success('Settings saved successfully');
    },
  });

  const handleSave = useCallback(() => {
    saveMutation.mutate(local);
  }, [local, saveMutation]);

  const renderTab = () => {
    switch (tab) {
      case 'general': return <GeneralTab settings={local} onChange={update} />;
      case 'appearance': return <AppearanceTab settings={local} onChange={update} />;
      case 'server': return <ServerTab settings={local} onChange={update} />;
      case 'api': return <ApiTab settings={local} onChange={update} />;
      case 'security': return <SecurityTab settings={local} onChange={update} />;
      case 'advanced': return <AdvancedTab settings={local} onChange={update} />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">Configure application preferences and behavior</p>
        </div>
        {dirty && (
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </button>
        )}
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Tab navigation */}
        <nav className="flex flex-row gap-1 overflow-x-auto border-b lg:w-52 lg:flex-col lg:border-b-0 lg:border-r" role="tablist">
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(key)}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors lg:w-full',
                  active
                    ? 'bg-accent text-primary'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">{label}</span>
              </button>
            );
          })}
        </nav>

        {/* Tab content */}
        <div className="min-w-0 flex-1 rounded-lg border bg-card p-6 shadow-sm">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            renderTab()
          )}
        </div>
      </div>
    </div>
  );
}
