import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ArrowRightLeft, AlertTriangle, Users, Package, TrendingUp, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { formatDate, isOverdue } from '@/lib/utils';
import type { Book, Copy, Loan, Member } from '@/types';

interface DashboardStats {
  totalBooks: number;
  totalCopies: number;
  availableCopies: number;
  borrowedCopies: number;
  overdueCount: number;
  totalMembers: number;
  activeLoans: number;
}

export function DashboardPage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentLoans, setRecentLoans] = useState<(Loan & { copies: Copy; members: Member })[]>([]);
  const [overdueLoans, setOverdueLoans] = useState<(Loan & { copies: Copy; members: Member })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [booksRes, copiesRes, membersRes, loansRes] = await Promise.all([
        supabase.from('books').select('id'),
        supabase.from('copies').select('id, status'),
        supabase.from('members').select('id'),
        supabase
          .from('loans')
          .select('*, copies(*), members(*)')
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      const copies = copiesRes.data ?? [];
      const loans = (loansRes.data ?? []) as (Loan & { copies: Copy; members: Member })[];

      setStats({
        totalBooks: booksRes.data?.length ?? 0,
        totalCopies: copies.length,
        availableCopies: copies.filter((c) => c.status === 'available').length,
        borrowedCopies: copies.filter((c) => c.status === 'borrowed').length,
        overdueCount: loans.filter((l) => l.status === 'active' && isOverdue(l.due_date, l.returned_at)).length,
        totalMembers: membersRes.data?.length ?? 0,
        activeLoans: loans.filter((l) => l.status === 'active').length,
      });

      setRecentLoans(loans.slice(0, 5));
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
        <StatCard icon={Package} label="Total copies" value={stats?.totalCopies ?? 0} color="kente" to="/staff/inventory" />
        <StatCard icon={ArrowRightLeft} label="Active loans" value={stats?.activeLoans ?? 0} color="clay" to="/staff/circulation" />
        <StatCard icon={AlertTriangle} label="Overdue" value={stats?.overdueCount ?? 0} color="rust" to="/staff/circulation" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard icon={Users} label="Members" value={stats?.totalMembers ?? 0} color="ink" to="/staff/members" />
        <StatCard icon={Package} label="Available copies" value={stats?.availableCopies ?? 0} color="forest" to="/staff/inventory" />
        <StatCard icon={ArrowRightLeft} label="Borrowed copies" value={stats?.borrowedCopies ?? 0} color="kente" to="/staff/inventory" />
        <StatCard icon={TrendingUp} label="Total loans" value={stats?.activeLoans ?? 0} color="gold" to="/staff/reports" />
      </div>

      <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
        {/* Recent loans */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-ink-900">Recent activity</h2>
            <Link to="/staff/circulation" className="text-sm text-forest-600 hover:text-forest-700 flex items-center gap-1">
              View all <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          {recentLoans.length === 0 ? (
            <p className="text-sm text-ink-400 py-6 text-center">No recent loans.</p>
          ) : (
            <div className="space-y-3">
              {recentLoans.map((loan) => (
                <div key={loan.id} className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-800 truncate">
                      {loan.members.full_name}
                    </p>
                    <p className="text-xs text-ink-500 font-mono">{loan.copies.copy_code}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-xs text-ink-500">{formatDate(loan.borrowed_at)}</p>
                    <span className={`badge-${loan.status}`}>{loan.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Overdue */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-ink-900">Overdue items</h2>
            <Link to="/staff/circulation" className="text-sm text-forest-600 hover:text-forest-700 flex items-center gap-1">
              View all <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          {overdueLoans.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <p className="text-sm text-forest-600 font-medium">No overdue items</p>
              <p className="text-xs text-ink-400 mt-1">All loans are on time.</p>
            </div>
          ) : (
            <div className="space-y-3">
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
    </div>
  );
}

const colorMap = {
  forest: { bg: 'bg-forest-50', text: 'text-forest-700', icon: 'text-forest-600' },
  kente: { bg: 'bg-kente-50', text: 'text-kente-700', icon: 'text-kente-600' },
  clay: { bg: 'bg-clay-50', text: 'text-clay-700', icon: 'text-clay-600' },
  rust: { bg: 'bg-rust-50', text: 'text-rust-700', icon: 'text-rust-600' },
  ink: { bg: 'bg-ink-50', text: 'text-ink-700', icon: 'text-ink-600' },
  gold: { bg: 'bg-gold-50', text: 'text-gold-800', icon: 'text-gold-600' },
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
