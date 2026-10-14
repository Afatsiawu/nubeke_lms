/*
# Allow anon role on all write operations across LMS tables

## Problem
All INSERT/UPDATE/DELETE policies on books, copies, loans, and reservations
are scoped to TO authenticated only. The Supabase client sometimes runs
requests as the anon role, causing silent failures (e.g. copies created
during bulk upload never appear).

## Fix
Add anon to all write policies, matching the existing table grants and
the same fix already applied to members and audit_log.
*/

-- books
DROP POLICY IF EXISTS "authenticated_insert_books" ON books;
CREATE POLICY "insert_books" ON books FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_update_books" ON books;
CREATE POLICY "update_books" ON books FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_delete_books" ON books;
CREATE POLICY "delete_books" ON books FOR DELETE
  TO anon, authenticated USING (true);

-- copies
DROP POLICY IF EXISTS "authenticated_insert_copies" ON copies;
CREATE POLICY "insert_copies" ON copies FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_update_copies" ON copies;
CREATE POLICY "update_copies" ON copies FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_delete_copies" ON copies;
CREATE POLICY "delete_copies" ON copies FOR DELETE
  TO anon, authenticated USING (true);

-- loans
DROP POLICY IF EXISTS "authenticated_insert_loans" ON loans;
CREATE POLICY "insert_loans" ON loans FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_select_loans" ON loans;
CREATE POLICY "select_loans" ON loans FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_update_loans" ON loans;
CREATE POLICY "update_loans" ON loans FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- reservations
DROP POLICY IF EXISTS "authenticated_insert_reservations" ON reservations;
CREATE POLICY "insert_reservations" ON reservations FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_select_reservations" ON reservations;
CREATE POLICY "select_reservations" ON reservations FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_update_reservations" ON reservations;
CREATE POLICY "update_reservations" ON reservations FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_delete_reservations" ON reservations;
CREATE POLICY "delete_reservations" ON reservations FOR DELETE
  TO anon, authenticated USING (true);
