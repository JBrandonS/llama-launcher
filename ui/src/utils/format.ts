export function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h < 1) return `${m}m`;
  return `${h}h ${m}m`;
}

export function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    const base = d.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const ms = String(d.getMilliseconds()).padStart(3, '0');
    return `${base}.${ms}`;
  } catch {
    return ts;
  }
}

export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
