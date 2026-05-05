import { Suspense, lazy, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ErrorBoundary } from '@components/common/ErrorBoundary';
import { Sidebar } from '@components/common/Sidebar';
import { NotFoundPage } from '@components/common/NotFoundPage';

const DashboardPage = lazy(() => import('@modules/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })));
const ServersPage = lazy(() => import('@modules/servers/ServersPage').then(m => ({ default: m.ServersPage })));
const ServerDetailPage = lazy(() => import('@modules/servers/ServerDetailPage').then(m => ({ default: m.ServerDetailPage })));
const CreateServerPage = lazy(() => import('@modules/servers/CreateServerPage').then(m => ({ default: m.CreateServerPage })));
const DaemonPage = lazy(() => import('@modules/daemon/DaemonPage').then(m => ({ default: m.DaemonPage })));
const LogsPage = lazy(() => import('@modules/logs/LogsPage').then(m => ({ default: m.LogsPage })));
const SettingsPage = lazy(() => import('@modules/settings/SettingsPage').then(m => ({ default: m.SettingsPage })));
const LaunchPage = lazy(() => import('@modules/launch/LaunchPage').then(m => ({ default: m.LaunchPage })));
const ModelsPage = lazy(() => import('@modules/models/ModelsPage').then(m => ({ default: m.ModelsPage })));
const BenchmarkPage = lazy(() => import('@modules/benchmark/BenchmarkPage').then(m => ({ default: m.BenchmarkPage })));
const LoadPage = lazy(() => import('@modules/load/LoadPage').then(m => ({ default: m.LoadPage })));

const loading = (
  <div className="flex h-full items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('launcher:sidebar-collapsed') === 'true';
    } catch { return false; }
  });

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem('launcher:sidebar-collapsed', String(next)); } catch {}
      return next;
    });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      <div className="flex flex-1 flex-col overflow-hidden">
         <main className="flex flex-1 flex-col overflow-y-auto p-4 md:p-6">
          <Suspense fallback={loading}>
            <Routes>
              <Route index element={
                <ErrorBoundary><DashboardPage /></ErrorBoundary>
              } />
              <Route path="/servers" element={
                <ErrorBoundary><ServersPage /></ErrorBoundary>
              } />
              <Route path="/servers/:serverId" element={
                 <ErrorBoundary><ServerDetailPage /></ErrorBoundary>
               } />
               <Route path="/servers/create" element={
                 <ErrorBoundary><CreateServerPage /></ErrorBoundary>
               } />
              <Route path="/daemon" element={
                <ErrorBoundary><DaemonPage /></ErrorBoundary>
              } />
              <Route path="/logs" element={
                <ErrorBoundary><LogsPage /></ErrorBoundary>
              } />
              <Route path="/launch" element={
                <ErrorBoundary><LaunchPage /></ErrorBoundary>
              } />
               <Route path="/models" element={
                <ErrorBoundary><ModelsPage /></ErrorBoundary>
              } />
              <Route path="/benchmark" element={
                 <ErrorBoundary><BenchmarkPage /></ErrorBoundary>
               } />
               <Route path="/load" element={
                 <ErrorBoundary><LoadPage /></ErrorBoundary>
               } />
               <Route path="/settings" element={
                <ErrorBoundary><SettingsPage /></ErrorBoundary>
              } />
              <Route path="*" element={
                <ErrorBoundary><NotFoundPage /></ErrorBoundary>
              } />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
