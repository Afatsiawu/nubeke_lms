import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Menu, ArrowLeft } from 'lucide-react';
import { Sidebar } from './Sidebar';

export function StaffLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isDashboard = location.pathname === '/staff/dashboard';

  return (
    <div className="flex h-screen overflow-hidden bg-ink-50">
      {/* Desktop sidebar */}
      <div className="hidden lg:block shrink-0">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-ink-950/40 animate-fade-in"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative animate-slide-in-left">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-30 flex items-center gap-3 bg-white border-b border-ink-200 px-4 h-14">
          {!isDashboard && (
            <button
              onClick={() => navigate('/staff/dashboard')}
              className="rounded-lg p-2 text-ink-600 hover:bg-ink-100 transition-colors"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-ink-600 hover:bg-ink-100 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-serif text-base font-semibold text-ink-900">Nubuke LMS</span>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
