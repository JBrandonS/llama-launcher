import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@services/apiService';
import { Line } from 'recharts';
import {
  Cpu,
  Database,
  HardDrive,
  MemoryStick,
  Timer,
} from 'lucide-react';
import { SkeletonCard, StatCard, Sparkline, ProgressRow, RechartsChart } from '@components/dashboard/SharedDashboardComponents';

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
        <RechartsChart data={chartData}>
          <Line
            type="monotone"
            dataKey={title.includes('CPU') ? 'cpu' : title.includes('Memory') ? 'memory' : 'disk'}
            name={`${title} (%)`}
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </RechartsChart>
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
            <ProgressRow label="Usage" value={cpuUsage} pct={cpuUsage} unit="%" />
            <ProgressRow label="Cores" value={8} pct={8 / 16 * 100} unit="" />
            <ProgressRow label="Load Avg" value={sys?.loadAverage?.[0] ?? 0} pct={(sys?.loadAverage?.[0] ?? 0) / 16 * 100} unit="" />
          </div>
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Database className="h-4 w-4" /> Memory
            </h4>
            <ProgressRow
              label="Used"
              value={memUsed}
              pct={(memUsed / memTotal) * 100}
              unit=" MB"
              color="bg-purple-500"
            />
            <ProgressRow
              label="Total"
              value={memTotal}
              pct={memTotal > 0 ? (memTotal / (memTotal * 2)) * 100 : 0}
              unit=" MB"
              color="bg-purple-300"
            />
            <ProgressRow
              label="Swap"
              value={0}
              pct={0}
              unit=" MB"
              color="bg-purple-400"
            />
          </div>
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <HardDrive className="h-4 w-4" /> Disk
            </h4>
            <ProgressRow
              label="Used"
              value={diskUsed}
              pct={(diskUsed / diskTotal) * 100}
              unit=" MB"
              color="bg-amber-500"
            />
            <ProgressRow
              label="Total"
              value={diskTotal}
              pct={diskTotal > 0 ? (diskTotal / (diskTotal * 2)) * 100 : 0}
              unit=" MB"
              color="bg-amber-300"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
