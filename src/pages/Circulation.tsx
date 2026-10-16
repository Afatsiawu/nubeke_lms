import { useEffect, useState, useRef, FormEvent, useCallback } from 'react';
import { Search, ArrowRight, RotateCcw, AlertCircle, Check, User, Book as BookIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { logAction } from '@/lib/audit';
import { formatDate, isOverdue, defaultDueDate, daysUntilDue } from '@/lib/utils';
import { enqueueOp, isOnline } from '@/lib/offline-queue';
import type { Loan, Copy, Member, Book } from '@/types';

type Tab = 'checkout' | 'return' | 'overdue';

export function CirculationPage() {
  const [tab, setTab] = useState<Tab>('checkout');

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-ink-900">Circulation</h1>
        <p className="text-sm text-ink-500 mt-1">Check out and return books by searching for the title.</p>
      </div>

      <div className="flex gap-1 mb-6 bg-ink-100 rounded-lg p-1 w-fit max-w-full overflow-x-auto">
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

interface BookWithAvailableCopies extends Book {
  copies: Copy[];
}

function CheckoutPanel() {
  const { profile } = useAuth();
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [bookQuery, setBookQuery] = useState('');
  const [bookResults, setBookResults] = useState<BookWithAvailableCopies[]>([]);
  const [selectedCopy, setSelectedCopy] = useState<(Copy & { books: Book }) | null>(null);
  const [searching, setSearching] = useState(false);
  const [dueDate, setDueDate] = useState(defaultDueDate());
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bookInputRef = useRef<HTMLInputElement>(null);
  const memberInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    memberInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (selectedMember && !selectedCopy) {
      bookInputRef.current?.focus();
    }
  }, [selectedMember, selectedCopy]);

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

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchBooks = useCallback((q: string) => {
    setBookQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.trim().length < 1) {
      setBookResults([]);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      const sanitized = q.trim().replace(/[%_]/g, '');
      if (!sanitized) {
        setSearching(false);
        return;
      }
      const { data, error } = await supabase
        .from('books')
        .select('*, copies(*)')
        .or(`title.ilike.%${sanitized}%,author.ilike.%${sanitized}%`)
        .order('title')
        .limit(15);

      if (error) {
        setSearching(false);
        return;
      }
      const withAvailable = (data ?? []).filter(
        (b) => b.copies?.some((c: Copy) => c.status === 'available')
      ) as BookWithAvailableCopies[];
      setBookResults(withAvailable);
      setSearching(false);
    }, 250);
  }, []);

  function selectBook(book: BookWithAvailableCopies) {
    const available = book.copies.find((c) => c.status === 'available');
    if (!available) return;
    setSelectedCopy({ ...available, books: book });
    setBookQuery('');
    setBookResults([]);
  }

  async function handleCheckout(e: FormEvent) {
    e.preventDefault();
    if (!selectedMember || !selectedCopy || !profile) return;
    setError(null);
    setSuccess(null);

    if (selectedMember.membership_status !== 'active') {
      setError(`Member ${selectedMember.full_name} is ${selectedMember.membership_status}. Cannot check out.`);
      return;
    }

    const loanPayload = {
      copy_id: selectedCopy.id,
      member_id: selectedMember.id,
      staff_id: profile.id,
      borrowed_at: new Date().toISOString(),
      due_date: dueDate,
      status: 'active',
    };

    if (!isOnline()) {
      await enqueueOp('loan_insert', 'loans', loanPayload, {
        filters: { copy_id: selectedCopy.id },
        staffId: profile.id,
        auditAction: 'checkout',
        auditEntityType: 'loan',
        auditDetails: {
          copy_code: selectedCopy.copy_code,
          member: selectedMember.full_name,
        },
      });
      setSuccess(`Queued: "${selectedCopy.books.title}" checked out to ${selectedMember.full_name}. Will sync when online.`);
      setSelectedCopy(null);
      bookInputRef.current?.focus();
      return;
    }

    const { data: loan, error: err } = await supabase
      .from('loans')
      .insert(loanPayload)
      .select()
      .single();

    if (err) {
      setError(err.message);
      return;
    }

    await supabase.from('copies').update({ status: 'borrowed' }).eq('id', selectedCopy.id);
    await logAction(profile.id, 'checkout', 'loan', loan.id, {
      copy_code: selectedCopy.copy_code,
      member: selectedMember.full_name,
    });

    setSuccess(`Checked out "${selectedCopy.books.title}" to ${selectedMember.full_name}. Due ${formatDate(dueDate)}.`);

    setSelectedCopy(null);
    bookInputRef.current?.focus();
  }

  function resetMember() {
    setSelectedMember(null);
    setMemberQuery('');
    setMemberResults([]);
    setSelectedCopy(null);
    setBookQuery('');
    setBookResults([]);
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
                placeholder="Type member name or code…"
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

      {/* Book search and selection */}
      {selectedMember && (
        <form onSubmit={handleCheckout} className="card p-5 space-y-4 animate-fade-in">
          <h2 className="font-semibold text-ink-900 flex items-center gap-2">
            <BookIcon className="h-4 w-4 text-ink-400" /> Book
          </h2>

          {selectedCopy ? (
            <div className="rounded-lg bg-forest-50 px-4 py-3 animate-slide-up">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-ink-900">{selectedCopy.books.title}</p>
                  <p className="text-sm text-ink-500">{selectedCopy.books.author}</p>
                  <p className="text-xs text-ink-400 font-mono mt-1">{selectedCopy.copy_code}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedCopy(null); bookInputRef.current?.focus(); }}
                  className="btn-ghost text-sm"
                >
                  Change
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="label">Search for a book by title or author</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
                <input
                  ref={bookInputRef}
                  value={bookQuery}
                  onChange={(e) => searchBooks(e.target.value)}
                  placeholder="Type a book title or author name…"
                  className="input pl-10"
                />
                {searching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="h-4 w-4 border-2 border-ink-300 border-t-forest-500 rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {bookResults.length > 0 && (
                <div className="mt-2 space-y-1 max-h-72 overflow-y-auto">
                  {bookResults.map((book) => {
                    const avail = book.copies.filter((c) => c.status === 'available').length;
                    return (
                      <button
                        key={book.id}
                        type="button"
                        onClick={() => selectBook(book)}
                        className="w-full flex items-center justify-between rounded-lg border border-ink-100 px-4 py-2.5 hover:bg-forest-50 hover:border-forest-200 transition-colors text-left"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-ink-800 truncate">{book.title}</p>
                          <p className="text-xs text-ink-500">{book.author}</p>
                        </div>
                        <span className="shrink-0 ml-3 inline-flex items-center gap-1 rounded-full bg-forest-100 px-2.5 py-0.5 text-xs font-medium text-forest-700">
                          {avail} available
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {bookQuery.trim().length > 0 && bookResults.length === 0 && !searching && (
                <p className="mt-2 text-sm text-ink-400">
                  No available books found matching "{bookQuery.trim()}".
                </p>
              )}
            </div>
          )}

          <div>
            <label className="label">Due date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input" />
          </div>

          <button
            type="submit"
            disabled={!selectedCopy}
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
  const [bookQuery, setBookQuery] = useState('');
  const [bookResults, setBookResults] = useState<(Book & { copies: Copy[] })[]>([]);
  const [selectedCopy, setSelectedCopy] = useState<(Copy & { books: Book }) | null>(null);
  const [activeLoan, setActiveLoan] = useState<(Loan & { members: Member }) | null>(null);
  const [searching, setSearching] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [allActiveLoans, setAllActiveLoans] = useState<(Loan & { copies: Copy; members: Member })[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [showList, setShowList] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    loadActiveLoans();
  }, []);

  async function loadActiveLoans() {
    setLoadingList(true);
    const { data } = await supabase
      .from('loans')
      .select('*, copies(*), members(*)')
      .eq('status', 'active')
      .order('borrowed_at', { ascending: false });
    setAllActiveLoans((data ?? []) as (Loan & { copies: Copy; members: Member })[]);
    setLoadingList(false);
  }

  async function selectFromList(loan: Loan & { copies: Copy; members: Member }) {
    const { data: bookData } = await supabase
      .from('books')
      .select('*')
      .eq('id', loan.copies.book_id)
      .maybeSingle();
    const copyWithBook: Copy & { books: Book } = { ...loan.copies, books: bookData as Book };
    setSelectedCopy(copyWithBook);
    setActiveLoan(loan);
    setShowList(false);
  }

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchBooks = useCallback((q: string) => {
    setBookQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.trim().length < 1) {
      setBookResults([]);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      const sanitized = q.trim().replace(/[%_]/g, '');
      if (!sanitized) {
        setSearching(false);
        return;
      }
      const { data, error } = await supabase
        .from('books')
        .select('*, copies(*)')
        .or(`title.ilike.%${sanitized}%,author.ilike.%${sanitized}%`)
        .order('title')
        .limit(15);

      if (error) {
        setSearching(false);
        return;
      }
      const withBorrowed = (data ?? []).filter(
        (b) => b.copies?.some((c: Copy) => c.status === 'borrowed')
      ) as (Book & { copies: Copy[] })[];
      setBookResults(withBorrowed);
      setSearching(false);
    }, 250);
  }, []);

  async function selectBook(book: Book & { copies: Copy[] }) {
    const borrowed = book.copies.find((c) => c.status === 'borrowed');
    if (!borrowed) return;
    const copyWithBook: Copy & { books: Book } = { ...borrowed, books: book };
    setSelectedCopy(copyWithBook);
    setBookQuery('');
    setBookResults([]);

    const { data: loan } = await supabase
      .from('loans')
      .select('*, members(*)')
      .eq('copy_id', borrowed.id)
      .eq('status', 'active')
      .maybeSingle();
    if (loan) setActiveLoan(loan as Loan & { members: Member });
  }

  async function handleReturn(e: FormEvent) {
    e.preventDefault();
    if (!selectedCopy || !profile) return;
    setError(null);
    setSuccess(null);

    if (!activeLoan) {
      setError(`"${selectedCopy.books.title}" is not currently checked out.`);
      return;
    }

    const returnPayload = { returned_at: new Date().toISOString(), status: 'returned' };

    if (!isOnline()) {
      await enqueueOp('loan_update', 'loans', returnPayload, {
        filters: { id: activeLoan.id, copy_id: selectedCopy.id },
        staffId: profile.id,
        auditAction: 'return',
        auditEntityType: 'loan',
        auditDetails: {
          copy_code: selectedCopy.copy_code,
          member: activeLoan.members.full_name,
        },
      });
      setSuccess(`Queued: Returned "${selectedCopy.books.title}". Will sync when online.`);
      setSelectedCopy(null);
      setActiveLoan(null);
      inputRef.current?.focus();
      return;
    }

    const { error: err } = await supabase
      .from('loans')
      .update(returnPayload)
      .eq('id', activeLoan.id);

    if (err) {
      setError(err.message);
      return;
    }

    await supabase.from('copies').update({ status: 'available' }).eq('id', selectedCopy.id);
    await logAction(profile.id, 'return', 'loan', activeLoan.id, {
      copy_code: selectedCopy.copy_code,
      member: activeLoan.members.full_name,
    });

    setSuccess(`Returned "${selectedCopy.books.title}". Book is now available.`);

    setSelectedCopy(null);
    setActiveLoan(null);
    setShowList(true);
    await loadActiveLoans();
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

        {selectedCopy ? (
          <div className="rounded-lg bg-ink-50 px-4 py-3 animate-slide-up">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-ink-900">{selectedCopy.books.title}</p>
                <p className="text-sm text-ink-500">{selectedCopy.books.author}</p>
                <p className="text-xs text-ink-400 font-mono mt-1">{selectedCopy.copy_code}</p>
              </div>
              <button
                type="button"
                onClick={() => { setSelectedCopy(null); setActiveLoan(null); inputRef.current?.focus(); }}
                className="btn-ghost text-sm"
              >
                Change
              </button>
            </div>
          </div>
        ) : (
          <div>
            <label className="label">Search for the book to return</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
              <input
                ref={inputRef}
                value={bookQuery}
                onChange={(e) => searchBooks(e.target.value)}
                placeholder="Type a book title or author name…"
                className="input pl-10"
              />
              {searching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="h-4 w-4 border-2 border-ink-300 border-t-forest-500 rounded-full animate-spin" />
                </div>
              )}
            </div>

            {bookResults.length > 0 && (
              <div className="mt-2 space-y-1 max-h-72 overflow-y-auto">
                {bookResults.map((book) => {
                  const borrowed = book.copies.filter((c) => c.status === 'borrowed').length;
                  return (
                    <button
                      key={book.id}
                      type="button"
                      onClick={() => selectBook(book)}
                      className="w-full flex items-center justify-between rounded-lg border border-ink-100 px-4 py-2.5 hover:bg-forest-50 hover:border-forest-200 transition-colors text-left"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-ink-800 truncate">{book.title}</p>
                        <p className="text-xs text-ink-500">{book.author}</p>
                      </div>
                      <span className="shrink-0 ml-3 inline-flex items-center gap-1 rounded-full bg-kente-100 px-2.5 py-0.5 text-xs font-medium text-kente-700">
                        {borrowed} on loan
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {bookQuery.trim().length > 0 && bookResults.length === 0 && !searching && (
              <p className="mt-2 text-sm text-ink-400">
                No books on loan matching "{bookQuery.trim()}".
              </p>
            )}
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

      {/* All active checkouts list */}
      {!selectedCopy && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-ink-900 flex items-center gap-2">
              <BookIcon className="h-4 w-4 text-ink-400" /> All checked-out books
            </h2>
            <button
              type="button"
              onClick={() => setShowList(!showList)}
              className="text-sm text-forest-600 hover:text-forest-700"
            >
              {showList ? 'Hide' : 'Show'}
            </button>
          </div>
          {showList && (
            loadingList ? (
              <p className="text-sm text-ink-500">Loading checked-out books…</p>
            ) : allActiveLoans.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <Check className="h-8 w-8 text-forest-500 mx-auto mb-2" />
                <p className="text-sm text-ink-500">No books currently checked out.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {allActiveLoans.map((loan) => (
                  <button
                    key={loan.id}
                    type="button"
                    onClick={() => selectFromList(loan)}
                    className="w-full flex items-center justify-between rounded-lg border border-ink-100 px-4 py-3 hover:bg-forest-50 hover:border-forest-200 transition-colors text-left"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-ink-800 truncate">
                        {loan.members.full_name}
                      </p>
                      <p className="text-xs text-ink-500 font-mono">{loan.copies.copy_code}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3 flex flex-col items-end gap-1">
                      <span className="text-xs text-ink-500">Due {formatDate(loan.due_date)}</span>
                      {isOverdue(loan.due_date, loan.returned_at) ? (
                        <span className="text-xs font-medium text-rust-600">
                          {Math.abs(daysUntilDue(loan.due_date))} days overdue
                        </span>
                      ) : (
                        <span className="badge-active">active</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )
          )}
        </div>
      )}
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
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
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
    </div>
  );
}
