import { Home } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="mt-2 text-muted-foreground">Page not found</p>
        <a
          href="/"
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
        >
          <Home className="h-4 w-4" />
          Back to Dashboard
        </a>
      </div>
    </div>
  );
}
