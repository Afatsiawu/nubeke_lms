import { useEffect, useState } from 'react';
import { ScrollText, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatRelative } from '@/lib/utils';
import type { AuditLogEntry, StaffProfile } from '@/types';

interface AuditWithStaff extends AuditLogEntry {
  staff_profiles: StaffProfile | null;
}

export function AuditLogPage() {
  const [entries, setEntries] = useState<AuditWithStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*, staff_profiles(*)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) {
        console.error(error.message);
      } else {
        setEntries(data as AuditWithStaff[]);
      }
      setLoading(false);
    }
    load();
  }, []);

  const actions = [...new Set(entries.map((e) => e.action))].sort();

  const filtered = entries.filter((e) => {
    if (actionFilter && e.action !== actionFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        e.action.toLowerCase().includes(q) ||
        (e.staff_profiles?.full_name ?? '').toLowerCase().includes(q) ||
        (e.entity_type ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const actionColors: Record<string, string> = {
    checkout: 'badge-borrowed',
    return: 'badge-available',
    catalog_add: 'badge-fulfilled',
    catalog_edit: 'badge-fulfilled',
    catalog_remove: 'badge-lost',
    member_register: 'badge-available',
    member_edit: 'badge-fulfilled',
    reservation_create: 'badge-pending',
    reservation_update: 'badge-fulfilled',
    copy_add: 'badge-fulfilled',
    copy_status_change: 'badge-fulfilled',
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-ink-900">Audit Log</h1>
        <p className="text-sm text-ink-500 mt-1">Trace of all staff actions — who did what, and when.</p>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by action, staff name…"
            className="input pl-10"
          />
        </div>
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="input w-48">
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-ink-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center">
          <ScrollText className="h-10 w-10 text-ink-300 mx-auto mb-2" />
          <p className="text-ink-500 font-medium">No audit entries found</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-ink-50 border-b border-ink-200">
              <tr>
                <th className="text-left text-xs font-semibold text-ink-500 uppercase tracking-wider px-4 py-3">When</th>
                <th className="text-left text-xs font-semibold text-ink-500 uppercase tracking-wider px-4 py-3">Staff</th>
                <th className="text-left text-xs font-semibold text-ink-500 uppercase tracking-wider px-4 py-3">Action</th>
                <th className="text-left text-xs font-semibold text-ink-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Entity</th>
                <th className="text-left text-xs font-semibold text-ink-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filtered.map((e) => (
                <tr key={e.id} className="table-row-hover">
                  <td className="px-4 py-3 text-sm text-ink-500 whitespace-nowrap">{formatRelative(e.created_at)}</td>
                  <td className="px-4 py-3 text-sm text-ink-700">{e.staff_profiles?.full_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={actionColors[e.action] ?? 'badge bg-ink-100 text-ink-600'}>
                      {e.action.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-ink-600 hidden sm:table-cell">{e.entity_type ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-ink-500 hidden md:table-cell">
                    {e.details ? JSON.stringify(e.details).slice(0, 60) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
