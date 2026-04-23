import { cn } from '@utils/cn';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' | 'neutral';
  className?: string;
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
        {
          default: 'bg-primary text-primary-foreground',
          secondary: 'bg-secondary text-secondary-foreground',
          destructive: 'bg-destructive text-destructive-foreground',
          outline: 'text-foreground border border-input',
          success: 'bg-emerald-500/15 text-emerald-500 dark:bg-emerald-500/20 dark:text-emerald-400',
          warning: 'bg-amber-500/15 text-amber-500 dark:bg-amber-500/20 dark:text-amber-400',
          info: 'bg-blue-500/15 text-blue-500 dark:bg-blue-500/20 dark:text-blue-400',
          neutral: 'bg-muted text-muted-foreground',
        }[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
