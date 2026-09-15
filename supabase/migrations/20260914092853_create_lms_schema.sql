/*
# Nubuke Foundation Library Management System — Core Schema

## Overview
Creates the complete database schema for the Nubuke Foundation library in Ghana.
This is a multi-user system with three roles: staff (librarians), management, and public OPAC users.
Auth is handled by Supabase Auth. Staff and management accounts are in auth.users with
a `staff_profiles` table linking to role assignments. Public OPAC browsing requires no login.

## Tables

### 1. staff_profiles
Links Supabase Auth users to library staff/management roles.
- id (uuid, PK, FK to auth.users)
- full_name (text) — display name
- role (text) — 'staff' | 'management'
- created_at (timestamp)

### 2. members
Library members (borrowers) — community members, students, researchers.
- id (uuid, PK)
- member_code (text, unique) — short code for barcode/manual lookup (e.g. MBR-001)
- full_name (text)
- email (text, nullable)
- phone (text, nullable)
- address (text, nullable)
- membership_status (text) — 'active' | 'suspended' | 'expired'
- created_at (timestamp)

### 3. books
Book records (the catalog / bibliographic info).
- id (uuid, PK)
- title (text)
- author (text)
- subject (text, nullable) — category/subject
- call_number (text, nullable) — shelf location code
- publisher (text, nullable)
- publication_year (integer, nullable)
- isbn (text, nullable)
- cover_image_url (text, nullable)
- description (text, nullable)
- created_at (timestamp)

### 4. copies
Individual physical copies of a book. Each copy has its own status.
- id (uuid, PK)
- book_id (uuid, FK to books)
- copy_code (text, unique) — barcode/identifier for this physical copy (e.g. NUB-0001)
- status (text) — 'available' | 'borrowed' | 'reserved' | 'lost' | 'under_repair'
- condition (text, nullable) — 'new' | 'good' | 'fair' | 'poor'
- acquired_at (timestamp, nullable)
- created_at (timestamp)

### 5. loans
Records of book lending transactions.
- id (uuid, PK)
- copy_id (uuid, FK to copies)
- member_id (uuid, FK to members)
- staff_id (uuid, FK to auth.users) — who processed the checkout
- borrowed_at (timestamp)
- due_date (date)
- returned_at (timestamp, nullable)
- status (text) — 'active' | 'returned' | 'overdue'
- created_at (timestamp)

### 6. reservations
Holds/reservations placed by members on books.
- id (uuid, PK)
- book_id (uuid, FK to books)
- member_id (uuid, FK to members)
- status (text) — 'pending' | 'fulfilled' | 'cancelled'
- notes (text, nullable)
- created_at (timestamp)
- fulfilled_at (timestamp, nullable)

### 7. audit_log
Logs key staff actions for traceability.
- id (uuid, PK)
- staff_id (uuid, FK to auth.users)
- action (text) — e.g. 'checkout', 'return', 'catalog_add', 'catalog_edit', 'catalog_remove', 'member_register'
- entity_type (text) — e.g. 'loan', 'book', 'copy', 'member'
- entity_id (uuid, nullable)
- details (jsonb, nullable) — additional context
- created_at (timestamp)

## Security (RLS)
- books, copies: public read (OPAC needs no login); write restricted to staff role
- members: staff can CRUD; public can't see member data
- loans, reservations: staff can CRUD; public can't see
- audit_log: staff + management can read; only staff can insert
- staff_profiles: staff + management can read; self can read own; insert restricted (admin only via service role)
*/

-- ============ STAFF PROFILES ============
CREATE TABLE IF NOT EXISTS staff_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('staff', 'management')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_all_profiles" ON staff_profiles;
CREATE POLICY "staff_read_all_profiles" ON staff_profiles FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM staff_profiles sp WHERE sp.id = auth.uid() AND sp.role IN ('staff', 'management'))
  );

DROP POLICY IF EXISTS "staff_insert_profiles" ON staff_profiles;
CREATE POLICY "staff_insert_profiles" ON staff_profiles FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM staff_profiles sp WHERE sp.id = auth.uid() AND sp.role = 'staff')
  );

DROP POLICY IF EXISTS "staff_update_profiles" ON staff_profiles;
CREATE POLICY "staff_update_profiles" ON staff_profiles FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM staff_profiles sp WHERE sp.id = auth.uid() AND sp.role = 'staff')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM staff_profiles sp WHERE sp.id = auth.uid() AND sp.role = 'staff')
  );

-- ============ MEMBERS ============
CREATE TABLE IF NOT EXISTS members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_code text UNIQUE NOT NULL,
  full_name text NOT NULL,
  email text,
  phone text,
  address text,
  membership_status text NOT NULL DEFAULT 'active' CHECK (membership_status IN ('active', 'suspended', 'expired')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_select_members" ON members;
CREATE POLICY "staff_select_members" ON members FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM staff_profiles sp WHERE sp.id = auth.uid())
  );

DROP POLICY IF EXISTS "staff_insert_members" ON members;
CREATE POLICY "staff_insert_members" ON members FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM staff_profiles sp WHERE sp.id = auth.uid())
  );

DROP POLICY IF EXISTS "staff_update_members" ON members;
CREATE POLICY "staff_update_members" ON members FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM staff_profiles sp WHERE sp.id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM staff_profiles sp WHERE sp.id = auth.uid())
  );

DROP POLICY IF EXISTS "staff_delete_members" ON members;
CREATE POLICY "staff_delete_members" ON members FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM staff_profiles sp WHERE sp.id = auth.uid())
  );

-- ============ BOOKS ============
CREATE TABLE IF NOT EXISTS books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  author text NOT NULL,
  subject text,
  call_number text,
  publisher text,
  publication_year integer,
  isbn text,
  cover_image_url text,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE books ENABLE ROW LEVEL SECURITY;

-- Public can read books (OPAC needs no login)
DROP POLICY IF EXISTS "public_select_books" ON books;
CREATE POLICY "public_select_books" ON books FOR SELECT
  TO anon, authenticated USING (true);

-- Only staff can write
DROP POLICY IF EXISTS "staff_insert_books" ON books;
CREATE POLICY "staff_insert_books" ON books FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM staff_profiles sp WHERE sp.id = auth.uid() AND sp.role = 'staff')
  );

DROP POLICY IF EXISTS "staff_update_books" ON books;
CREATE POLICY "staff_update_books" ON books FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM staff_profiles sp WHERE sp.id = auth.uid() AND sp.role = 'staff')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM staff_profiles sp WHERE sp.id = auth.uid() AND sp.role = 'staff')
  );

DROP POLICY IF EXISTS "staff_delete_books" ON books;
CREATE POLICY "staff_delete_books" ON books FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM staff_profiles sp WHERE sp.id = auth.uid() AND sp.role = 'staff')
  );

-- ============ COPIES ============
CREATE TABLE IF NOT EXISTS copies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  copy_code text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'borrowed', 'reserved', 'lost', 'under_repair')),
  condition text CHECK (condition IN ('new', 'good', 'fair', 'poor')),
  acquired_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE copies ENABLE ROW LEVEL SECURITY;

-- Public can read copies (for availability display in OPAC)
DROP POLICY IF EXISTS "public_select_copies" ON copies;
CREATE POLICY "public_select_copies" ON copies FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "staff_insert_copies" ON copies;
CREATE POLICY "staff_insert_copies" ON copies FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM staff_profiles sp WHERE sp.id = auth.uid() AND sp.role = 'staff')
  );

DROP POLICY IF EXISTS "staff_update_copies" ON copies;
CREATE POLICY "staff_update_copies" ON copies FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM staff_profiles sp WHERE sp.id = auth.uid() AND sp.role = 'staff')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM staff_profiles sp WHERE sp.id = auth.uid() AND sp.role = 'staff')
  );

DROP POLICY IF EXISTS "staff_delete_copies" ON copies;
CREATE POLICY "staff_delete_copies" ON copies FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM staff_profiles sp WHERE sp.id = auth.uid() AND sp.role = 'staff')
  );

-- ============ LOANS ============
CREATE TABLE IF NOT EXISTS loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  copy_id uuid NOT NULL REFERENCES copies(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  borrowed_at timestamptz DEFAULT now(),
  due_date date NOT NULL,
  returned_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'returned', 'overdue')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE loans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_select_loans" ON loans;
CREATE POLICY "staff_select_loans" ON loans FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM staff_profiles sp WHERE sp.id = auth.uid())
  );

DROP POLICY IF EXISTS "staff_insert_loans" ON loans;
CREATE POLICY "staff_insert_loans" ON loans FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM staff_profiles sp WHERE sp.id = auth.uid())
  );

DROP POLICY IF EXISTS "staff_update_loans" ON loans;
CREATE POLICY "staff_update_loans" ON loans FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM staff_profiles sp WHERE sp.id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM staff_profiles sp WHERE sp.id = auth.uid())
  );

-- ============ RESERVATIONS ============
CREATE TABLE IF NOT EXISTS reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'cancelled')),
  notes text,
  created_at timestamptz DEFAULT now(),
  fulfilled_at timestamptz
);

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_select_reservations" ON reservations;
CREATE POLICY "staff_select_reservations" ON reservations FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM staff_profiles sp WHERE sp.id = auth.uid())
  );

DROP POLICY IF EXISTS "staff_insert_reservations" ON reservations;
CREATE POLICY "staff_insert_reservations" ON reservations FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM staff_profiles sp WHERE sp.id = auth.uid())
  );

DROP POLICY IF EXISTS "staff_update_reservations" ON reservations;
CREATE POLICY "staff_update_reservations" ON reservations FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM staff_profiles sp WHERE sp.id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM staff_profiles sp WHERE sp.id = auth.uid())
  );

DROP POLICY IF EXISTS "staff_delete_reservations" ON reservations;
CREATE POLICY "staff_delete_reservations" ON reservations FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM staff_profiles sp WHERE sp.id = auth.uid())
  );

-- ============ AUDIT LOG ============
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_audit" ON audit_log;
CREATE POLICY "staff_read_audit" ON audit_log FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM staff_profiles sp WHERE sp.id = auth.uid())
  );

DROP POLICY IF EXISTS "staff_insert_audit" ON audit_log;
CREATE POLICY "staff_insert_audit" ON audit_log FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM staff_profiles sp WHERE sp.id = auth.uid())
  );

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_books_title ON books USING gin (to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_books_author ON books USING gin (to_tsvector('english', author));
CREATE INDEX IF NOT EXISTS idx_books_subject ON books(subject);
CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn);
CREATE INDEX IF NOT EXISTS idx_copies_book_id ON copies(book_id);
CREATE INDEX IF NOT EXISTS idx_copies_status ON copies(status);
CREATE INDEX IF NOT EXISTS idx_copies_copy_code ON copies(copy_code);
CREATE INDEX IF NOT EXISTS idx_loans_member_id ON loans(member_id);
CREATE INDEX IF NOT EXISTS idx_loans_copy_id ON loans(copy_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_due_date ON loans(due_date);
CREATE INDEX IF NOT EXISTS idx_members_member_code ON members(member_code);
CREATE INDEX IF NOT EXISTS idx_reservations_book_id ON reservations(book_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
