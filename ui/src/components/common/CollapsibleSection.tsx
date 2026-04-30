import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@utils/cn';

interface CollapsibleSectionProps {
  title: string;
  children: ReactNode;
  defaultCollapsed?: boolean;
}

export function CollapsibleSection({
  title,
  children,
  defaultCollapsed = false,
}: CollapsibleSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
      >
        <span className="text-sm font-medium text-foreground">{title}</span>
        {collapsed ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      <div
        className={cn(
          'overflow-hidden transition-[max-height] duration-200 ease-in-out',
          collapsed ? 'max-h-0' : 'max-h-[2000px]',
        )}
      >
        <div className="border-t border-border px-4 pt-3">{children}</div>
      </div>
    </div>
  );
}
