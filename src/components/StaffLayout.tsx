import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function StaffLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-ink-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
