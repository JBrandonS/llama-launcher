import { Moon, Sun, Monitor } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

export function TopBar() {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark' | 'system') || 'system';
  });

  const applyTheme = useCallback((t: 'light' | 'dark' | 'system') => {
    if (t === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', prefersDark);
    } else {
      document.documentElement.classList.toggle('dark', t === 'dark');
    }
    localStorage.setItem('theme', t);
    setTheme(t);
  }, []);

  useEffect(() => {
    const stored = (localStorage.getItem('theme') as 'light' | 'dark' | 'system') || 'system';
    applyTheme(stored);
  }, [applyTheme]);

  // Listen for theme changes from Settings page
  useEffect(() => {
    const handler = () => {
      const stored = (localStorage.getItem('theme') as 'light' | 'dark' | 'system') || 'system';
      setTheme(stored);
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const nextTheme = () => {
    const order: ('light' | 'dark' | 'system')[] = ['light', 'dark', 'system'];
    const idx = order.indexOf(theme);
    applyTheme(order[(idx + 1) % order.length]);
  };

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-4">
      <div />
      <button
        onClick={nextTheme}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
        aria-label="Toggle theme"
        title={`Theme: ${theme}`}
      >
        {theme === 'dark' ? (
          <Sun className="h-4 w-4" />
        ) : theme === 'light' ? (
          <Moon className="h-4 w-4" />
        ) : (
          <Monitor className="h-4 w-4" />
        )}
      </button>
    </header>
  );
}
