import { useState, useEffect, useMemo, FormEvent } from 'react';
import { Search, BookOpen, Filter, X, ChevronRight, Library, MapPin, Bookmark, User, Mail, Phone, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Logo } from '@/components/Logo';
import { SyncStatus } from '@/components/SyncStatus';
import type { Book, Copy } from '@/types';
import { getAvailability, generateMemberCode } from '@/lib/utils';

interface BookWithCopies extends Book {
  copies: Copy[];
}

export function OPACPage() {
  const [books, setBooks] = useState<BookWithCopies[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string>('');
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('');
  const [selectedBook, setSelectedBook] = useState<BookWithCopies | null>(null);
  const [reserveBook, setReserveBook] = useState<BookWithCopies | null>(null);
  const [subjects, setSubjects] = useState<string[]>([]);

  useEffect(() => {
    async function loadBooks() {
      setLoading(true);
      const { data, error } = await supabase
        .from('books')
        .select('*, copies(*)')
        .order('title');

      if (error) {
        console.error('Failed to load catalog:', error.message);
      } else if (data) {
        setBooks(data as BookWithCopies[]);
        const uniqueSubjects = [...new Set(data.map((b) => b.subject).filter(Boolean))] as string[];
        setSubjects(uniqueSubjects.sort());
      }
      setLoading(false);
    }
    loadBooks();
  }, []);

  const filtered = useMemo(() => {
    let result = books;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q) ||
          (b.subject ?? '').toLowerCase().includes(q) ||
          (b.isbn ?? '').toLowerCase().includes(q) ||
          (b.call_number ?? '').toLowerCase().includes(q)
      );
    }
    if (subjectFilter) {
      result = result.filter((b) => b.subject === subjectFilter);
    }
    if (availabilityFilter === 'available') {
      result = result.filter((b) => getAvailability(b.copies).available > 0);
    }
    return result;
  }, [books, search, subjectFilter, availabilityFilter]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
  }

  return (
    <div className="min-h-screen bg-ink-50">
      {/* Header */}
      <header className="bg-white border-b border-ink-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <Logo />
            <div className="flex items-center gap-3">
              <SyncStatus />
              <a
                href="#/staff/login"
                className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-forest-600 hover:text-forest-700"
              >
                Staff sign in
                <ChevronRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Hero / Search */}
      <section className="bg-gradient-to-b from-forest-800 to-forest-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <div className="text-center max-w-2xl mx-auto">
            <h1 className="font-serif text-2xl sm:text-3xl font-medium leading-tight">
              Search the Nubuke Foundation Library
            </h1>
            <p className="mt-2 text-forest-200 text-sm sm:text-base">
              Browse our collection and check real-time availability — no account needed.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="mt-6 max-w-2xl mx-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-ink-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title, author, subject, or ISBN…"
                className="w-full rounded-xl border-0 bg-white pl-12 pr-4 py-3.5 text-base text-ink-900 placeholder-ink-400 shadow-lg focus:outline-none focus:ring-2 focus:ring-gold-400"
                autoFocus
              />
            </div>
          </form>
        </div>
      </section>

      {/* Filters bar */}
      <div className="bg-white border-b border-ink-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-sm text-ink-500">
              <Filter className="h-4 w-4" />
              Filters:
            </div>
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm text-ink-700 focus:outline-none focus:border-forest-500"
            >
              <option value="">All subjects</option>
              {subjects.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={availabilityFilter}
              onChange={(e) => setAvailabilityFilter(e.target.value)}
              className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm text-ink-700 focus:outline-none focus:border-forest-500"
            >
              <option value="">Any availability</option>
              <option value="available">Available now</option>
            </select>
            {(subjectFilter || availabilityFilter) && (
              <button
                onClick={() => { setSubjectFilter(''); setAvailabilityFilter(''); }}
                className="flex items-center gap-1 text-sm text-ink-500 hover:text-ink-700"
              >
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            )}
            <div className="ml-auto text-sm text-ink-500">
              {loading ? 'Loading…' : `${filtered.length} ${filtered.length === 1 ? 'result' : 'results'}`}
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card p-5 animate-pulse">
                <div className="h-32 bg-ink-100 rounded-lg mb-4" />
                <div className="h-4 bg-ink-100 rounded mb-2 w-3/4" />
                <div className="h-3 bg-ink-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Library className="h-12 w-12 text-ink-300 mx-auto mb-3" />
            <p className="text-ink-500 font-medium">No books found</p>
            <p className="text-sm text-ink-400 mt-1">Try a different search or adjust filters.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((book) => {
              const { available, total } = getAvailability(book.copies);
              return (
                <button
                  key={book.id}
                  onClick={() => setSelectedBook(book)}
                  className="card p-5 text-left hover:shadow-md hover:border-forest-300 transition-all duration-150 group"
                >
                  <div className="flex gap-4">
                    <div className="shrink-0">
                      {book.cover_image_url ? (
                        <img
                          src={book.cover_image_url}
                          alt={book.title}
                          className="h-24 w-16 rounded-md object-cover shadow-sm"
                        />
                      ) : (
                        <div className="book-cover-placeholder h-24 w-16 rounded-md shadow-sm text-[10px] text-center px-1 leading-tight">
                          {book.title.slice(0, 20)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-serif text-base font-semibold text-ink-900 line-clamp-2 group-hover:text-forest-700 transition-colors">
                        {book.title}
                      </h3>
                      <p className="text-sm text-ink-500 mt-0.5">{book.author}</p>
                      {book.subject && (
                        <span className="inline-block mt-2 text-xs font-medium text-forest-600 bg-forest-50 rounded-full px-2 py-0.5">
                          {book.subject}
                        </span>
                      )}
                      <div className="mt-3">
                        {total === 0 ? (
                          <span className="text-xs text-ink-400">No copies recorded</span>
                        ) : available > 0 ? (
                          <span className="badge-available">{available} of {total} available</span>
                        ) : (
                          <span className="badge-borrowed">All {total} copies out</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selectedBook && (
        <BookDetailModal book={selectedBook} onClose={() => setSelectedBook(null)} onReserve={() => setReserveBook(selectedBook)} />
      )}

      {/* Reserve modal */}
      {reserveBook && (
        <ReserveModal book={reserveBook} onClose={() => setReserveBook(null)} />
      )}

      {/* Footer */}
      <footer className="border-t border-ink-200 bg-white mt-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-ink-500">
            <MapPin className="h-4 w-4" />
            Nubuke Foundation · Ghana
          </div>
          <p className="text-xs text-ink-400">
            Online Public Access Catalog · {books.length} titles in collection
          </p>
        </div>
      </footer>
    </div>
  );
}

function BookDetailModal({ book, onReserve, onClose }: { book: BookWithCopies; onReserve: () => void; onClose: () => void }) {
  const { available, total } = getAvailability(book.copies);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/40 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="card max-w-2xl w-full max-h-[85vh] overflow-y-auto animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end p-3">
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 pb-6 flex gap-6">
          <div className="shrink-0">
            {book.cover_image_url ? (
              <img src={book.cover_image_url} alt={book.title} className="h-40 w-28 rounded-lg object-cover shadow-md" />
            ) : (
              <div className="book-cover-placeholder h-40 w-28 rounded-lg shadow-md text-xs text-center px-2 leading-tight">
                {book.title.slice(0, 25)}
              </div>
            )}
          </div>
          <div className="flex-1">
            <h2 className="font-serif text-xl font-semibold text-ink-900">{book.title}</h2>
            <p className="text-ink-600 mt-1">{book.author}</p>
            <div className="mt-4 space-y-2 text-sm">
              {book.subject && <DetailRow label="Subject" value={book.subject} />}
              {book.call_number && <DetailRow label="Call number" value={book.call_number} />}
              {book.publisher && <DetailRow label="Publisher" value={book.publisher} />}
              {book.publication_year && <DetailRow label="Year" value={String(book.publication_year)} />}
              {book.isbn && <DetailRow label="ISBN" value={book.isbn} />}
            </div>
            <div className="mt-4">
              {total === 0 ? (
                <span className="text-sm text-ink-400">No copies in the system.</span>
              ) : available > 0 ? (
                <span className="badge-available text-sm">{available} of {total} copies available</span>
              ) : (
                <span className="badge-borrowed text-sm">All {total} copies currently borrowed</span>
              )}
            </div>
            {book.description && (
              <p className="mt-4 text-sm text-ink-600 leading-relaxed">{book.description}</p>
            )}
            <button
              onClick={() => { onClose(); onReserve(); }}
              className="btn-primary w-full mt-5"
            >
              <Bookmark className="h-4 w-4" /> Reserve this book
            </button>
            <p className="text-xs text-ink-400 mt-2 text-center">
              Library staff will hold the book for you and contact you when it's ready.
            </p>
          </div>
        </div>
        <div className="px-6 pb-6">
          <h3 className="text-sm font-semibold text-ink-700 mb-3">Copy status</h3>
          <div className="space-y-2">
            {book.copies.map((copy) => (
              <div key={copy.id} className="flex items-center justify-between rounded-lg border border-ink-100 px-3 py-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-ink-400" />
                  <span className="text-sm font-mono text-ink-700">{copy.copy_code}</span>
                </div>
                <span className={`badge-${copy.status}`}>{copy.status.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-ink-400 w-24 shrink-0">{label}</span>
      <span className="text-ink-700">{value}</span>
    </div>
  );
}

function ReserveModal({ book, onClose }: { book: BookWithCopies; onClose: () => void }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || (!email.trim() && !phone.trim())) {
      setError('Please enter your name and either an email or phone number.');
      return;
    }
    setSaving(true);
    setError(null);

    const { data: members, error: loadErr } = await supabase
      .from('members')
      .select('id, member_code, email, phone');
    if (loadErr) {
      setError('Could not reach the library system. Please try again.');
      setSaving(false);
      return;
    }

    const existing = (members ?? []) as { id: string; member_code: string; email: string | null; phone: string | null }[];
    const match = existing.find(
      (m) =>
        (!!email.trim() && m.email?.toLowerCase() === email.trim().toLowerCase()) ||
        (!!phone.trim() && m.phone === phone.trim())
    );

    let memberId = match?.id;
    if (!match) {
      const { data: newMember, error: insertErr } = await supabase
        .from('members')
        .insert({
          full_name: fullName.trim(),
          member_code: generateMemberCode(existing.map((m) => m.member_code)),
          email: email.trim() || null,
          phone: phone.trim() || null,
          membership_status: 'active',
        })
        .select('id')
        .single();
      if (insertErr || !newMember) {
        setError('Could not save your details. Please try again.');
        setSaving(false);
        return;
      }
      memberId = newMember.id;
    }

    const contact = [email.trim(), phone.trim()].filter(Boolean).join(' · ');
    const { error: resErr } = await supabase.from('reservations').insert({
      book_id: book.id,
      member_id: memberId,
      status: 'pending',
      notes: notes.trim()
        ? `${notes.trim()}${contact ? ` (contact: ${contact})` : ''}`
        : contact || null,
    });
    if (resErr) {
      setError('Could not place the reservation. Please try again.');
      setSaving(false);
      return;
    }
    setSaving(false);
    setDone(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/40 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="card max-w-md w-full animate-scale-in max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-ink-100">
          <h2 className="font-serif text-lg font-semibold text-ink-900">Reserve a book</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {done ? (
          <div className="p-6 text-center">
            <CheckCircle className="h-12 w-12 text-forest-600 mx-auto mb-3" />
            <h3 className="font-serif text-lg font-semibold text-ink-900">Reservation placed</h3>
            <p className="text-sm text-ink-600 mt-2 leading-relaxed">
              We've reserved <span className="font-medium">{book.title}</span> for you. Library staff
              will hold it and contact you when it's ready for pickup.
            </p>
            <button onClick={onClose} className="btn-primary w-full mt-5">Done</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="flex items-center gap-3 rounded-lg bg-ink-50 px-3 py-2.5">
              {book.cover_image_url ? (
                <img src={book.cover_image_url} alt={book.title} className="h-12 w-8 rounded object-cover shadow-sm" />
              ) : (
                <div className="book-cover-placeholder h-12 w-8 rounded text-[6px] text-center px-0.5 leading-tight">
                  {book.title.slice(0, 12)}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink-900 truncate">{book.title}</p>
                <p className="text-xs text-ink-500">{book.author}</p>
              </div>
            </div>

            <div>
              <label className="label">Your full name <span className="text-rust-500">*</span></label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Ama Mensah"
                  className="input pl-10"
                />
              </div>
            </div>
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input pl-10"
                />
              </div>
            </div>
            <div>
              <label className="label">Phone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 024 000 0000"
                  className="input pl-10"
                />
              </div>
            </div>
            <p className="text-xs text-ink-400">Please provide at least one contact so the library can reach you.</p>

            <div>
              <label className="label">Note for the library (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Anything staff should know?"
                className="input"
              />
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
                <Bookmark className="h-4 w-4" /> {saving ? 'Placing…' : 'Place reservation'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
