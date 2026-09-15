import { useEffect, useState, useRef, FormEvent } from 'react';
import { ArrowRightLeft, Search, ArrowRight, RotateCcw, AlertCircle, Check, User, Book as BookIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { logAction } from '@/lib/audit';
import { formatDate, isOverdue, defaultDueDate, daysUntilDue } from '@/lib/utils';
import type { Loan, Copy, Member, Book } from '@/types';

type Tab = 'checkout' | 'return' | 'overdue';

export function CirculationPage() {
  const [tab, setTab] = useState<Tab>('checkout');

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-ink-900">Circulation</h1>
        <p className="text-sm text-ink-500 mt-1">Check out and return books. Scan or type codes — barcode scanners work automatically.</p>
      </div>

      <div className="flex gap-1 mb-6 bg-ink-100 rounded-lg p-1 w-fit">
        <TabButton active={tab === 'checkout'} onClick={() => setTab('checkout')} icon={ArrowRight} label="Check out" />
        <TabButton active={tab === 'return'} onClick={() => setTab('return')} icon={RotateCcw} label="Return" />
        <TabButton active={tab === 'overdue'} onClick={() => setTab('overdue')} icon={AlertCircle} label="Overdue" />
      </div>

      {tab === 'checkout' && <CheckoutPanel />}
      {tab === 'return' && <ReturnPanel />}
      {tab === 'overdue' && <OverduePanel />}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Search; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
        active ? 'bg-white text-forest-700 shadow-sm' : 'text-ink-500 hover:text-ink-700'
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function CheckoutPanel() {
  const { profile } = useAuth();
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [copyQuery, setCopyQuery] = useState('');
  const [copyResult, setCopyResult] = useState<(Copy & { books: Book }) | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState(defaultDueDate());
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const copyInputRef = useRef<HTMLInputElement>(null);
  const memberInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    memberInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (selectedMember) {
      copyInputRef.current?.focus();
    }
  }, [selectedMember]);

  async function searchMembers(q: string) {
    setMemberQuery(q);
    if (q.trim().length < 1) {
      setMemberResults([]);
      return;
    }
    const { data } = await supabase
      .from('members')
      .select('*')
      .or(`full_name.ilike.%${q}%,member_code.ilike.%${q}%`)
      .limit(10);
    setMemberResults(data ?? []);
  }

  async function lookupCopy(code: string) {
    setCopyQuery(code);
    setCopyError(null);
    setCopyResult(null);
    if (!code.trim()) return;

    const { data, error: err } = await supabase
      .from('copies')
      .select('*, books(*)')
      .eq('copy_code', code.trim())
      .maybeSingle();

    if (err) {
      setCopyError(err.message);
      return;
    }
    if (!data) {
      setCopyError(`No copy found with code "${code.trim()}".`);
      return;
    }
    if (data.status !== 'available') {
      setCopyError(`Copy ${code.trim()} is currently ${data.status.replace('_', ' ')}.`);
      return;
    }
    setCopyResult(data as Copy & { books: Book });
  }

  async function handleCheckout(e: FormEvent) {
    e.preventDefault();
    if (!selectedMember || !copyResult || !profile) return;
    setError(null);
    setSuccess(null);

    if (selectedMember.membership_status !== 'active') {
      setError(`Member ${selectedMember.full_name} is ${selectedMember.membership_status}. Cannot check out.`);
      return;
    }

    const { data: loan, error: err } = await supabase
      .from('loans')
      .insert({
        copy_id: copyResult.id,
        member_id: selectedMember.id,
        staff_id: profile.id,
        due_date: dueDate,
        status: 'active',
      })
      .select()
      .single();

    if (err) {
      setError(err.message);
      return;
    }

    await supabase.from('copies').update({ status: 'borrowed' }).eq('id', copyResult.id);
    await logAction(profile.id, 'checkout', 'loan', loan.id, {
      copy_code: copyResult.copy_code,
      member: selectedMember.full_name,
    });

    setSuccess(`Checked out "${copyResult.books.title}" to ${selectedMember.full_name}. Due ${formatDate(dueDate)}.`);

    // Reset for next checkout
    setCopyQuery('');
    setCopyResult(null);
    setCopyError(null);
    copyInputRef.current?.focus();
  }

  function resetMember() {
    setSelectedMember(null);
    setMemberQuery('');
    setMemberResults([]);
    memberInputRef.current?.focus();
  }

  return (
    <div className="space-y-6">
      {success && (
        <div className="flex items-center gap-2 rounded-lg bg-forest-50 px-4 py-3 text-sm text-forest-700 animate-slide-up">
          <Check className="h-5 w-5" /> {success}
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-rust-50 px-4 py-3 text-sm text-rust-700">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {/* Member selection */}
      <div className="card p-5">
        <h2 className="font-semibold text-ink-900 mb-3 flex items-center gap-2">
          <User className="h-4 w-4 text-ink-400" /> Member
        </h2>
        {selectedMember ? (
          <div className="flex items-center justify-between rounded-lg bg-forest-50 px-4 py-3">
            <div>
              <p className="font-medium text-ink-900">{selectedMember.full_name}</p>
              <p className="text-sm text-ink-500 font-mono">{selectedMember.member_code}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`badge-${selectedMember.membership_status}`}>{selectedMember.membership_status}</span>
              <button onClick={resetMember} className="btn-ghost text-sm">Change</button>
            </div>
          </div>
        ) : (
          <div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
              <input
                ref={memberInputRef}
                value={memberQuery}
                onChange={(e) => searchMembers(e.target.value)}
                placeholder="Type member name or code (or scan member card)…"
                className="input pl-10"
              />
            </div>
            {memberResults.length > 0 && (
              <div className="mt-2 space-y-1">
                {memberResults.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { setSelectedMember(m); setMemberResults([]); setMemberQuery(''); }}
                    className="w-full flex items-center justify-between rounded-lg border border-ink-100 px-4 py-2.5 hover:bg-ink-50 transition-colors text-left"
                  >
                    <div>
                      <p className="font-medium text-ink-800">{m.full_name}</p>
                      <p className="text-xs text-ink-500 font-mono">{m.member_code}</p>
                    </div>
                    <span className={`badge-${m.membership_status}`}>{m.membership_status}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Book / copy lookup */}
      {selectedMember && (
        <form onSubmit={handleCheckout} className="card p-5 space-y-4 animate-fade-in">
          <h2 className="font-semibold text-ink-900 flex items-center gap-2">
            <BookIcon className="h-4 w-4 text-ink-400" /> Book copy
          </h2>
          <div>
            <label className="label">Copy code (type or scan barcode)</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
              <input
                ref={copyInputRef}
                value={copyQuery}
                onChange={(e) => lookupCopy(e.target.value)}
                placeholder="Scan or type copy code, then press Enter…"
                className="input pl-10 font-mono"
              />
            </div>
          </div>

          {copyError && (
            <div className="flex items-start gap-2 rounded-lg bg-rust-50 px-3 py-2.5 text-sm text-rust-700">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {copyError}
            </div>
          )}

          {copyResult && (
            <div className="rounded-lg bg-forest-50 px-4 py-3 animate-slide-up">
              <p className="font-medium text-ink-900">{copyResult.books.title}</p>
              <p className="text-sm text-ink-500">{copyResult.books.author}</p>
              <p className="text-xs text-ink-400 font-mono mt-1">{copyResult.copy_code}</p>
            </div>
          )}

          <div>
            <label className="label">Due date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input" />
          </div>

          <button
            type="submit"
            disabled={!copyResult}
            className="btn-primary w-full"
          >
            <ArrowRight className="h-4 w-4" /> Complete checkout
          </button>
        </form>
      )}
    </div>
  );
}

function ReturnPanel() {
  const { profile } = useAuth();
  const [copyQuery, setCopyQuery] = useState('');
  const [copyResult, setCopyResult] = useState<(Copy & { books: Book }) | null>(null);
  const [activeLoan, setActiveLoan] = useState<(Loan & { members: Member }) | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function lookupCopy(code: string) {
    setCopyQuery(code);
    setCopyError(null);
    setCopyResult(null);
    setActiveLoan(null);
    if (!code.trim()) return;

    const { data: copy, error: err } = await supabase
      .from('copies')
      .select('*, books(*)')
      .eq('copy_code', code.trim())
      .maybeSingle();

    if (err) {
      setCopyError(err.message);
      return;
    }
    if (!copy) {
      setCopyError(`No copy found with code "${code.trim()}".`);
      return;
    }
    setCopyResult(copy as Copy & { books: Book });

    if (copy.status === 'borrowed') {
      const { data: loan } = await supabase
        .from('loans')
        .select('*, members(*)')
        .eq('copy_id', copy.id)
        .eq('status', 'active')
        .maybeSingle();
      if (loan) setActiveLoan(loan as Loan & { members: Member });
    }
  }

  async function handleReturn(e: FormEvent) {
    e.preventDefault();
    if (!copyResult || !profile) return;
    setError(null);
    setSuccess(null);

    if (!activeLoan) {
      setError(`Copy ${copyResult.copy_code} is not currently checked out.`);
      return;
    }

    const { error: err } = await supabase
      .from('loans')
      .update({ returned_at: new Date().toISOString(), status: 'returned' })
      .eq('id', activeLoan.id);

    if (err) {
      setError(err.message);
      return;
    }

    await supabase.from('copies').update({ status: 'available' }).eq('id', copyResult.id);
    await logAction(profile.id, 'return', 'loan', activeLoan.id, {
      copy_code: copyResult.copy_code,
      member: activeLoan.members.full_name,
    });

    setSuccess(`Returned "${copyResult.books.title}" (${copyResult.copy_code}). Book is now available.`);

    setCopyQuery('');
    setCopyResult(null);
    setActiveLoan(null);
    inputRef.current?.focus();
  }

  return (
    <div className="space-y-6">
      {success && (
        <div className="flex items-center gap-2 rounded-lg bg-forest-50 px-4 py-3 text-sm text-forest-700 animate-slide-up">
          <Check className="h-5 w-5" /> {success}
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-rust-50 px-4 py-3 text-sm text-rust-700">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      <form onSubmit={handleReturn} className="card p-5 space-y-4">
        <h2 className="font-semibold text-ink-900 flex items-center gap-2">
          <RotateCcw className="h-4 w-4 text-ink-400" /> Return a book
        </h2>
        <div>
          <label className="label">Copy code (type or scan barcode)</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
            <input
              ref={inputRef}
              value={copyQuery}
              onChange={(e) => lookupCopy(e.target.value)}
              placeholder="Scan or type copy code, then press Enter…"
              className="input pl-10 font-mono"
            />
          </div>
        </div>

        {copyError && (
          <div className="flex items-start gap-2 rounded-lg bg-rust-50 px-3 py-2.5 text-sm text-rust-700">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {copyError}
          </div>
        )}

        {copyResult && (
          <div className="rounded-lg bg-ink-50 px-4 py-3 animate-slide-up">
            <p className="font-medium text-ink-900">{copyResult.books.title}</p>
            <p className="text-sm text-ink-500">{copyResult.books.author}</p>
            <p className="text-xs text-ink-400 font-mono mt-1">{copyResult.copy_code}</p>
            <p className="text-xs text-ink-500 mt-1">Status: {copyResult.status.replace('_', ' ')}</p>
          </div>
        )}

        {activeLoan && (
          <div className="rounded-lg bg-kente-50 px-4 py-3">
            <p className="text-sm text-ink-700">
              Borrowed by <span className="font-medium">{activeLoan.members.full_name}</span>
            </p>
            <p className="text-xs text-ink-500 mt-0.5">
              Due {formatDate(activeLoan.due_date)}
              {isOverdue(activeLoan.due_date, activeLoan.returned_at) && (
                <span className="text-rust-600 font-medium ml-2">
                  ({Math.abs(daysUntilDue(activeLoan.due_date))} days overdue)
                </span>
              )}
            </p>
          </div>
        )}

        <button type="submit" disabled={!activeLoan} className="btn-primary w-full">
          <RotateCcw className="h-4 w-4" /> Mark returned
        </button>
      </form>
    </div>
  );
}

function OverduePanel() {
  const [overdueLoans, setOverdueLoans] = useState<(Loan & { copies: Copy; members: Member; copies_books?: Book })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('loans')
        .select('*, copies(*), members(*)')
        .eq('status', 'active')
        .order('due_date', { ascending: true });

      const overdue = (data ?? []).filter((l) => isOverdue(l.due_date, l.returned_at));
      // Fetch book info for each copy
      const copyIds = overdue.map((l) => l.copies?.book_id).filter(Boolean);
      if (copyIds.length > 0) {
        const { data: books } = await supabase.from('books').select('*').in('id', copyIds);
        const bookMap = new Map(books?.map((b) => [b.id, b]) ?? []);
        const enriched = overdue.map((l) => ({
          ...l,
          copies_book: bookMap.get(l.copies?.book_id ?? ''),
        }));
        setOverdueLoans(enriched as (Loan & { copies: Copy; members: Member; copies_book?: Book })[]);
      } else {
        setOverdueLoans(overdue as (Loan & { copies: Copy; members: Member })[]);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <p className="text-ink-500">Loading overdue items…</p>;

  if (overdueLoans.length === 0) {
    return (
      <div className="card p-8 text-center">
        <Check className="h-10 w-10 text-forest-500 mx-auto mb-2" />
        <p className="font-medium text-ink-700">No overdue items</p>
        <p className="text-sm text-ink-400 mt-1">All active loans are within their due dates.</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3 bg-rust-50 border-b border-rust-100">
        <p className="text-sm font-medium text-rust-700">{overdueLoans.length} overdue {overdueLoans.length === 1 ? 'item' : 'items'}</p>
      </div>
      <table className="w-full">
        <thead className="bg-ink-50 border-b border-ink-200">
          <tr>
            <th className="text-left text-xs font-semibold text-ink-500 uppercase tracking-wider px-4 py-3">Member</th>
            <th className="text-left text-xs font-semibold text-ink-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Book</th>
            <th className="text-left text-xs font-semibold text-ink-500 uppercase tracking-wider px-4 py-3">Copy code</th>
            <th className="text-left text-xs font-semibold text-ink-500 uppercase tracking-wider px-4 py-3">Due date</th>
            <th className="text-left text-xs font-semibold text-ink-500 uppercase tracking-wider px-4 py-3">Days overdue</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {overdueLoans.map((loan) => (
            <tr key={loan.id} className="table-row-hover">
              <td className="px-4 py-3">
                <p className="font-medium text-ink-900">{loan.members.full_name}</p>
                <p className="text-xs text-ink-400 font-mono">{loan.members.member_code}</p>
              </td>
              <td className="px-4 py-3 text-sm text-ink-600 hidden sm:table-cell">
                {(loan as { copies_book?: Book }).copies_book?.title ?? '—'}
              </td>
              <td className="px-4 py-3 text-sm font-mono text-ink-600">{loan.copies?.copy_code}</td>
              <td className="px-4 py-3 text-sm text-ink-600">{formatDate(loan.due_date)}</td>
              <td className="px-4 py-3">
                <span className="badge-overdue">{Math.abs(daysUntilDue(loan.due_date))} days</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
