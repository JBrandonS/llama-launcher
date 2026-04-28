import { NavLink } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@utils/cn';

export interface BreadcrumbItem {
  label: string;
  to: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav
      className={cn(
        'flex items-center gap-1.5 text-sm',
        className
      )}
      aria-label="Breadcrumb"
    >
      <NavLink
        to="/"
        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
      >
        <Home className="h-4 w-4" />
      </NavLink>
      {items.map((item) => (
        <div key={item.to} className="inline-flex items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          <NavLink
            to={item.to}
            className={({ isActive }) =>
              cn(
                'font-medium transition-colors',
                isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              )
            }
          >
            {item.label}
          </NavLink>
        </div>
      ))}
    </nav>
  );
}
