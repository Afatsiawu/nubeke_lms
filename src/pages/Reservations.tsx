import { useEffect, useState } from 'react';
import { Bookmark, Plus, X, AlertCircle, Check, Ban } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { logAction } from '@/lib/audit';
import { formatDate } from '@/lib/utils';
import type { Reservation, Book, Member } from '@/types';

interface ReservationWithDetails extends Reservation {
  books: Book;
  members: Member;
}

export function ReservationsPage() {
  const { profile } = useAuth();
  const [reservations, setReservations] = useState<ReservationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [books, setBooks] = useState<Book[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [resRes, booksRes, membersRes] = await Promise.all([
      supabase.from('reservations').select('*, books(*), members(*)').order('created_at', { ascending: false }),
      supabase.from('books').select('*').order('title'),
      supabase.from('members').select('*').order('full_name'),
    ]);
    if (resRes.error) setError(resRes.error.message);
    else setReservations(resRes.data as ReservationWithDetails[]);
    setBooks(booksRes.data ?? []);
    setMembers(membersRes.data ?? []);
    setLoading(false);
  }

  async function updateStatus(res: ReservationWithDetails, status: Reservation['status']) {
    const updates: Partial<Reservation> = { status };
    if (status === 'fulfilled') updates.fulfilled_at = new Date().toISOString();
    const { error: err } = await supabase.from('reservations').update(updates).eq('id', res.id);
    if (err) {
      setError(err.message);
      return;
    }
    if (profile) await logAction(profile.id, 'reservation_update', 'reservation', res.id, { to: status });
    setReservations(reservations.map((r) => (r.id === res.id ? { ...r, ...updates } : r)));
  }

  const pending = reservations.filter((r) => r.status === 'pending');
  const fulfilled = reservations.filter((r) => r.status === 'fulfilled');
  const cancelled = reservations.filter((r) => r.status === 'cancelled');

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink-900">Reservations</h1>
          <p className="text-sm text-ink-500 mt-1">Manage holds placed by members on books.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> New reservation
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-rust-50 px-3 py-2.5 text-sm text-rust-700">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {loading ? (
        <p className="text-ink-500">Loading…</p>
      ) : (
        <div className="space-y-6">
          <ReservationSection title="Pending" count={pending.length} reservations={pending} onUpdate={updateStatus} />
          <ReservationSection title="Fulfilled" count={fulfilled.length} reservations={fulfilled} onUpdate={updateStatus} />
          <ReservationSection title="Cancelled" count={cancelled.length} reservations={cancelled} onUpdate={updateStatus} />
        </div>
      )}

      {showForm && (
        <ReservationFormModal
          books={books}
          members={members}
          onClose={() => setShowForm(false)}
          onSaved={async () => { setShowForm(false); await load(); }}
        />
      )}
    </div>
  );
}

function ReservationSection({
  title,
  count,
  reservations,
  onUpdate,
}: {
  title: string;
  count: number;
  reservations: ReservationWithDetails[];
  onUpdate: (r: ReservationWithDetails, status: Reservation['status']) => void;
}) {
  if (count === 0) return null;
  return (
    <div>
      <h2 className="text-sm font-semibold text-ink-500 uppercase tracking-wider mb-2">
        {title} ({count})
      </h2>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-ink-50 border-b border-ink-200">
            <tr>
              <th className="text-left text-xs font-semibold text-ink-500 uppercase tracking-wider px-4 py-3">Book</th>
              <th className="text-left text-xs font-semibold text-ink-500 uppercase tracking-wider px-4 py-3">Member</th>
              <th className="text-left text-xs font-semibold text-ink-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Reserved</th>
              <th className="text-left text-xs font-semibold text-ink-500 uppercase tracking-wider px-4 py-3">Status</th>
              <th className="text-right text-xs font-semibold text-ink-500 uppercase tracking-wider px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {reservations.map((r) => (
              <tr key={r.id} className="table-row-hover">
                <td className="px-4 py-3">
                  <p className="font-medium text-ink-900">{r.books.title}</p>
                  <p className="text-xs text-ink-400">{r.books.author}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm text-ink-700">{r.members.full_name}</p>
                  <p className="text-xs text-ink-400 font-mono">{r.members.member_code}</p>
                </td>
                <td className="px-4 py-3 text-sm text-ink-500 hidden sm:table-cell">{formatDate(r.created_at)}</td>
                <td className="px-4 py-3">
                  <span className={`badge-${r.status}`}>{r.status}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  {r.status === 'pending' && (
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => onUpdate(r, 'fulfilled')}
                        className="rounded-lg p-2 text-forest-600 hover:bg-forest-50"
                        title="Mark fulfilled"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onUpdate(r, 'cancelled')}
                        className="rounded-lg p-2 text-rust-600 hover:bg-rust-50"
                        title="Cancel"
                      >
                        <Ban className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReservationFormModal({
  books,
  members,
  onClose,
  onSaved,
}: {
  books: Book[];
  members: Member[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { profile } = useAuth();
  const [bookId, setBookId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const { error: err } = await supabase.from('reservations').insert({
      book_id: bookId,
      member_id: memberId,
      status: 'pending',
      notes: notes || null,
    });

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }
    if (profile) {
      const book = books.find((b) => b.id === bookId);
      const member = members.find((m) => m.id === memberId);
      await logAction(profile.id, 'reservation_create', 'reservation', undefined, {
        book: book?.title,
        member: member?.full_name,
      });
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/40 animate-fade-in" onClick={onClose}>
      <div className="card max-w-md w-full animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-ink-100">
          <h2 className="font-serif text-lg font-semibold text-ink-900">New reservation</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="label">Book <span className="text-rust-500">*</span></label>
            <select required value={bookId} onChange={(e) => setBookId(e.target.value)} className="input">
              <option value="">Select a book…</option>
              {books.map((b) => (
                <option key={b.id} value={b.id}>{b.title} — {b.author}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Member <span className="text-rust-500">*</span></label>
            <select required value={memberId} onChange={(e) => setMemberId(e.target.value)} className="input">
              <option value="">Select a member…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.full_name} ({m.member_code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input" rows={2} />
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
              <Bookmark className="h-4 w-4" /> {saving ? 'Saving…' : 'Create reservation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
