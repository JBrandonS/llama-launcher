import { AlertTriangle, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { SystemMetrics } from '@services/types';

export interface RechartsChartProps {
  data: Record<string, any>[];
  height?: number;
  yDomain?: [number, number];
  children?: React.ReactNode;
}

/**
 * Shared Recharts chart wrapper with standard XAxis (timestamp),
 * YAxis (percentage), Tooltip, and CartesianGrid config.
 */
export function RechartsChart({ data, height = 200, yDomain = [0, 100], children }: RechartsChartProps) {
  if (data.length < 2) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
        Insufficient data for chart
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.15)" />
        <XAxis
          dataKey="timestamp"
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          tickFormatter={(val) => {
            try {
              const d = new Date(Number(val) * 1000);
              return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } catch {
              return val;
            }
          }}
        />
        <YAxis
          domain={yDomain}
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          tickFormatter={(val) => `${val}%`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card) / 0.95)',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          labelFormatter={(val) => {
            try {
              const d = new Date(Number(val) * 1000);
              return d.toLocaleString();
            } catch {
              return val;
            }
          }}
        />
        {children}
      </LineChart>
    </ResponsiveContainer>
  );
}

/**
 * MultiResource chart with configurable Line series.
 * Data must be pre-merged by timestamp (use mergeDataByTimestamp).
 */
export function MultiLineChart({
  data,
  series,
}: {
  data: { timestamp: string }[];
  series: { dataKey: string; name: string; stroke: string }[];
}) {
  return (
    <RechartsChart data={data} height={256}>
      <Legend />
      {series.map((s) => (
        <Line
          key={s.dataKey}
          type="monotone"
          dataKey={s.dataKey}
          name={s.name}
          stroke={s.stroke}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 5, strokeWidth: 0 }}
        />
      ))}
    </RechartsChart>
  );
}

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
      <ProgressPct pct={pct} color={barColor} />
    </div>
  );
}

export function ProgressRow({ label, value, pct, color = 'bg-blue-500', unit }: {
  label: string;
  value: string | number;
  pct: number;
  color?: string;
  unit?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {typeof value === 'number' ? value.toFixed(1) : value}
          {unit || ''}
          <span className="ml-1 text-muted-foreground/60 text-xs">
            ({Math.min(pct, 100).toFixed(0)}%)
          </span>
        </span>
      </div>
      <ProgressPct pct={pct} color={color} />
    </div>
  );
}

export function ProgressPct({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted/30">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

export function MultiResourceChart({
  cpuData,
  memData,
  gpuData,
}: {
  cpuData: { timestamp: string; value: number }[];
  memData: { timestamp: string; value: number }[];
  gpuData: { timestamp: string; value: number }[];
}) {
  const cpuMap = mergeDataByTimestamp(cpuData, 'cpu');
  const memMap = mergeDataByTimestamp(memData, 'mem');
  const gpuMap = mergeDataByTimestamp(gpuData, 'gpu');

  const allTimestamps = new Set([...cpuMap.keys(), ...memMap.keys(), ...gpuMap.keys()]);
  const timestampMap = new Map<string, { cpu?: number; mem?: number; gpu?: number }>();

  for (const ts of allTimestamps) {
    const entry: { cpu?: number; mem?: number; gpu?: number } = {};
    cpuMap.get(ts) && Object.assign(entry, cpuMap.get(ts));
    memMap.get(ts) && Object.assign(entry, memMap.get(ts));
    gpuMap.get(ts) && Object.assign(entry, gpuMap.get(ts));
    timestampMap.set(ts, entry);
  }

  const combined = Array.from(timestampMap.entries())
    .map(([ts, vals]) => ({ timestamp: ts, ...vals }))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return (
    <MultiLineChart
      data={combined}
      series={[
        { dataKey: 'cpu', name: 'CPU', stroke: '#3b82f6' },
        { dataKey: 'mem', name: 'Memory', stroke: '#10b981' },
        { dataKey: 'gpu', name: 'GPU', stroke: '#8b5cf6' },
      ]}
    />
  );
}

export function MetricCard({
  title,
  icon: Icon,
  children,
  loading,
  error,
  noData,
}: {
  title: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  loading?: boolean;
  error?: boolean;
  noData?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{title}</p>
        {Icon && (
          <Icon className="h-4 w-4 text-muted-foreground/60" />
        )}
      </div>
      {loading ? (
        <div className="mt-1 h-8 w-20 bg-muted/50 rounded animate-pulse" />
      ) : error ? (
        <p className="mt-1 text-sm text-destructive">Error</p>
      ) : noData ? (
        <p className="mt-1 text-sm text-muted-foreground">No GPU</p>
      ) : (
        children
      )}
    </div>
  );
}

export function SkeletonBlock({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-4 bg-muted/30 rounded animate-pulse" />
      ))}
    </div>
  );
}

export function mergeDataByTimestamp<T extends { timestamp: string; value: number }>(
  datasets: T[],
  key: 'cpu' | 'mem' | 'gpu',
): Map<string, { cpu?: number; mem?: number; gpu?: number }> {
  const map = new Map<string, { cpu?: number; mem?: number; gpu?: number }>();
  for (const d of datasets) {
    const existing = map.get(d.timestamp) || {};
    (existing as Record<string, number>)[key] = d.value;
    map.set(d.timestamp, existing);
  }
  return map;
}

export function HealthStatus({ metrics }: { metrics: SystemMetrics | null }) {
  if (!metrics) return null;

  const alerts: { type: 'ok' | 'warn' | 'error'; text: string }[] = [];

  if (metrics.system?.cpuPercent !== undefined && metrics.system.cpuPercent > 90) {
    alerts.push({ type: 'error', text: `High CPU: ${metrics.system.cpuPercent}%` });
  } else if (metrics.system?.cpuPercent !== undefined && metrics.system.cpuPercent > 75) {
    alerts.push({ type: 'warn', text: `CPU elevated: ${metrics.system.cpuPercent}%` });
  }

  if (metrics.system?.memoryPercent !== undefined && metrics.system.memoryPercent > 90) {
    alerts.push({ type: 'error', text: `High memory: ${metrics.system.memoryPercent}%` });
  }

  if (metrics.gpu?.memoryUsed !== undefined && metrics.gpu.memoryTotal !== undefined && metrics.gpu.memoryTotal > 0) {
    const gpuPct = (metrics.gpu.memoryUsed / metrics.gpu.memoryTotal) * 100;
    if (gpuPct > 90) {
      alerts.push({ type: 'error', text: `GPU memory critical: ${gpuPct.toFixed(0)}%` });
    } else if (gpuPct > 75) {
      alerts.push({ type: 'warn', text: `GPU memory high: ${gpuPct.toFixed(0)}%` });
    }
  }

  if (metrics.system?.loadAverage) {
    const [load1] = metrics.system.loadAverage;
    if (load1 > 4) {
      alerts.push({ type: 'warn', text: `High load average: ${load1.toFixed(2)}` });
    }
  }

  if (alerts.length === 0) {
    return <p className="text-sm text-emerald-500">All systems normal</p>;
  }

  return (
    <div className="space-y-1.5">
      {alerts.map((a, i) => (
        <div key={i} className={`flex items-center gap-1.5 text-sm ${
          a.type === 'error' ? 'text-destructive' : 'text-amber-500'
        }`}>
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>{a.text}</span>
        </div>
      ))}
    </div>
  );
}
