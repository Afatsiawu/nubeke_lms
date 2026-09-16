import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/auth';
import { StaffLayout } from '@/components/StaffLayout';
import { OPACPage } from '@/pages/OPAC';
import { LoginPage } from '@/pages/Login';
import { DashboardPage } from '@/pages/Dashboard';
import { CatalogingPage } from '@/pages/Cataloging';
import { CirculationPage } from '@/pages/Circulation';
import { InventoryPage } from '@/pages/Inventory';
import { MembersPage } from '@/pages/Members';
import { ReportsPage } from '@/pages/Reports';
import { ReservationsPage } from '@/pages/Reservations';
import { AuditLogPage } from '@/pages/AuditLog';
import type { StaffRole } from '@/types';

function ProtectedRoute({ roles, children }: { roles: StaffRole[]; children: React.ReactNode }) {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-ink-500">Loading…</p>
      </div>
    );
  }
  if (!session) return <Navigate to="/staff/login" replace />;
  if (profile && !roles.includes(profile.role)) return <Navigate to="/staff/dashboard" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<OPACPage />} />
      <Route path="/staff/login" element={<LoginPage />} />
      <Route
        path="/staff"
        element={
          <ProtectedRoute roles={['staff', 'management']}>
            <StaffLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="catalog" element={
          <ProtectedRoute roles={['staff']}>
            <CatalogingPage />
          </ProtectedRoute>
        } />
        <Route path="circulation" element={
          <ProtectedRoute roles={['staff']}>
            <CirculationPage />
          </ProtectedRoute>
        } />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="members" element={
          <ProtectedRoute roles={['staff']}>
            <MembersPage />
          </ProtectedRoute>
        } />
        <Route path="reservations" element={
          <ProtectedRoute roles={['staff']}>
            <ReservationsPage />
          </ProtectedRoute>
        } />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="audit" element={<AuditLogPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  const hasEnv = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!hasEnv) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-50 px-4">
        <div className="max-w-md text-center">
          <h1 className="font-serif text-xl font-semibold text-ink-900">Configuration required</h1>
          <p className="mt-2 text-sm text-ink-500">
            This site needs Supabase environment variables to run. Please add
            <code className="mx-1 px-1.5 py-0.5 rounded bg-ink-100 text-ink-700 text-xs">VITE_SUPABASE_URL</code>
            and
            <code className="mx-1 px-1.5 py-0.5 rounded bg-ink-100 text-ink-700 text-xs">VITE_SUPABASE_ANON_KEY</code>
            in Render under Environment, then trigger a rebuild.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
