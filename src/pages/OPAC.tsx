import { useState, useEffect, useMemo, FormEvent } from 'react';
import { Search, BookOpen, Filter, X, ChevronRight, Library, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Logo } from '@/components/Logo';
import { SyncStatus } from '@/components/SyncStatus';
import type { Book, Copy } from '@/types';
import { getAvailability } from '@/lib/utils';

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
        <BookDetailModal book={selectedBook} onClose={() => setSelectedBook(null)} />
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

function BookDetailModal({ book, onClose }: { book: BookWithCopies; onClose: () => void }) {
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
