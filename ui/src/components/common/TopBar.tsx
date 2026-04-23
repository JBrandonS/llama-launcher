import { useNavigate } from 'react-router-dom';
import { Search, Moon, Sun } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

export function TopBar() {
  const navigate = useNavigate();
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  );

  const toggleDark = useCallback(() => {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle('dark', next);
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark') {
      document.documentElement.classList.add('dark');
    }
  }, []);

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-4">
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search servers..."
            className="h-8 w-64 rounded-md border bg-background pl-8 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                navigate(`/servers?q=${encodeURIComponent(e.currentTarget.value.trim())}`);
              }
            }}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={toggleDark}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
          aria-label="Toggle theme"
        >
          {dark ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>
      </div>
    </header>
  );
}
