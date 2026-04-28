import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@utils/cn';
import {
  LayoutDashboard,
  Server,
  Activity,
  Terminal,
  Settings,
  Cpu,
  Rocket,
  Menu,
  X,
} from 'lucide-react';

const navItems = [
  { to: '/launch', label: 'Launch', icon: Rocket },
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/servers', label: 'Servers', icon: Server },
  { to: '/daemon', label: 'Daemon', icon: Activity },
  { to: '/logs', label: 'Logs', icon: Terminal },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  if (open && location.key) setOpen(false);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <button
        onClick={() => setOpen(true)}
        className="fixed left-2 top-2 z-50 flex h-8 w-8 items-center justify-center rounded-md border bg-card md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-4 w-4" />
      </button>

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-56 transform border-r bg-card transition-transform duration-200 md:relative md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-14 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            <span className="text-lg font-bold">Llama Launcher</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-md md:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 p-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={({ isActive: active }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    active || isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="border-t p-3 text-xs text-muted-foreground">
          v0.1.0
        </div>
      </aside>
    </>
  );
}
