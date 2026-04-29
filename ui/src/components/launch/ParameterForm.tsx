import { useState, useCallback, useRef } from 'react';
import { cn } from '@utils/cn';

// ─── Types ────────────────────────────────────────────────────────

interface NumberInputProps {
  label: string;
  value: number | string;
  onChange: (value: number | string) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface SelectInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface SliderInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  placeholder?: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

// ─── Shared Form Field Wrapper ────────────────────────────────────

function FormField({
  label,
  error,
  hint,
  icon: Icon,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-sm font-medium">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        {label}
      </label>
      {children}
      {error && (
        <p className="flex items-center gap-1 text-sm text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </p>
      )}
      {!error && hint && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

const AlertCircle = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" x2="12" y1="8" y2="12" />
    <line x1="12" x2="12.01" y1="16" y2="16" />
  </svg>
);

// ─── Number Input ─────────────────────────────────────────────────

export function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  placeholder,
  hint,
  icon: Icon,
}: NumberInputProps) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (raw: string) => {
      setDebouncedValue(raw);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const num = parseFloat(raw);
        onChange(isNaN(num) ? raw : num);
      }, 200);
    },
    [onChange]
  );

  return (
    <FormField label={label} hint={hint} icon={Icon}>
      <input
        type="number"
        value={debouncedValue}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        className={cn(
          'w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none transition-colors',
          'focus:border-ring focus:ring-2 focus:ring-ring/20',
          min != null && max != null &&
            ((typeof debouncedValue === 'number' && (debouncedValue < min || debouncedValue > max)) ||
              (!isNaN(parseFloat(String(debouncedValue))) &&
                (parseFloat(String(debouncedValue)) < min ||
                  parseFloat(String(debouncedValue)) > max)))
            ? 'border-destructive'
            : ''
        )}
      />
    </FormField>
  );
}

// ─── Select Input ─────────────────────────────────────────────────

export function SelectInput({
  label,
  value,
  onChange,
  options,
  placeholder,
  hint,
  icon: Icon,
}: SelectInputProps) {
  return (
    <FormField label={label} hint={hint} icon={Icon}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
      >
        {placeholder && (
          <option value="">{placeholder}</option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </FormField>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────

export function Toggle({
  label,
  checked,
  onChange,
  hint,
  icon: Icon,
}: ToggleProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-sm font-medium">
          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
          {label}
        </label>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={cn(
            'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
            checked ? 'bg-primary' : 'bg-muted'
          )}
        >
          <span
            className={cn(
              'pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow-sm ring-0 transition-transform',
              checked ? 'translate-x-4' : 'translate-x-0'
            )}
          />
        </button>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ─── Slider Input ─────────────────────────────────────────────────

export function SliderInput({
  label,
  value,
  onChange,
  min,
  max,
  step,
  hint,
  icon: Icon,
}: SliderInputProps) {
  const displayValue = Number.isInteger(step) ? Math.round(value) : value.toFixed(step < 1 ? 2 : 1);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-sm font-medium">
          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
          {label}
        </label>
        <input
          type="number"
          value={displayValue}
          onChange={(e) => {
            const num = parseFloat(e.target.value);
            if (!isNaN(num)) {
              onChange(Math.min(max, Math.max(min, num)));
            }
          }}
          min={min}
          max={max}
          step={step}
          className={cn(
            'ml-2 w-16 rounded border bg-transparent px-2 py-0.5 text-right text-sm outline-none transition-colors',
            'focus:border-ring focus:ring-2 focus:ring-ring/20'
          )}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-primary"
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ─── Collapsible Section ──────────────────────────────────────────

export interface SectionDef {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function CollapsibleSection({
  section,
  children,
}: {
  section: SectionDef;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const Icon = section.icon;

  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-accent/50"
      >
        <div className="flex items-center gap-3">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <div>
            <h3 className="text-sm font-semibold">{section.title}</h3>
            <p className="text-xs text-muted-foreground">{section.description}</p>
          </div>
        </div>
        <svg
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform',
            open && 'rotate-180'
          )}
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <div
        className={cn(
          'overflow-hidden transition-all duration-200',
          open ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="border-t p-4 pt-5">{children}</div>
      </div>
    </div>
  );
}
