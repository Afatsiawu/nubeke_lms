import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Users,
  ChevronRight,
  TrendingUp,
  RotateCcw,
  ArrowRight,
  BookPlus,
  UserPlus,
  FileEdit,
  AlertCircle,
  ClipboardList,
  Calendar,
  Library,
  Activity,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { formatDate, formatRelative, isOverdue } from '@/lib/utils';
import type { Book, Copy, Loan, Member, AuditLogEntry, StaffProfile } from '@/types';

interface DashboardStats {
  totalBooks: number;
  totalCopies: number;
  availableCopies: number;
  borrowedCopies: number;
  overdueCount: number;
  totalMembers: number;
  activeMembers: number;
  activeLoans: number;
  returnedLoans: number;
  pendingReservations: number;
}

interface AuditWithStaff extends AuditLogEntry {
  staff_profiles: StaffProfile | null;
}

export function DashboardPage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOps, setRecentOps] = useState<AuditWithStaff[]>([]);
  const [overdueLoans, setOverdueLoans] = useState<(Loan & { copies: Copy; members: Member })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [
        booksRes, copiesRes, membersRes, loansRes, reservationsRes, auditRes,
      ] = await Promise.all([
        supabase.from('books').select('id'),
        supabase.from('copies').select('id, status'),
        supabase.from('members').select('id, membership_status'),
        supabase.from('loans').select('*, copies(*), members(*)').order('created_at', { ascending: false }).limit(10),
        supabase.from('reservations').select('id, status').eq('status', 'pending'),
        supabase.from('audit_log').select('*, staff_profiles(*)').order('created_at', { ascending: false }).limit(8),
      ]);

      const copies = copiesRes.data ?? [];
      const members = membersRes.data ?? [];
      const loans = (loansRes.data ?? []) as (Loan & { copies: Copy; members: Member })[];

      setStats({
        totalBooks: booksRes.data?.length ?? 0,
        totalCopies: copies.length,
        availableCopies: copies.filter((c) => c.status === 'available').length,
        borrowedCopies: copies.filter((c) => c.status === 'borrowed').length,
        overdueCount: loans.filter((l) => l.status === 'active' && isOverdue(l.due_date, l.returned_at)).length,
        totalMembers: members.length,
        activeMembers: members.filter((m) => m.membership_status === 'active').length,
        activeLoans: loans.filter((l) => l.status === 'active').length,
        returnedLoans: loans.filter((l) => l.status === 'returned').length,
        pendingReservations: reservationsRes.data?.length ?? 0,
      });

      setRecentOps((auditRes.data ?? []) as AuditWithStaff[]);
      setOverdueLoans(loans.filter((l) => l.status === 'active' && isOverdue(l.due_date, l.returned_at)).slice(0, 5));
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="p-8"><p className="text-ink-500">Loading dashboard…</p></div>;
  }

  const isStaff = profile?.role === 'staff';

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-ink-900">
          Welcome back, {profile?.full_name?.split(' ')[0]}
        </h1>
        <p className="text-sm text-ink-500 mt-1">
          {isStaff ? 'Library operations overview' : 'Reports and analytics overview'}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard icon={BookOpen} label="Books in catalog" value={stats?.totalBooks ?? 0} color="forest" to="/staff/catalog" />
        <StatCard icon={Users} label="Members" value={stats?.totalMembers ?? 0} color="ink" to="/staff/members" />
        <StatCard icon={ArrowRight} label="Active loans" value={stats?.activeLoans ?? 0} color="clay" to="/staff/circulation" />
        <StatCard icon={AlertCircle} label="Overdue" value={stats?.overdueCount ?? 0} color="rust" to="/staff/circulation" />
      </div>

      {/* Analytics row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <MiniStat label="Total copies" value={stats?.totalCopies ?? 0} icon={Library} />
        <MiniStat label="Available" value={stats?.availableCopies ?? 0} icon={BookOpen} color="text-forest-600" />
        <MiniStat label="On loan" value={stats?.borrowedCopies ?? 0} icon={ArrowRight} color="text-clay-600" />
        <MiniStat label="Returned" value={stats?.returnedLoans ?? 0} icon={RotateCcw} color="text-ink-600" />
        <MiniStat label="Reservations" value={stats?.pendingReservations ?? 0} icon={ClipboardList} color="text-kente-600" />
      </div>

      <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
        {/* Recent operations */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-ink-900 flex items-center gap-2">
              <Activity className="h-4 w-4 text-ink-400" /> Recent operations
            </h2>
            <Link to="/staff/audit" className="text-sm text-forest-600 hover:text-forest-700 flex items-center gap-1">
              View all <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          {recentOps.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <p className="text-sm text-ink-400">No operations recorded yet.</p>
              <p className="text-xs text-ink-400 mt-1">Actions like adding books, checking out, and registering members will appear here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentOps.map((op) => (
                <div key={op.id} className="flex items-center justify-between rounded-lg border border-ink-100 px-3 py-2 hover:bg-ink-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0">
                      <OpIcon action={op.action} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-800 truncate">
                        {op.action.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-ink-500">
                        {op.staff_profiles?.full_name ?? 'System'} · {formatRelative(op.created_at)}
                      </p>
                    </div>
                  </div>
                  <span className={`shrink-0 ml-2 text-xs ${opColor(op.action)}`}>
                    {op.entity_type ?? '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Overdue items */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-ink-900 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rust-400" /> Overdue items
            </h2>
            <Link to="/staff/audit" className="text-sm text-forest-600 hover:text-forest-700 flex items-center gap-1">
              View all <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          {overdueLoans.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <p className="text-sm text-forest-600 font-medium">No overdue items</p>
              <p className="text-xs text-ink-400 mt-1">All loans are on time.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {overdueLoans.map((loan) => (
                <div key={loan.id} className="flex items-center justify-between rounded-lg bg-rust-50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-800 truncate">{loan.members.full_name}</p>
                    <p className="text-xs text-ink-500 font-mono">{loan.copies.copy_code}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-xs text-rust-700 font-medium">Due {formatDate(loan.due_date)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Operations breakdown */}
      <div className="mt-6 card p-5">
        <h2 className="font-semibold text-ink-900 flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-ink-400" /> Operations summary
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <OpSummary icon={BookPlus} label="Books added" to="/staff/catalog" />
          <OpSummary icon={UserPlus} label="Members registered" to="/staff/members" />
          <OpSummary icon={ArrowRight} label="Books checked out" to="/staff/circulation" />
          <OpSummary icon={RotateCcw} label="Books returned" to="/staff/circulation" />
          <OpSummary icon={FileEdit} label="Catalog edits" to="/staff/catalog" />
          <OpSummary icon={ClipboardList} label="Reservations" to="/staff/reservations" />
          <OpSummary icon={Calendar} label="Active loans" to="/staff/circulation" />
          <OpSummary icon={Library} label="Inventory" to="/staff/inventory" />
        </div>
      </div>
    </div>
  );
}

function OpIcon({ action }: { action: string }) {
  const iconClass = 'h-4 w-4';
  switch (action) {
    case 'checkout':
      return <ArrowRight className={`${iconClass} text-clay-600`} />;
    case 'return':
      return <RotateCcw className={`${iconClass} text-forest-600`} />;
    case 'catalog_add':
    case 'copy_add':
      return <BookPlus className={`${iconClass} text-forest-600`} />;
    case 'catalog_edit':
    case 'member_edit':
    case 'copy_status_change':
      return <FileEdit className={`${iconClass} text-kente-600`} />;
    case 'member_register':
      return <UserPlus className={`${iconClass} text-ink-600`} />;
    case 'reservation_create':
    case 'reservation_update':
      return <ClipboardList className={`${iconClass} text-kente-600`} />;
    case 'catalog_remove':
      return <AlertCircle className={`${iconClass} text-rust-600`} />;
    default:
      return <Activity className={`${iconClass} text-ink-400`} />;
  }
}

function opColor(action: string): string {
  switch (action) {
    case 'checkout':
      return 'text-clay-600';
    case 'return':
      return 'text-forest-600';
    case 'catalog_add':
    case 'copy_add':
      return 'text-forest-600';
    case 'member_register':
      return 'text-ink-600';
    case 'reservation_create':
    case 'reservation_update':
      return 'text-kente-600';
    case 'catalog_remove':
      return 'text-rust-600';
    default:
      return 'text-ink-500';
  }
}

function MiniStat({ label, value, icon: Icon, color = 'text-ink-600' }: { label: string; value: number; icon: typeof BookOpen; color?: string }) {
  return (
    <div className="card p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-4 w-4 ${color}`} />
        <p className="text-lg font-semibold text-ink-900">{value}</p>
      </div>
      <p className="text-xs text-ink-500">{label}</p>
    </div>
  );
}

function OpSummary({ icon: Icon, label, to }: { icon: typeof BookOpen; label: string; to: string }) {
  return (
    <Link to={to} className="flex items-center gap-2.5 rounded-lg border border-ink-100 px-3 py-2.5 hover:bg-ink-50 hover:border-ink-200 transition-colors group">
      <Icon className="h-4 w-4 text-ink-400 group-hover:text-forest-600 transition-colors" />
      <span className="text-sm text-ink-600 group-hover:text-ink-800">{label}</span>
      <ChevronRight className="h-3.5 w-3.5 text-ink-300 ml-auto group-hover:text-ink-500 transition-colors" />
    </Link>
  );
}

const colorMap = {
  forest: { bg: 'bg-forest-50', text: 'text-forest-700', icon: 'text-forest-600' },
  kente: { bg: 'bg-kente-50', text: 'text-kente-700', icon: 'text-kente-600' },
  clay: { bg: 'bg-clay-50', text: 'text-clay-700', icon: 'text-clay-600' },
  rust: { bg: 'bg-rust-50', text: 'text-rust-700', icon: 'text-rust-600' },
  ink: { bg: 'bg-ink-50', text: 'text-ink-700', icon: 'text-ink-600' },
};

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  to,
}: {
  icon: typeof BookOpen;
  label: string;
  value: number;
  color: keyof typeof colorMap;
  to: string;
}) {
  const c = colorMap[color];
  return (
    <Link to={to} className="stat-card hover:shadow-md transition-shadow group">
      <div className="flex items-center justify-between">
        <div className={`flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg ${c.bg}`}>
          <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${c.icon}`} />
        </div>
        <ChevronRight className="h-4 w-4 text-ink-300 group-hover:text-ink-500 transition-colors" />
      </div>
      <p className="mt-2 sm:mt-3 text-xl sm:text-2xl font-semibold text-ink-900">{value}</p>
      <p className="text-xs sm:text-sm text-ink-500">{label}</p>
    </Link>
  );
}
