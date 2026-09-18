import { useEffect, useState, useRef, FormEvent } from 'react';
import { Plus, Search, Edit2, Trash2, BookPlus, X, Save, AlertCircle, Upload, FileSpreadsheet, ImageIcon, Loader2 } from 'lucide-react';
import Papa from 'papaparse';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { logAction } from '@/lib/audit';
import { generateCopyCode, getAvailability } from '@/lib/utils';
import { enqueueOp, isOnline } from '@/lib/offline-queue';
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
  const [showBulkUpload, setShowBulkUpload] = useState(false);
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
    if (!isOnline()) {
      await enqueueOp('book_delete', 'books', {}, {
        filters: { id: book.id },
        staffId: profile?.id,
        auditAction: 'catalog_remove',
        auditEntityType: 'book',
        auditEntityId: book.id,
        auditDetails: { title: book.title },
      });
      await loadBooks();
      return;
    }
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
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowBulkUpload(true)} className="btn-secondary">
            <Upload className="h-4 w-4" /> Bulk upload
          </button>
          <button onClick={() => setShowAddForm(true)} className="btn-primary">
            <Plus className="h-4 w-4" /> Add book
          </button>
        </div>
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
          <p className="text-sm text-ink-400 mt-1">Click "Add book" or "Bulk upload" to get started.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[500px]">
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

      {showBulkUpload && (
        <BulkUploadModal
          onClose={() => setShowBulkUpload(false)}
          onDone={async () => { setShowBulkUpload(false); await loadBooks(); }}
        />
      )}
    </div>
  );
}

async function uploadCoverImage(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `cover_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from('book_covers')
    .upload(fileName, file, { cacheControl: '3600', upsert: false });

  if (error) throw new Error(error.message);

  const { data: urlData } = supabase.storage
    .from('book_covers')
    .getPublicUrl(fileName);

  return urlData.publicUrl;
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
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(book?.cover_image_url ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5 MB');
      return;
    }
    setUploadingImage(true);
    setError(null);
    try {
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
      const url = await uploadCoverImage(file);
      if (url) {
        setForm((prev) => ({ ...prev, cover_image_url: url }));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload image');
      setImagePreview(book?.cover_image_url ?? null);
    } finally {
      setUploadingImage(false);
    }
  }

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

    if (!isOnline()) {
      if (book) {
        await enqueueOp('book_update', 'books', payload, {
          filters: { id: book.id },
          staffId: profile?.id,
          auditAction: 'catalog_edit',
          auditEntityType: 'book',
          auditEntityId: book.id,
          auditDetails: { title: form.title },
        });
      } else {
        await enqueueOp('book_insert', 'books', payload, {
          staffId: profile?.id,
          auditAction: 'catalog_add',
          auditEntityType: 'book',
          auditDetails: { title: form.title },
        });
      }
      onSaved();
      return;
    }

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
            <label className="label">Cover image</label>
            <div className="flex items-center gap-4">
              <div className="shrink-0">
                {imagePreview ? (
                  <img src={imagePreview} alt="Cover preview" className="h-24 w-16 rounded-md object-cover shadow-sm border border-ink-200" />
                ) : (
                  <div className="h-24 w-16 rounded-md bg-ink-100 flex items-center justify-center border border-ink-200">
                    <ImageIcon className="h-6 w-6 text-ink-300" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="btn-secondary"
                >
                  {uploadingImage ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
                  ) : (
                    <><Upload className="h-4 w-4" /> Upload image</>
                  )}
                </button>
                {form.cover_image_url && (
                  <button
                    type="button"
                    onClick={() => { setForm({ ...form, cover_image_url: '' }); setImagePreview(null); }}
                    className="ml-2 text-sm text-rust-600 hover:text-rust-700"
                  >
                    Remove
                  </button>
                )}
                <p className="text-xs text-ink-400 mt-1">PNG or JPG, up to 5 MB</p>
              </div>
            </div>
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

function BulkUploadModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const { profile } = useAuth();
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ added: number; failed: number; errors: string[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function processFile(file: File) {
    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const text = await file.text();
      const parsed = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
      });

      if (parsed.errors.length > 0 && !parsed.data.length) {
        throw new Error('Could not parse the file. Make sure it has headers: title, author, subject, call_number, publisher, publication_year, isbn, description');
      }

      const rows = parsed.data;
      if (!rows.length) {
        throw new Error('The file is empty or has no data rows.');
      }

      let added = 0;
      let failed = 0;
      const errors: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row.title || !row.author) {
          failed++;
          errors.push(`Row ${i + 2}: Missing title or author`);
          continue;
        }

        const payload = {
          title: row.title.trim(),
          author: row.author.trim(),
          subject: row.subject?.trim() || null,
          call_number: row.call_number?.trim() || null,
          publisher: row.publisher?.trim() || null,
          publication_year: row.publication_year ? parseInt(row.publication_year, 10) || null : null,
          isbn: row.isbn?.trim() || null,
          description: row.description?.trim() || null,
          cover_image_url: row.cover_image_url?.trim() || null,
        };

        const { error: insertErr } = await supabase.from('books').insert(payload);

        if (insertErr) {
          failed++;
          errors.push(`Row ${i + 2} ("${row.title}"): ${insertErr.message}`);
        } else {
          added++;
          if (profile) {
            await logAction(profile.id, 'catalog_add', 'book', undefined, { title: row.title, bulk: true });
          }
        }
      }

      setResult({ added, failed, errors });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to process the file');
    } finally {
      setImporting(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  function downloadTemplate() {
    const headers = ['title', 'author', 'subject', 'call_number', 'publisher', 'publication_year', 'isbn', 'description', 'cover_image_url'];
    const csv = headers.join(',') + '\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'book_catalog_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/40 animate-fade-in" onClick={onClose}>
      <div className="card max-w-lg w-full max-h-[85vh] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-ink-100">
          <h2 className="font-serif text-lg font-semibold text-ink-900">Bulk upload books</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {result ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-forest-50 px-4 py-3">
                <p className="text-sm font-medium text-forest-700">
                  {result.added} {result.added === 1 ? 'book' : 'books'} added successfully
                </p>
                {result.failed > 0 && (
                  <p className="text-sm text-rust-700 mt-1">{result.failed} row(s) failed</p>
                )}
              </div>
              {result.errors.length > 0 && (
                <div className="rounded-lg bg-rust-50 px-4 py-3 max-h-48 overflow-y-auto">
                  <p className="text-sm font-medium text-rust-700 mb-2">Errors:</p>
                  <ul className="text-xs text-rust-600 space-y-1">
                    {result.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button onClick={() => setResult(null)} className="btn-secondary">Upload another</button>
                <button onClick={onDone} className="btn-primary">Done</button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-ink-500">
                Upload a CSV file with book records. The file must have these column headers:
              </p>
              <div className="rounded-lg bg-ink-50 px-3 py-2.5">
                <code className="text-xs text-ink-600">title, author, subject, call_number, publisher, publication_year, isbn, description, cover_image_url</code>
              </div>
              <p className="text-xs text-ink-400">
                <span className="text-rust-500">*</span> Only <strong>title</strong> and <strong>author</strong> are required. All others are optional.
              </p>
              <button onClick={downloadTemplate} className="text-sm text-forest-600 hover:text-forest-700 flex items-center gap-1.5">
                <FileSpreadsheet className="h-4 w-4" /> Download CSV template
              </button>

              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
                  dragOver ? 'border-forest-400 bg-forest-50' : 'border-ink-200 hover:border-ink-300'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {importing ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 text-forest-600 animate-spin" />
                    <p className="text-sm text-ink-500">Importing books…</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-8 w-8 text-ink-300" />
                    <p className="text-sm font-medium text-ink-600">Click to select or drag a CSV file here</p>
                    <p className="text-xs text-ink-400">CSV files exported from Excel or Google Sheets</p>
                  </div>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-rust-50 px-3 py-2.5 text-sm text-rust-700">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
              </div>
            </>
          )}
        </div>
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
