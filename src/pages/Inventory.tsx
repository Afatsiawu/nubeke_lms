import { useEffect, useState } from 'react';
import { Package, AlertTriangle, BookOpen, Wrench, Search, Edit2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Book, Copy } from '@/types';

interface InventoryRow extends Copy {
  books: Book;
}

export function InventoryPage() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const isStaff = profile?.role === 'staff';

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('copies')
        .select('*, books(*)')
        .order('created_at', { ascending: false });
      if (error) {
        console.error(error.message);
      } else {
        setRows(data as InventoryRow[]);
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = rows.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        r.copy_code.toLowerCase().includes(q) ||
        r.books.title.toLowerCase().includes(q) ||
        r.books.author.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts = {
    total: rows.length,
    available: rows.filter((r) => r.status === 'available').length,
    borrowed: rows.filter((r) => r.status === 'borrowed').length,
    reserved: rows.filter((r) => r.status === 'reserved').length,
    lost: rows.filter((r) => r.status === 'lost').length,
    under_repair: rows.filter((r) => r.status === 'under_repair').length,
  };

  async function updateStatus(copy: InventoryRow, status: Copy['status']) {
    if (!isStaff) return;
    const { error } = await supabase.from('copies').update({ status }).eq('id', copy.id);
    if (error) return;
    setRows(rows.map((r) => (r.id === copy.id ? { ...r, status } : r)));
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-ink-900">Inventory</h1>
        <p className="text-sm text-ink-500 mt-1">Real-time view of all physical copies and their status.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <SummaryCard icon={Package} label="Total" value={counts.total} color="ink" />
        <SummaryCard icon={BookOpen} label="Available" value={counts.available} color="forest" />
        <SummaryCard icon={Package} label="Borrowed" value={counts.borrowed} color="kente" />
        <SummaryCard icon={BookOpen} label="Reserved" value={counts.reserved} color="gold" />
        <SummaryCard icon={AlertTriangle} label="Lost" value={counts.lost} color="rust" />
        <SummaryCard icon={Wrench} label="Under repair" value={counts.under_repair} color="clay" />
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, author, or copy code…"
            className="input pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input w-44"
        >
          <option value="">All statuses</option>
          <option value="available">Available</option>
          <option value="borrowed">Borrowed</option>
          <option value="reserved">Reserved</option>
          <option value="lost">Lost</option>
          <option value="under_repair">Under repair</option>
        </select>
      </div>

      {loading ? (
        <p className="text-ink-500">Loading inventory…</p>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-ink-500">No copies match your filters.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-ink-50 border-b border-ink-200">
              <tr>
                <th className="text-left text-xs font-semibold text-ink-500 uppercase tracking-wider px-4 py-3">Copy code</th>
                <th className="text-left text-xs font-semibold text-ink-500 uppercase tracking-wider px-4 py-3">Title</th>
                <th className="text-left text-xs font-semibold text-ink-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Condition</th>
                <th className="text-left text-xs font-semibold text-ink-500 uppercase tracking-wider px-4 py-3">Status</th>
                {isStaff && <th className="text-right text-xs font-semibold text-ink-500 uppercase tracking-wider px-4 py-3">Change</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filtered.map((row) => (
                <tr key={row.id} className="table-row-hover">
                  <td className="px-4 py-3 text-sm font-mono text-ink-700">{row.copy_code}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink-900">{row.books.title}</p>
                    <p className="text-xs text-ink-400">{row.books.author}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-ink-600 hidden sm:table-cell capitalize">{row.condition ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`badge-${row.status}`}>{row.status.replace('_', ' ')}</span>
                  </td>
                  {isStaff && (
                    <td className="px-4 py-3 text-right">
                      <select
                        value={row.status}
                        onChange={(e) => updateStatus(row, e.target.value as Copy['status'])}
                        className="rounded-md border border-ink-200 bg-white px-2 py-1 text-xs text-ink-700 focus:outline-none focus:border-forest-500"
                      >
                        <option value="available">Available</option>
                        <option value="borrowed">Borrowed</option>
                        <option value="reserved">Reserved</option>
                        <option value="lost">Lost</option>
                        <option value="under_repair">Under repair</option>
                      </select>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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

function SummaryCard({ icon: Icon, label, value, color }: { icon: typeof Package; label: string; value: number; color: keyof typeof colorMap }) {
  const c = colorMap[color];
  return (
    <div className="card p-3">
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${c.bg} mb-2`}>
        <Icon className={`h-4 w-4 ${c.icon}`} />
      </div>
      <p className="text-xl font-semibold text-ink-900">{value}</p>
      <p className="text-xs text-ink-500">{label}</p>
    </div>
  );
}
