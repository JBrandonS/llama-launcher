import type { LucideIcon } from 'lucide-react';
import { Info, CheckCircle, AlertTriangle, AlertOctagon, Terminal } from 'lucide-react';
import type { LogEntry } from '@services/types';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL' | 'ALL';

export const LEVEL_CONFIG: Record<LogLevel, { icon: LucideIcon; color: string }> = {
  DEBUG: { icon: Info, color: 'text-muted-foreground' },
  INFO: { icon: CheckCircle, color: 'text-blue-500 dark:text-blue-400' },
  WARNING: { icon: AlertTriangle, color: 'text-amber-500 dark:text-amber-400' },
  ERROR: { icon: AlertOctagon, color: 'text-red-500 dark:text-red-400' },
  CRITICAL: { icon: AlertOctagon, color: 'text-red-600 dark:text-red-500' },
  ALL: { icon: Terminal, color: 'text-foreground' },
};

export function filterByLevel(entry: LogEntry, level: LogLevel): boolean {
  if (level !== 'ALL' && entry.level !== level) return false;
  return true;
}

export function filterBySearch(entry: LogEntry, search: string): boolean {
  if (!search) return true;
  const q = search.toLowerCase();
  return (
    entry.message.toLowerCase().includes(q) ||
    entry.component?.toLowerCase().includes(q) ||
    entry.level.toLowerCase().includes(q)
  );
}
