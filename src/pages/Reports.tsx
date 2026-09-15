import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, BookOpen, Users, Calendar, Award } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import type { Loan, Copy, Member, Book } from '@/types';

export function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [mostBorrowed, setMostBorrowed] = useState<{ book: Book; count: number }[]>([]);
  const [mostActiveMembers, setMostActiveMembers] = useState<{ member: Member; count: number }[]>([]);
  const [categoryUsage, setCategoryUsage] = useState<{ subject: string; count: number }[]>([]);
  const [totalLoans, setTotalLoans] = useState(0);
  const [activeLoans, setActiveLoans] = useState(0);
  const [returnedLoans, setReturnedLoans] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [monthlyTrend, setMonthlyTrend] = useState<{ month: string; count: number }[]>([]);

  useEffect(() => {
    async function load() {
      const [loansRes, booksRes, membersRes] = await Promise.all([
        supabase.from('loans').select('*, copies(*), members(*)'),
        supabase.from('books').select('*'),
        supabase.from('members').select('*'),
      ]);

      const loans = (loansRes.data ?? []) as (Loan & { copies: Copy; members: Member })[];
      const books = (booksRes.data ?? []) as Book[];
      const members = (membersRes.data ?? []) as Member[];

      const bookMap = new Map(books.map((b) => [b.id, b]));
      const memberMap = new Map(members.map((m) => [m.id, m]));

      // Most borrowed books
      const borrowCount = new Map<string, number>();
      loans.forEach((l) => {
        const bookId = l.copies?.book_id;
        if (bookId) borrowCount.set(bookId, (borrowCount.get(bookId) ?? 0) + 1);
      });
      const topBooks = Array.from(borrowCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([bookId, count]) => ({ book: bookMap.get(bookId)!, count }))
        .filter((x) => x.book);
      setMostBorrowed(topBooks);

      // Most active members
      const memberCount = new Map<string, number>();
      loans.forEach((l) => {
        memberCount.set(l.member_id, (memberCount.get(l.member_id) ?? 0) + 1);
      });
      const topMembers = Array.from(memberCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([memberId, count]) => ({ member: memberMap.get(memberId)!, count }))
        .filter((x) => x.member);
      setMostActiveMembers(topMembers);

      // Category usage
      const catCount = new Map<string, number>();
      loans.forEach((l) => {
        const book = bookMap.get(l.copies?.book_id ?? '');
        if (book?.subject) catCount.set(book.subject, (catCount.get(book.subject) ?? 0) + 1);
      });
      const cats = Array.from(catCount.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([subject, count]) => ({ subject, count }));
      setCategoryUsage(cats);

      // Summary stats
      setTotalLoans(loans.length);
      setActiveLoans(loans.filter((l) => l.status === 'active').length);
      setReturnedLoans(loans.filter((l) => l.status === 'returned').length);
      setOverdueCount(loans.filter((l) => l.status === 'active' && new Date(l.due_date) < new Date()).length);

      // Monthly trend (last 6 months)
      const months: { month: string; count: number }[] = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
        const count = loans.filter((l) => {
          const borrowed = new Date(l.borrowed_at);
          return borrowed.getFullYear() === d.getFullYear() && borrowed.getMonth() === d.getMonth();
        }).length;
        months.push({ month: monthKey, count });
      }
      setMonthlyTrend(months);

      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="p-8"><p className="text-ink-500">Loading reports…</p></div>;
  }

  const maxTrend = Math.max(...monthlyTrend.map((m) => m.count), 1);
  const maxCat = Math.max(...categoryUsage.map((c) => c.count), 1);

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-ink-900">Reports & Analytics</h1>
        <p className="text-sm text-ink-500 mt-1">Usage insights to help the library make informed decisions.</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatBox icon={BookOpen} label="Total loans" value={totalLoans} color="forest" />
        <StatBox icon={TrendingUp} label="Active loans" value={activeLoans} color="kente" />
        <StatBox icon={Award} label="Returned" value={returnedLoans} color="clay" />
        <StatBox icon={Calendar} label="Overdue" value={overdueCount} color="rust" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Monthly trend */}
        <div className="card p-5">
          <h2 className="font-semibold text-ink-900 mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-ink-400" /> Borrowing trend (6 months)
          </h2>
          <div className="flex items-end justify-between gap-2 h-40">
            {monthlyTrend.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex items-end h-32">
                  <div
                    className="w-full rounded-t-md bg-forest-500 transition-all duration-300 hover:bg-forest-600"
                    style={{ height: `${(m.count / maxTrend) * 100}%`, minHeight: m.count > 0 ? '8px' : '0' }}
                    title={`${m.count} loans`}
                  />
                </div>
                <span className="text-xs text-ink-500">{m.month}</span>
                <span className="text-xs font-semibold text-ink-700">{m.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Category usage */}
        <div className="card p-5">
          <h2 className="font-semibold text-ink-900 mb-4 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-ink-400" /> Loans by category
          </h2>
          {categoryUsage.length === 0 ? (
            <p className="text-sm text-ink-400 py-8 text-center">No loan data yet.</p>
          ) : (
            <div className="space-y-3">
              {categoryUsage.slice(0, 8).map((c) => (
                <div key={c.subject}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-ink-700">{c.subject}</span>
                    <span className="text-ink-500 font-medium">{c.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-ink-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-kente-500 transition-all duration-300"
                      style={{ width: `${(c.count / maxCat) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Most borrowed */}
        <div className="card p-5">
          <h2 className="font-semibold text-ink-900 mb-4 flex items-center gap-2">
            <Award className="h-4 w-4 text-ink-400" /> Most borrowed books
          </h2>
          {mostBorrowed.length === 0 ? (
            <p className="text-sm text-ink-400 py-8 text-center">No loans recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {mostBorrowed.map((item, i) => (
                <div key={item.book.id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-ink-50">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-forest-100 text-forest-700 text-xs font-semibold">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-900 truncate">{item.book.title}</p>
                    <p className="text-xs text-ink-500">{item.book.author}</p>
                  </div>
                  <span className="text-sm font-semibold text-forest-600">{item.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Most active members */}
        <div className="card p-5">
          <h2 className="font-semibold text-ink-900 mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-ink-400" /> Most active members
          </h2>
          {mostActiveMembers.length === 0 ? (
            <p className="text-sm text-ink-400 py-8 text-center">No loan data yet.</p>
          ) : (
            <div className="space-y-2">
              {mostActiveMembers.map((item, i) => (
                <div key={item.member.id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-ink-50">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-kente-100 text-kente-700 text-xs font-semibold">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-900 truncate">{item.member.full_name}</p>
                    <p className="text-xs text-ink-500 font-mono">{item.member.member_code}</p>
                  </div>
                  <span className="text-sm font-semibold text-kente-600">{item.count} loans</span>
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
};

function StatBox({ icon: Icon, label, value, color }: { icon: typeof BookOpen; label: string; value: number; color: keyof typeof colorMap }) {
  const c = colorMap[color];
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${c.bg}`}>
          <Icon className={`h-4 w-4 ${c.icon}`} />
        </div>
        <div>
          <p className="text-2xl font-semibold text-ink-900">{value}</p>
          <p className="text-xs text-ink-500">{label}</p>
        </div>
      </div>
    </div>
  );
}
