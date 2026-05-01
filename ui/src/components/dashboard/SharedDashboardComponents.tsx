import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

export function SkeletonCard() {
  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm animate-pulse">
      <div className="h-4 w-20 bg-muted/40 rounded" />
      <div className="mt-2 h-8 w-24 bg-muted/50 rounded" />
      <div className="mt-1 h-3 w-28 bg-muted/30 rounded" />
    </div>
  );
}

type StatCardVariant = 'default' | 'success' | 'warning' | 'error';

const borderMap: Record<StatCardVariant, string> = {
  default: 'border-border',
  success: 'border-emerald-500/40',
  warning: 'border-amber-500/40',
  error: 'border-destructive/40',
};

const bgMap: Record<StatCardVariant, string> = {
  default: '',
  success: 'bg-emerald-500/5',
  warning: 'bg-amber-500/5',
  error: 'bg-destructive/5',
};

const iconColorMap: Record<StatCardVariant, string> = {
  default: 'text-muted-foreground/60',
  success: 'text-emerald-500',
  warning: 'text-amber-500',
  error: 'text-destructive',
};

export function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  variant = 'default',
  trend,
}: {
  title: string;
  value: string;
  sub?: string;
  icon?: React.ElementType;
  variant?: StatCardVariant;
  trend?: 'up' | 'down' | 'flat';
}) {
  return (
    <div className={`rounded-lg border bg-card p-5 shadow-sm transition-colors hover:bg-muted/20 ${borderMap[variant]} ${bgMap[variant]}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{title}</p>
        {Icon && (
          <Icon className={`h-4 w-4 ${iconColorMap[variant]}`} />
        )}
      </div>
      <p className={`mt-1 text-3xl font-bold ${
        variant === 'error' ? 'text-destructive'
          : variant === 'warning' ? 'text-amber-500'
            : variant === 'success' ? 'text-emerald-500'
              : ''
      }`}>{value}</p>
      {sub && (
        <div className="mt-1 flex items-center gap-1.5">
          {trend && (
            trend === 'up' ? <ArrowUp className="h-3 w-3 text-emerald-500" />
              : trend === 'down' ? <ArrowDown className="h-3 w-3 text-amber-500" />
                : <Minus className="h-3 w-3 text-muted-foreground/50" />
          )}
          <p className="text-xs text-muted-foreground">{sub}</p>
        </div>
      )}
    </div>
  );
}

export function Sparkline({
  data,
  width = 120,
  height = 32,
  color = '#3b82f6',
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (data.length < 2) {
    return <div className="w-[120px] h-8 bg-muted/20 rounded" />;
  }

  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#grad-${color.replace('#', '')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MetricRow({ label, value, pct, barColor = 'bg-blue-500' }: {
  label: string;
  value: string;
  pct: number;
  barColor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted/30">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}
