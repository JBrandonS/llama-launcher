import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@services/apiService';
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
import {
  Cpu,
  Database,
  HardDrive,
  MemoryStick,
  ArrowUp,
  ArrowDown,
  Minus,
  Timer,
} from 'lucide-react';

// ── Utility Components ────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm animate-pulse">
      <div className="h-4 w-20 bg-muted/40 rounded" />
      <div className="mt-2 h-8 w-24 bg-muted/50 rounded" />
      <div className="mt-1 h-3 w-28 bg-muted/30 rounded" />
    </div>
  );
}

function StatCard({
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
  variant?: 'default' | 'success' | 'warning' | 'error';
  trend?: 'up' | 'down' | 'flat';
}) {
  const borderMap = {
    default: 'border-border',
    success: 'border-emerald-500/40',
    warning: 'border-amber-500/40',
    error: 'border-destructive/40',
  };
  const bgMap = {
    default: '',
    success: 'bg-emerald-500/5',
    warning: 'bg-amber-500/5',
    error: 'bg-destructive/5',
  };
  const iconColorMap = {
    default: 'text-muted-foreground/60',
    success: 'text-emerald-500',
    warning: 'text-amber-500',
    error: 'text-destructive',
  };

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

function Sparkline({
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

function MetricBar({
  label,
  value,
  max,
  unit,
  color = 'bg-blue-500',
}: {
  label: string;
  value: number;
  max: number;
  unit?: string;
  color?: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {typeof value === 'number' ? value.toFixed(1) : value}
          {unit || ''}
          <span className="ml-1 text-muted-foreground/60 text-xs">
            ({pct.toFixed(0)}%)
          </span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted/30">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

function HistoryChart({
  data,
  dataKey,
  name,
  stroke,
  domain = [0, 100],
}: {
  data: Record<string, any>[];
  dataKey: string;
  name: string;
  stroke: string;
  domain?: [number, number];
}) {
  if (data.length < 2) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
        Insufficient data for chart
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
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
          domain={domain}
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
        <Legend />
        <Line
          type="monotone"
          dataKey={dataKey}
          name={name}
          stroke={stroke}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Metric History Type ──────────────────────────────────────────

type MetricHistoryPoint = {
  timestamp: string;
  cpu: number;
  memory: number;
  disk: number;
};

type MetricsHistory = MetricHistoryPoint[];

// ── Metric Panel ──────────────────────────────────────────────────

function MetricPanel({
  title,
  icon: Icon,
  current,
  history,
  color = '#3b82f6',
  unit = '%',
}: {
  title: string;
  icon: React.ElementType;
  current: number;
  history?: MetricsHistory;
  color?: string;
  unit?: string;
}) {
  const chartData = history
    ? history.map((h) => ({
        timestamp: h.timestamp,
        cpu: h.cpu,
        memory: h.memory,
        disk: h.disk,
      }))
    : [];

  const currentValue = typeof current === 'number' ? current : 0;
  const colorClass =
    currentValue > 80 ? 'text-red-400' : currentValue > 60 ? 'text-amber-400' : 'text-green-400';

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${
            currentValue > 80 ? 'bg-red-500/10' :
            currentValue > 60 ? 'bg-amber-500/10' : 'bg-green-500/10'
          }`}>
            <Icon className={`h-5 w-5 ${colorClass}`} />
          </div>
          <div>
            <h3 className="font-medium">{title}</h3>
            <p className="text-2xl font-bold text-foreground">{currentValue.toFixed(1)}{unit}</p>
          </div>
        </div>
        {history && history.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">24h</span>
            <Sparkline
              data={history.map((h) =>
                title.includes('CPU') ? h.cpu :
                title.includes('Memory') ? h.memory : h.disk
              )}
              color={color}
            />
          </div>
        )}
      </div>

      {history && history.length >= 2 ? (
        <HistoryChart
          data={chartData}
          dataKey={title.includes('CPU') ? 'cpu' : title.includes('Memory') ? 'memory' : 'disk'}
          name={`${title} (%)`}
          stroke={color}
          domain={[0, 100]}
        />
      ) : (
        <div className="h-48 flex items-center justify-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
          Waiting for historical data...
        </div>
      )}
    </div>
  );
}

// ── Metrics Page ──────────────────────────────────────────────────

export default function MetricsPage() {
  const [days, setDays] = useState(7);

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['metrics'],
    queryFn: () => apiService.getMetrics(),
    refetchInterval: 30_000,
    retry: 2,
  });

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['metrics-history', days],
    queryFn: () => apiService.getMetricsHistory(undefined, days),
    refetchInterval: 60_000,
    retry: 2,
  });

  const isLoading = metricsLoading || historyLoading;

  const historyPoints: MetricHistoryPoint[] | undefined = history
    ? history.map((m) => ({
        timestamp: m.timestamp,
        cpu: m.system?.cpuPercent ?? 0,
        memory: m.system?.memoryPercent ?? 0,
        disk: m.system?.diskPercent ?? 0,
      }))
    : undefined;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-7 w-32 bg-muted/40 rounded animate-pulse" />
          <div className="mt-1 h-4 w-64 bg-muted/30 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-xl border bg-card animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const sys = metrics?.system;
  const cpuUsage = sys?.cpuPercent ?? 0;
  const memUsed = sys?.memoryUsed ?? 0;
  const memTotal = sys?.memoryTotal ?? 1;
  const diskUsed = sys?.diskUsed ?? 0;
  const diskTotal = sys?.diskTotal ?? 1;

  const memPercent = (memUsed / memTotal) * 100;
  const diskPercent = (diskUsed / diskTotal) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System Metrics</h1>
          <p className="text-muted-foreground mt-1">
            Real-time CPU, memory, and disk utilization
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">History:</span>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value={1}>24 hours</option>
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="CPU Usage"
          value={`${cpuUsage.toFixed(1)}%`}
          sub={`${(cpuUsage / 100 * 8).toFixed(1)} cores`}
          icon={Cpu}
          variant={cpuUsage > 80 ? 'error' : cpuUsage > 60 ? 'warning' : 'default'}
        />
        <StatCard
          title="Memory"
          value={`${memPercent.toFixed(1)}%`}
          sub={`${(memUsed / 1024).toFixed(1)} / ${(memTotal / 1024).toFixed(1)} GB`}
          icon={MemoryStick}
          variant={memPercent > 80 ? 'error' : memPercent > 60 ? 'warning' : 'default'}
        />
        <StatCard
          title="Disk"
          value={`${diskPercent.toFixed(1)}%`}
          sub={`${(diskUsed / 1024).toFixed(1)} / ${(diskTotal / 1024).toFixed(1)} GB`}
          icon={HardDrive}
          variant={diskPercent > 80 ? 'error' : diskPercent > 60 ? 'warning' : 'default'}
        />
        <StatCard
          title="Uptime"
          value={'--'}
          sub="System running"
          icon={Timer}
          variant="success"
        />
      </div>

      {/* Detailed Bars */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <MetricPanel
          title="CPU Utilization"
          icon={Cpu}
          current={cpuUsage}
          history={historyPoints}
          color="#3b82f6"
        />
        <MetricPanel
          title="Memory Usage"
          icon={Database}
          current={memPercent}
          history={historyPoints}
          color="#8b5cf6"
        />
        <MetricPanel
          title="Disk Usage"
          icon={HardDrive}
          current={diskPercent}
          history={historyPoints}
          color="#f59e0b"
        />
      </div>

      {/* Raw Details */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h3 className="font-medium mb-4">Detailed Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Cpu className="h-4 w-4" /> CPU
            </h4>
            <MetricBar label="Usage" value={cpuUsage} max={100} unit="%" />
            <MetricBar label="Cores" value={8} max={16} unit="" />
            <MetricBar label="Load Avg" value={sys?.loadAverage?.[0] ?? 0} max={16} unit="" />
          </div>
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Database className="h-4 w-4" /> Memory
            </h4>
            <MetricBar
              label="Used"
              value={memUsed}
              max={memTotal}
              unit=" MB"
              color="bg-purple-500"
            />
            <MetricBar
              label="Total"
              value={memTotal}
              max={memTotal * 2}
              unit=" MB"
              color="bg-purple-300"
            />
            <MetricBar
              label="Swap"
              value={0}
              max={1}
              unit=" MB"
              color="bg-purple-400"
            />
          </div>
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <HardDrive className="h-4 w-4" /> Disk
            </h4>
            <MetricBar
              label="Used"
              value={diskUsed}
              max={diskTotal}
              unit=" MB"
              color="bg-amber-500"
            />
            <MetricBar
              label="Total"
              value={diskTotal}
              max={diskTotal * 2}
              unit=" MB"
              color="bg-amber-300"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
