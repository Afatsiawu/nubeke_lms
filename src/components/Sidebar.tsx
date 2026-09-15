import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  ArrowRightLeft,
  Package,
  Users,
  BarChart3,
  Bookmark,
  ScrollText,
  LogOut,
} from 'lucide-react';
import { Logo } from './Logo';
import { SyncStatus } from './SyncStatus';
import { useAuth } from '@/lib/auth';
import type { StaffRole } from '@/types';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: StaffRole[];
}

const navItems: NavItem[] = [
  { to: '/staff/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['staff', 'management'] },
  { to: '/staff/catalog', label: 'Catalog', icon: BookOpen, roles: ['staff'] },
  { to: '/staff/circulation', label: 'Circulation', icon: ArrowRightLeft, roles: ['staff'] },
  { to: '/staff/inventory', label: 'Inventory', icon: Package, roles: ['staff', 'management'] },
  { to: '/staff/members', label: 'Members', icon: Users, roles: ['staff'] },
  { to: '/staff/reservations', label: 'Reservations', icon: Bookmark, roles: ['staff'] },
  { to: '/staff/reports', label: 'Reports', icon: BarChart3, roles: ['staff', 'management'] },
  { to: '/staff/audit', label: 'Audit Log', icon: ScrollText, roles: ['staff', 'management'] },
];

export function Sidebar() {
  const { profile, signOut } = useAuth();

  const visibleItems = navItems.filter((item) => profile && item.roles.includes(profile.role));

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-ink-200 bg-white">
      <div className="flex items-center px-5 py-4 border-b border-ink-200">
        <Logo />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `nav-link ${isActive ? 'nav-link-active' : ''}`
              }
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-ink-200 px-3 py-3 space-y-3">
        <SyncStatus />
        <div className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-ink-900">{profile?.full_name}</span>
            <span className="text-xs capitalize text-ink-500">{profile?.role}</span>
          </div>
          <button
            onClick={() => signOut()}
            className="rounded-lg p-2 text-ink-500 hover:bg-rust-50 hover:text-rust-600 transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
