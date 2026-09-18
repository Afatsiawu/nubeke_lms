import { useEffect, useState, FormEvent } from 'react';
import { Plus, Search, Edit2, X, Save, AlertCircle, User, Phone, Mail, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { logAction } from '@/lib/audit';
import { formatDate, generateMemberCode } from '@/lib/utils';
import type { Member, MembershipStatus } from '@/types';

export function MembersPage() {
  const { profile } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Member | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error: err } = await supabase.from('members').select('*').order('full_name');
    if (err) setError(err.message);
    else setMembers(data ?? []);
    setLoading(false);
  }

  const filtered = members.filter((m) => {
    const q = search.toLowerCase();
    return (
      m.full_name.toLowerCase().includes(q) ||
      m.member_code.toLowerCase().includes(q) ||
      (m.email ?? '').toLowerCase().includes(q) ||
      (m.phone ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink-900">Members</h1>
          <p className="text-sm text-ink-500 mt-1">Register and manage library members.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> Register member
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-rust-50 px-3 py-2.5 text-sm text-rust-700">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, code, email, or phone…"
          className="input pl-10"
        />
      </div>

      {loading ? (
        <p className="text-ink-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center">
          <User className="h-10 w-10 text-ink-300 mx-auto mb-2" />
          <p className="text-ink-500 font-medium">No members found</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-ink-50 border-b border-ink-200">
              <tr>
                <th className="text-left text-xs font-semibold text-ink-500 uppercase tracking-wider px-4 py-3">Name</th>
                <th className="text-left text-xs font-semibold text-ink-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Code</th>
                <th className="text-left text-xs font-semibold text-ink-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Contact</th>
                <th className="text-left text-xs font-semibold text-ink-500 uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-ink-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Joined</th>
                <th className="text-right text-xs font-semibold text-ink-500 uppercase tracking-wider px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filtered.map((m) => (
                <tr key={m.id} className="table-row-hover">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink-900">{m.full_name}</p>
                    <p className="text-xs text-ink-400 sm:hidden font-mono">{m.member_code}</p>
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-ink-600 hidden sm:table-cell">{m.member_code}</td>
                  <td className="px-4 py-3 text-sm text-ink-600 hidden md:table-cell">
                    {m.email ?? m.phone ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge-${m.membership_status}`}>{m.membership_status}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-ink-500 hidden lg:table-cell">{formatDate(m.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setEditing(m)}
                      className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-700"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {(showForm || editing) && (
        <MemberFormModal
          member={editing}
          existingCodes={members.map((m) => m.member_code)}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={async () => { setShowForm(false); setEditing(null); await load(); }}
        />
      )}
    </div>
  );
}

function MemberFormModal({
  member,
  existingCodes,
  onClose,
  onSaved,
}: {
  member: Member | null;
  existingCodes: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { profile } = useAuth();
  const [form, setForm] = useState({
    full_name: member?.full_name ?? '',
    member_code: member?.member_code ?? generateMemberCode(existingCodes),
    email: member?.email ?? '',
    phone: member?.phone ?? '',
    address: member?.address ?? '',
    membership_status: member?.membership_status ?? 'active',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      full_name: form.full_name,
      member_code: form.member_code,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
      membership_status: form.membership_status as MembershipStatus,
    };

    let result;
    if (member) {
      result = await supabase.from('members').update(payload).eq('id', member.id);
      if (profile) await logAction(profile.id, 'member_edit', 'member', member.id, { name: form.full_name });
    } else {
      result = await supabase.from('members').insert(payload);
      if (profile) await logAction(profile.id, 'member_register', 'member', undefined, { name: form.full_name, code: form.member_code });
    }

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/40 animate-fade-in" onClick={onClose}>
      <div className="card max-w-md w-full max-h-[85vh] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-ink-100">
          <h2 className="font-serif text-lg font-semibold text-ink-900">
            {member ? 'Edit member' : 'Register new member'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="label">Full name <span className="text-rust-500">*</span></label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
              <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="input pl-10" />
            </div>
          </div>
          <div>
            <label className="label">Member code <span className="text-rust-500">*</span></label>
            <input required value={form.member_code} onChange={(e) => setForm({ ...form, member_code: e.target.value })} className="input font-mono" />
          </div>
          <div>
            <label className="label">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input pl-10" />
            </div>
          </div>
          <div>
            <label className="label">Phone</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input pl-10" />
            </div>
          </div>
          <div>
            <label className="label">Address</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input pl-10" />
            </div>
          </div>
          <div>
            <label className="label">Membership status</label>
            <select
              value={form.membership_status}
              onChange={(e) => setForm({ ...form, membership_status: e.target.value as MembershipStatus })}
              className="input"
            >
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="expired">Expired</option>
            </select>
          </div>
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-rust-50 px-3 py-2.5 text-sm text-rust-700">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
