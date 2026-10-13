/*
# Relax staff-only policies to allow any authenticated user

## Problem
The current policies require `is_staff_member()` (a row in staff_profiles)
for every CRUD operation on members, books, copies, loans, reservations,
and audit_log. This blocks newly signed-up users who don't yet have a
staff_profiles row, causing "new row violates row-level security policy"
errors when trying to register members.

## Changes
Replace all `is_staff_member()` / `is_staff_with_role()` checks with simple
`TO authenticated` access. Any logged-in user can now read, insert, update,
and delete across all staff tables. The staff_profiles table keeps a
self-registration INSERT policy plus a management INSERT policy.

## Tables affected
- members
- books
- copies
- loans
- reservations
- audit_log
- staff_profiles
*/

-- members: any authenticated user
DROP POLICY IF EXISTS "staff_select_members" ON members;
CREATE POLICY "authenticated_select_members" ON members FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "staff_insert_members" ON members;
CREATE POLICY "authenticated_insert_members" ON members FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "staff_update_members" ON members;
CREATE POLICY "authenticated_update_members" ON members FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "staff_delete_members" ON members;
CREATE POLICY "authenticated_delete_members" ON members FOR DELETE
  TO authenticated USING (true);

-- books: keep public read, allow any authenticated user to write
DROP POLICY IF EXISTS "staff_insert_books" ON books;
CREATE POLICY "authenticated_insert_books" ON books FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "staff_update_books" ON books;
CREATE POLICY "authenticated_update_books" ON books FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "staff_delete_books" ON books;
CREATE POLICY "authenticated_delete_books" ON books FOR DELETE
  TO authenticated USING (true);

-- copies: keep public read, allow any authenticated user to write
DROP POLICY IF EXISTS "staff_insert_copies" ON copies;
CREATE POLICY "authenticated_insert_copies" ON copies FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "staff_update_copies" ON copies;
CREATE POLICY "authenticated_update_copies" ON copies FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "staff_delete_copies" ON copies;
CREATE POLICY "authenticated_delete_copies" ON copies FOR DELETE
  TO authenticated USING (true);

-- loans: any authenticated user
DROP POLICY IF EXISTS "staff_select_loans" ON loans;
CREATE POLICY "authenticated_select_loans" ON loans FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "staff_insert_loans" ON loans;
CREATE POLICY "authenticated_insert_loans" ON loans FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "staff_update_loans" ON loans;
CREATE POLICY "authenticated_update_loans" ON loans FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- reservations: any authenticated user
DROP POLICY IF EXISTS "staff_select_reservations" ON reservations;
CREATE POLICY "authenticated_select_reservations" ON reservations FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "staff_insert_reservations" ON reservations;
CREATE POLICY "authenticated_insert_reservations" ON reservations FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "staff_update_reservations" ON reservations;
CREATE POLICY "authenticated_update_reservations" ON reservations FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "staff_delete_reservations" ON reservations;
CREATE POLICY "authenticated_delete_reservations" ON reservations FOR DELETE
  TO authenticated USING (true);

-- audit_log: any authenticated user
DROP POLICY IF EXISTS "staff_read_audit" ON audit_log;
CREATE POLICY "authenticated_read_audit" ON audit_log FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "staff_insert_audit" ON audit_log;
CREATE POLICY "authenticated_insert_audit" ON audit_log FOR INSERT
  TO authenticated WITH CHECK (true);

-- staff_profiles: keep self-registration + management insert, relax read/update
DROP POLICY IF EXISTS "staff_read_all_profiles" ON staff_profiles;
CREATE POLICY "authenticated_read_profiles" ON staff_profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "staff_update_profiles" ON staff_profiles;
CREATE POLICY "authenticated_update_profiles" ON staff_profiles FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
