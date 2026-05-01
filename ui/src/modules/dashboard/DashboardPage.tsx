import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@services/apiService';
import { Cpu, MemoryStick, HardDrive, TrendingUp, Server, Clock, Zap, Microchip, Thermometer, Power } from 'lucide-react';
import { SkeletonCard, StatCard, Sparkline, MetricRow, MultiResourceChart, HealthStatus, MetricCard, ProgressPct } from '@components/dashboard/SharedDashboardComponents';

export function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'servers' | 'health'>('overview');

  const { data: servers, isLoading: serversLoading } = useQuery({
    queryKey: ['servers'],
    queryFn: apiService.getServers,
    staleTime: 5_000,
    refetchInterval: 5_000,
  });

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['metrics'],
    queryFn: () => apiService.getMetrics(),
    staleTime: 5_000,
    refetchInterval: 5_000,
  });

  const { data: metricsHistory } = useQuery({
    queryKey: ['metrics-history'],
    queryFn: () => apiService.getMetricsHistory(undefined, 60),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const { data: gpuMetrics, isLoading: gpuLoading, error: gpuError } = useQuery({
    queryKey: ['gpu-metrics'],
    queryFn: apiService.getGpuMetrics,
    staleTime: 5_000,
    refetchInterval: 5_000,
  });

  const totalServers = servers?.length ?? 0;
  const runningServers = servers?.filter(s => s.status === 'running').length ?? 0;
  const startingServers = servers?.filter(s => s.status === 'starting').length ?? 0;
  const stoppedServers = totalServers - runningServers - startingServers;

  const totalCpu = metrics?.system?.cpuPercent ?? 0;
  const totalMem = metrics?.system?.memoryPercent ?? 0;
  const totalDisk = metrics?.system?.diskPercent ?? 0;

  // GPU metrics from /metrics/gpu endpoint
  const totalGpuUtil = metrics?.gpu?.utilization ?? 0;
  const gpuAvailable = gpuMetrics?.gpuAvailable ?? false;
  const gpuBackend = gpuMetrics?.backend ?? '';
  const gpuAgg = gpuMetrics?.aggregate;
  const aggGpuUtil = gpuAgg?.utilization ?? 0;
  const aggGpuMemUsed = gpuAgg?.memoryUsed ?? 0;
  const aggGpuMemTotal = gpuAgg?.memoryTotal ?? 0;
  const aggGpuMemPct = aggGpuMemTotal > 0 ? (aggGpuMemUsed / aggGpuMemTotal) * 100 : 0;
  const gpuName = gpuMetrics?.gpus?.[0]?.name ?? '';
  const gpuTemp = gpuAgg?.temperature ?? 0;
  const gpuPower = gpuMetrics?.gpus?.[0]?.powerUsage;

  const totalTokens = servers?.reduce(
    (sum, s) => sum + (s.tokenUsage?.totalTokens ?? 0),
    0,
  ) ?? 0;

  const cpuSparkline = metricsHistory
    ? metricsHistory.map(m => m.system?.cpuPercent ?? 0)
    : [];
  const memSparkline = metricsHistory
    ? metricsHistory.map(m => m.system?.memoryPercent ?? 0)
    : [];
  const gpuSparkline = metricsHistory
    ? metricsHistory.map(m => m.gpu?.utilization ?? 0)
    : [];

  const topServers = servers
    ?.filter(s => s.tokenUsage?.totalTokens)
    .sort((a, b) => (b.tokenUsage?.totalTokens ?? 0) - (a.tokenUsage?.totalTokens ?? 0))
    .slice(0, 5);

  const isLoading = serversLoading || metricsLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of all servers and system health
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border bg-muted/20 p-1">
          {(['overview', 'servers', 'health'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-card shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' && (
        <>
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Total Servers"
                value={String(totalServers)}
                sub={`Running: ${runningServers}`}
                icon={Server}
              />
              <StatCard
                title="Running"
                value={String(runningServers)}
                sub={startingServers > 0 ? `Starting: ${startingServers}` : `${stoppedServers} stopped`}
                icon={Zap}
                variant={runningServers > 0 ? 'success' : 'warning'}
              />
              <StatCard
                title="CPU Usage"
                value={`${totalCpu.toFixed(1)}%`}
                sub="System-wide"
                icon={Cpu}
                variant={totalCpu > 90 ? 'error' : totalCpu > 75 ? 'warning' : 'default'}
                trend={cpuSparkline.length > 0 && cpuSparkline[cpuSparkline.length - 1] > cpuSparkline[0] ? 'up' : 'flat'}
              />
              <StatCard
                title="Memory Usage"
                value={`${totalMem.toFixed(1)}%`}
                sub={`${metrics?.system?.memoryUsed ? `${(metrics.system.memoryUsed / 1_073_741_824).toFixed(1)}` : '-'} / ${metrics?.system?.memoryTotal ? `${(metrics.system.memoryTotal / 1_073_741_824).toFixed(1)}` : '-'} GB`}
                icon={MemoryStick}
                variant={totalMem > 90 ? 'error' : totalMem > 75 ? 'warning' : 'default'}
                trend={memSparkline.length > 0 && memSparkline[memSparkline.length - 1] > memSparkline[0] ? 'up' : 'flat'}
              />
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-4">
            {/* GPU Utilization Card */}
            <MetricCard title="GPU Utilization" icon={Microchip} loading={gpuLoading} error={!!gpuError} noData={!gpuAvailable}>
              <p className={`mt-1 text-3xl font-bold ${
                aggGpuUtil > 90 ? 'text-destructive'
                  : aggGpuUtil > 75 ? 'text-amber-500'
                    : aggGpuUtil > 0 ? 'text-violet-500'
                      : 'text-muted-foreground'
              }`}>{aggGpuUtil.toFixed(1)}%</p>
              <Sparkline data={gpuSparkline} color="#8b5cf6" />
              {gpuName && (
                <p className="mt-1 text-xs text-muted-foreground truncate">{gpuName}</p>
              )}
            </MetricCard>

            {/* GPU Memory Card */}
            <MetricCard title="GPU Memory" icon={Microchip} loading={gpuLoading} error={!!gpuError} noData={!gpuAvailable}>
              <p className={`mt-1 text-3xl font-bold ${
                aggGpuMemPct > 90 ? 'text-destructive'
                  : aggGpuMemPct > 75 ? 'text-amber-500'
                    : 'text-violet-500'
              }`}>{aggGpuMemPct.toFixed(0)}%</p>
              <ProgressPct pct={aggGpuMemPct} color={aggGpuMemPct > 90 ? 'bg-destructive' : aggGpuMemPct > 75 ? 'bg-amber-500' : 'bg-violet-500'} />
              <p className="mt-1 text-xs text-muted-foreground">
                {((aggGpuMemUsed / 1_073_741_824)).toFixed(1)} / {((aggGpuMemTotal / 1_073_741_824)).toFixed(1)} GB
              </p>
            </MetricCard>
            <div className="rounded-lg border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Disk Usage</p>
                <HardDrive className="h-4 w-4 text-muted-foreground/60" />
              </div>
              <p className="mt-1 text-3xl font-bold">{totalDisk.toFixed(1)}%</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {metrics?.system?.diskUsed !== undefined && metrics.system.diskTotal
                  ? `${(metrics.system.diskUsed / 1_073_741_824 / 1_073_741_824).toFixed(1)} / ${(metrics.system.diskTotal / 1_073_741_824 / 1_073_741_824).toFixed(1)} TB`
                  : 'No data'}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Total Tokens</p>
                <TrendingUp className="h-4 w-4 text-muted-foreground/60" />
              </div>
              <p className="mt-1 text-3xl font-bold">{totalTokens.toLocaleString()}</p>
              <div className="mt-1 flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-muted-foreground/50" />
                <p className="text-xs text-muted-foreground">Across all servers</p>
              </div>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border bg-card p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-medium">Resource Usage</h3>
              <MetricRow label="CPU" value={`${totalCpu.toFixed(1)}%`} pct={totalCpu} barColor="bg-blue-500" />
              <MetricRow label="Memory" value={`${totalMem.toFixed(1)}%`} pct={totalMem} barColor="bg-emerald-500" />
              <MetricRow label="Disk" value={`${totalDisk.toFixed(1)}%`} pct={totalDisk} barColor="bg-amber-500" />
              <MetricRow label="GPU Util" value={`${aggGpuUtil.toFixed(1)}%`} pct={gpuAvailable ? aggGpuUtil : totalGpuUtil} barColor="bg-violet-500" />
            </div>

            {/* GPU Detail Card */}
            <div className="rounded-lg border bg-card p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-medium">GPU Details</h3>
              {gpuLoading ? (
                <div className="space-y-3">
                  <div className="h-4 bg-muted/30 rounded animate-pulse" />
                  <div className="h-4 bg-muted/30 rounded animate-pulse" />
                </div>
              ) : gpuError ? (
                <p className="text-sm text-destructive">Failed to load GPU metrics</p>
              ) : !gpuAvailable ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">No GPU detected</p>
                  <p className="text-xs text-muted-foreground">
                    Install pynvml (NVIDIA), pyamdgpuinfo (AMD), or pylevelzero (Intel) for GPU metrics
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {gpuName && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">GPU</span>
                      <span className="font-medium truncate ml-2">{gpuName}</span>
                    </div>
                  )}
                  {gpuBackend && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Backend</span>
                      <span className="font-mono text-xs text-muted-foreground">{gpuBackend}</span>
                    </div>
                  )}
                  {gpuTemp > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Thermometer className="h-3 w-3" /> Temperature
                      </span>
                      <span className={`font-mono ${
                        gpuTemp > 85 ? 'text-destructive'
                          : gpuTemp > 70 ? 'text-amber-500'
                            : 'text-emerald-500'
                      }`}>{gpuTemp}°C</span>
                    </div>
                  )}
                  {gpuPower !== undefined && gpuPower > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Power className="h-3 w-3" /> Power Draw
                      </span>
                      <span className="font-mono">{gpuPower.toFixed(1)} W</span>
                    </div>
                  )}
                  {gpuMetrics?.gpus && gpuMetrics.gpus.length > 1 && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground mb-1">{gpuMetrics.gpus.length} GPUs detected</p>
                      <div className="space-y-1">
                        {gpuMetrics.gpus.map((g) => (
                          <div key={g.index} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground truncate mr-2">GPU {g.index}: {g.name}</span>
                            <span className="font-mono">{g.utilization}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="rounded-lg border bg-card p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-medium">Resource History (60 samples)</h3>
              <MultiResourceChart
                cpuData={metricsHistory ? metricsHistory.map(m => ({ timestamp: m.timestamp, value: m.system?.cpuPercent ?? 0 })) : []}
                memData={metricsHistory ? metricsHistory.map(m => ({ timestamp: m.timestamp, value: m.system?.memoryPercent ?? 0 })) : []}
                gpuData={metricsHistory ? metricsHistory.map(m => ({ timestamp: m.timestamp, value: m.gpu?.utilization ?? 0 })) : []}
              />
            </div>
          </div>
        </>
      )}

      {activeTab === 'servers' && (
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="p-5">
            <h3 className="text-sm font-medium">Top Servers by Token Usage</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {totalTokens.toLocaleString()} total tokens across {totalServers} servers
            </p>
          </div>
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="p-5 space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-10 bg-muted/30 rounded animate-pulse" />
                ))}
              </div>
            ) : topServers && topServers.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t border-b bg-muted/20">
                    <th className="text-left px-5 py-2.5 font-medium text-muted-foreground">Server</th>
                    <th className="text-left px-5 py-2.5 font-medium text-muted-foreground">Status</th>
                    <th className="text-right px-5 py-2.5 font-medium text-muted-foreground">Tokens</th>
                    <th className="text-right px-5 py-2.5 font-medium text-muted-foreground">Prompt</th>
                    <th className="text-right px-5 py-2.5 font-medium text-muted-foreground">Completion</th>
                    <th className="text-right px-5 py-2.5 font-medium text-muted-foreground">Toke/s</th>
                  </tr>
                </thead>
                <tbody>
                  {topServers.map(s => (
                    <tr key={s.id} className="border-b last:border-b-0 hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3 font-medium">
                        {s.name || s.id}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          s.status === 'running' ? 'bg-emerald-500/15 text-emerald-500'
                            : s.status === 'starting' ? 'bg-blue-500/15 text-blue-500'
                              : s.status === 'stopping' ? 'bg-amber-500/15 text-amber-500'
                                : 'bg-muted text-muted-foreground'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-mono">
                        {(s.tokenUsage?.totalTokens ?? 0).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right text-muted-foreground font-mono text-xs">
                        {(s.tokenUsage?.promptTokens ?? 0).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right text-muted-foreground font-mono text-xs">
                        {(s.tokenUsage?.completionTokens ?? 0).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-xs text-muted-foreground">
                        {s.tokenUsage?.timePerToken
                          ? `${(s.tokenUsage.timePerToken).toFixed(1)}`
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="p-5 text-sm text-muted-foreground">No server data available</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'health' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-medium">System Health</h3>

            {isLoading ? (
              <div className="space-y-3">
                <div className="h-4 bg-muted/30 rounded animate-pulse" />
                <div className="h-4 bg-muted/30 rounded animate-pulse" />
                <div className="h-4 bg-muted/30 rounded animate-pulse" />
              </div>
            ) : metrics ? (
              <>
                <MetricRow
                  label="CPU"
                  value={`${metrics.system?.cpuPercent?.toFixed(1) ?? 'N/A'}%`}
                  pct={metrics.system?.cpuPercent ?? 0}
                  barColor="bg-blue-500"
                />
                <MetricRow
                  label="Memory"
                  value={`${metrics.system?.memoryPercent?.toFixed(1) ?? 'N/A'}%`}
                  pct={metrics.system?.memoryPercent ?? 0}
                  barColor="bg-emerald-500"
                />
                <MetricRow
                  label="Disk"
                  value={`${metrics.system?.diskPercent?.toFixed(1) ?? 'N/A'}%`}
                  pct={metrics.system?.diskPercent ?? 0}
                  barColor="bg-amber-500"
                />
                <MetricRow
                  label="GPU"
                  value={`${metrics.gpu?.utilization?.toFixed(1) ?? 'N/A'}%`}
                  pct={metrics.gpu?.utilization ?? 0}
                  barColor="bg-violet-500"
                />

                <div className="pt-2">
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">GPU Memory</h4>
                  {metrics.gpu && metrics.gpu.memoryTotal ? (
                    <MetricRow
                      label="VRAM"
                      value={`${((metrics.gpu.memoryUsed ?? 0) / 1_073_741_824).toFixed(2)} / ${(metrics.gpu.memoryTotal / 1_073_741_824).toFixed(2)} GB`}
                      pct={((metrics.gpu.memoryUsed ?? 0) / metrics.gpu.memoryTotal) * 100}
                      barColor="bg-violet-500"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">No GPU data</p>
                  )}
                </div>

                <div className="pt-2">
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">Load Average</h4>
                  {metrics.system?.loadAverage ? (
                    <p className="text-sm font-mono">
                      1m: {metrics.system.loadAverage[0].toFixed(2)} · 5m: {metrics.system.loadAverage[1].toFixed(2)} · 15m: {metrics.system.loadAverage[2].toFixed(2)}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No data</p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No metrics available</p>
            )}
           </div>
           <div className="rounded-lg border bg-card p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-medium">Health Alerts</h3>
            {metrics ? (
              <HealthStatus metrics={metrics} />
            ) : (
              <p className="text-sm text-muted-foreground">Loading...</p>
            )}
              <div className="pt-4 border-t">
              <h4 className="text-xs font-medium text-muted-foreground mb-2">Server Status</h4>
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="h-4 bg-muted/30 rounded animate-pulse" />
                  ))}
                </div>
              ) : servers && servers.length > 0 ? (
                <div className="space-y-1.5">
                  {servers.map(s => (
                    <div key={s.id} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{s.name || s.id}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.status === 'running' ? 'bg-emerald-500/15 text-emerald-500'
                          : s.status === 'starting' ? 'bg-blue-500/15 text-blue-500'
                            : s.status === 'stopping' ? 'bg-amber-500/15 text-amber-500'
                              : 'bg-muted text-muted-foreground'
                      }`}>
                        {s.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No servers configured</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
