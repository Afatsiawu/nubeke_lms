import { useEffect, useState, FormEvent } from 'react';
import { Plus, Search, Edit2, Trash2, BookPlus, X, Save, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { logAction } from '@/lib/audit';
import { generateCopyCode, getAvailability } from '@/lib/utils';
import type { Book, Copy } from '@/types';

interface BookWithCopies extends Book {
  copies: Copy[];
}

export function CatalogingPage() {
  const { profile } = useAuth();
  const [books, setBooks] = useState<BookWithCopies[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingBook, setEditingBook] = useState<BookWithCopies | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [managingCopies, setManagingCopies] = useState<BookWithCopies | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBooks();
  }, []);

  async function loadBooks() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('books')
      .select('*, copies(*)')
      .order('title');
    if (err) {
      setError(err.message);
    } else {
      setBooks(data as BookWithCopies[]);
    }
    setLoading(false);
  }

  const filtered = books.filter((b) => {
    const q = search.toLowerCase();
    return (
      b.title.toLowerCase().includes(q) ||
      b.author.toLowerCase().includes(q) ||
      (b.isbn ?? '').toLowerCase().includes(q)
    );
  });

  async function handleDelete(book: BookWithCopies) {
    if (!confirm(`Remove "${book.title}" and all its copies? This cannot be undone.`)) return;
    const { error: err } = await supabase.from('books').delete().eq('id', book.id);
    if (err) {
      setError(err.message);
      return;
    }
    if (profile) {
      await logAction(profile.id, 'catalog_remove', 'book', book.id, { title: book.title });
    }
    await loadBooks();
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink-900">Catalog</h1>
          <p className="text-sm text-ink-500 mt-1">Add, edit, and manage book records.</p>
        </div>
        <button onClick={() => setShowAddForm(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> Add book
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-rust-50 px-3 py-2.5 text-sm text-rust-700">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, author, or ISBN…"
          className="input pl-10"
        />
      </div>

      {loading ? (
        <p className="text-ink-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-ink-500 font-medium">No books in the catalog yet</p>
          <p className="text-sm text-ink-400 mt-1">Click "Add book" to create your first entry.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-ink-50 border-b border-ink-200">
              <tr>
                <th className="text-left text-xs font-semibold text-ink-500 uppercase tracking-wider px-4 py-3">Title</th>
                <th className="text-left text-xs font-semibold text-ink-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Author</th>
                <th className="text-left text-xs font-semibold text-ink-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Subject</th>
                <th className="text-left text-xs font-semibold text-ink-500 uppercase tracking-wider px-4 py-3">Copies</th>
                <th className="text-right text-xs font-semibold text-ink-500 uppercase tracking-wider px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filtered.map((book) => {
                const { available, total } = getAvailability(book.copies);
                return (
                  <tr key={book.id} className="table-row-hover">
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink-900">{book.title}</p>
                      <p className="text-xs text-ink-400 sm:hidden">{book.author}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-ink-600 hidden sm:table-cell">{book.author}</td>
                    <td className="px-4 py-3 text-sm text-ink-600 hidden md:table-cell">{book.subject ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-ink-700">{available}/{total}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setManagingCopies(book)}
                          className="rounded-lg p-2 text-ink-500 hover:bg-forest-50 hover:text-forest-600"
                          title="Manage copies"
                        >
                          <BookPlus className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setEditingBook(book)}
                          className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-700"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(book)}
                          className="rounded-lg p-2 text-ink-500 hover:bg-rust-50 hover:text-rust-600"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(showAddForm || editingBook) && (
        <BookFormModal
          book={editingBook}
          onClose={() => { setShowAddForm(false); setEditingBook(null); }}
          onSaved={async () => { setShowAddForm(false); setEditingBook(null); await loadBooks(); }}
        />
      )}

      {managingCopies && (
        <CopiesModal
          book={managingCopies}
          onClose={() => setManagingCopies(null)}
          onSaved={async () => { setManagingCopies(null); await loadBooks(); }}
        />
      )}
    </div>
  );
}

function BookFormModal({
  book,
  onClose,
  onSaved,
}: {
  book: BookWithCopies | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { profile } = useAuth();
  const [form, setForm] = useState({
    title: book?.title ?? '',
    author: book?.author ?? '',
    subject: book?.subject ?? '',
    call_number: book?.call_number ?? '',
    publisher: book?.publisher ?? '',
    publication_year: book?.publication_year?.toString() ?? '',
    isbn: book?.isbn ?? '',
    cover_image_url: book?.cover_image_url ?? '',
    description: book?.description ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      title: form.title,
      author: form.author,
      subject: form.subject || null,
      call_number: form.call_number || null,
      publisher: form.publisher || null,
      publication_year: form.publication_year ? parseInt(form.publication_year, 10) : null,
      isbn: form.isbn || null,
      cover_image_url: form.cover_image_url || null,
      description: form.description || null,
    };

    let result;
    if (book) {
      result = await supabase.from('books').update(payload).eq('id', book.id);
      if (profile) await logAction(profile.id, 'catalog_edit', 'book', book.id, { title: form.title });
    } else {
      result = await supabase.from('books').insert(payload).select().single();
      if (result.data && profile) await logAction(profile.id, 'catalog_add', 'book', result.data.id, { title: form.title });
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
      <div className="card max-w-lg w-full max-h-[85vh] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-ink-100">
          <h2 className="font-serif text-lg font-semibold text-ink-900">
            {book ? 'Edit book' : 'Add new book'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="label">Title <span className="text-rust-500">*</span></label>
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" />
          </div>
          <div>
            <label className="label">Author <span className="text-rust-500">*</span></label>
            <input required value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Subject / Category</label>
              <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">Call number</label>
              <input value={form.call_number} onChange={(e) => setForm({ ...form, call_number: e.target.value })} className="input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Publisher</label>
              <input value={form.publisher} onChange={(e) => setForm({ ...form, publisher: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">Publication year</label>
              <input type="number" value={form.publication_year} onChange={(e) => setForm({ ...form, publication_year: e.target.value })} className="input" />
            </div>
          </div>
          <div>
            <label className="label">ISBN</label>
            <input value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} className="input" />
          </div>
          <div>
            <label className="label">Cover image URL</label>
            <input value={form.cover_image_url} onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })} className="input" placeholder="https://…" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" rows={3} />
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

function CopiesModal({
  book,
  onClose,
  onSaved,
}: {
  book: BookWithCopies;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { profile } = useAuth();
  const [copies, setCopies] = useState<Copy[]>(book.copies);
  const [newCopyCode, setNewCopyCode] = useState('');
  const [newCondition, setNewCondition] = useState('good');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addCopy() {
    setAdding(true);
    setError(null);
    const code = newCopyCode.trim() || generateCopyCode(copies.map((c) => c.copy_code));
    const { data, error: err } = await supabase
      .from('copies')
      .insert({
        book_id: book.id,
        copy_code: code,
        status: 'available',
        condition: newCondition,
      })
      .select()
      .single();

    if (err) {
      setError(err.message);
      setAdding(false);
      return;
    }
    if (profile) await logAction(profile.id, 'copy_add', 'copy', data.id, { copy_code: code });
    setCopies([...copies, data]);
    setNewCopyCode('');
    setAdding(false);
  }

  async function updateStatus(copy: Copy, status: Copy['status']) {
    const { error: err } = await supabase.from('copies').update({ status }).eq('id', copy.id);
    if (err) {
      setError(err.message);
      return;
    }
    if (profile) await logAction(profile.id, 'copy_status_change', 'copy', copy.id, { from: copy.status, to: status });
    setCopies(copies.map((c) => (c.id === copy.id ? { ...c, status } : c)));
  }

  async function deleteCopy(copy: Copy) {
    if (!confirm(`Remove copy ${copy.copy_code}?`)) return;
    const { error: err } = await supabase.from('copies').delete().eq('id', copy.id);
    if (err) {
      setError(err.message);
      return;
    }
    setCopies(copies.filter((c) => c.id !== copy.id));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/40 animate-fade-in" onClick={onClose}>
      <div className="card max-w-lg w-full max-h-[85vh] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-ink-100">
          <div>
            <h2 className="font-serif text-lg font-semibold text-ink-900">Manage copies</h2>
            <p className="text-sm text-ink-500">{book.title}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-rust-50 px-3 py-2.5 text-sm text-rust-700">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Add copy */}
          <div className="rounded-lg border border-ink-200 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-ink-700">Add a copy</h3>
            <div className="flex gap-2">
              <input
                value={newCopyCode}
                onChange={(e) => setNewCopyCode(e.target.value)}
                placeholder={`Auto: ${generateCopyCode(copies.map((c) => c.copy_code))}`}
                className="input flex-1"
              />
              <select value={newCondition} onChange={(e) => setNewCondition(e.target.value)} className="input w-32">
                <option value="new">New</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
              </select>
            </div>
            <button onClick={addCopy} disabled={adding} className="btn-secondary w-full">
              <Plus className="h-4 w-4" /> {adding ? 'Adding…' : 'Add copy'}
            </button>
          </div>

          {/* Existing copies */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-ink-700">Existing copies ({copies.length})</h3>
            {copies.length === 0 ? (
              <p className="text-sm text-ink-400 py-4 text-center">No copies yet. Add one above.</p>
            ) : (
              copies.map((copy) => (
                <div key={copy.id} className="flex items-center gap-2 rounded-lg border border-ink-100 px-3 py-2">
                  <span className="text-sm font-mono text-ink-700 flex-1">{copy.copy_code}</span>
                  <select
                    value={copy.status}
                    onChange={(e) => updateStatus(copy, e.target.value as Copy['status'])}
                    className="rounded-md border border-ink-200 bg-white px-2 py-1 text-xs text-ink-700 focus:outline-none focus:border-forest-500"
                  >
                    <option value="available">Available</option>
                    <option value="borrowed">Borrowed</option>
                    <option value="reserved">Reserved</option>
                    <option value="lost">Lost</option>
                    <option value="under_repair">Under repair</option>
                  </select>
                  <button
                    onClick={() => deleteCopy(copy)}
                    className="rounded-lg p-1.5 text-ink-400 hover:bg-rust-50 hover:text-rust-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button onClick={onSaved} className="btn-primary">Done</button>
          </div>
        </div>
      </div>
    </div>
  );
}
