export function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of all servers and system health
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total Servers', value: '-', sub: 'Running: 0' },
          { label: 'Running', value: '-', sub: 'Stopping: 0' },
          { label: 'CPU Usage', value: '-', sub: 'Avg across servers' },
          { label: 'Memory Usage', value: '-', sub: 'Avg across servers' },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-lg border bg-card p-5 shadow-sm"
          >
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-3xl font-bold">{card.value}</p>
            <p className="text-xs text-muted-foreground">{card.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
