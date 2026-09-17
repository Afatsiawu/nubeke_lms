/*
# Fix infinite recursion in staff_profiles RLS policies

## Problem
Every policy on staff_profiles (and other tables) uses `EXISTS (SELECT 1 FROM staff_profiles sp WHERE sp.id = auth.uid())` to check if the caller is staff. Because RLS is enabled on staff_profiles, that sub-query itself triggers RLS evaluation, which runs the same check again — infinite recursion.

## Fix
1. Create a SECURITY DEFINER function `is_staff_member()` that checks `auth.uid()` against staff_profiles BYPASSING RLS (SECURITY DEFINER runs with the function owner's privileges, not the caller's).
2. Replace ALL policy predicates that referenced staff_profiles with calls to `is_staff_member()` or `is_staff_with_role(role)` across every table.
3. Drop and recreate all affected policies.

## Tables affected
- staff_profiles (SELECT, INSERT, UPDATE)
- books (INSERT, UPDATE, DELETE)
- copies (INSERT, UPDATE, DELETE)
- loans (SELECT, INSERT, UPDATE)
- members (SELECT, INSERT, UPDATE, DELETE)
- reservations (SELECT, INSERT, UPDATE, DELETE)
- audit_log (SELECT, INSERT)

## Security
- The SECURITY DEFINER function is safe: it only reads `auth.uid()` and checks existence/role — it does not expose data.
- RLS remains enabled on all tables.
- Policies are functionally equivalent to the originals but without the recursive self-reference.
*/

-- Create helper functions (SECURITY DEFINER to bypass RLS on staff_profiles)
CREATE OR REPLACE FUNCTION is_staff_member()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff_profiles sp WHERE sp.id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION is_staff_with_role(p_role text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff_profiles sp
    WHERE sp.id = auth.uid() AND sp.role = p_role
  );
$$;

-- Grant execute to authenticated (needed for SECURITY DEFINER functions called by RLS)
GRANT EXECUTE ON FUNCTION is_staff_member() TO authenticated;
GRANT EXECUTE ON FUNCTION is_staff_with_role(text) TO authenticated;

-- Fix staff_profiles policies
DROP POLICY IF EXISTS "staff_insert_profiles" ON staff_profiles;
DROP POLICY IF EXISTS "staff_read_all_profiles" ON staff_profiles;
DROP POLICY IF EXISTS "staff_update_profiles" ON staff_profiles;

CREATE POLICY "staff_read_all_profiles" ON staff_profiles FOR SELECT
  TO authenticated USING (is_staff_member());

CREATE POLICY "staff_insert_profiles" ON staff_profiles FOR INSERT
  TO authenticated WITH CHECK (is_staff_with_role('staff'));

CREATE POLICY "staff_update_profiles" ON staff_profiles FOR UPDATE
  TO authenticated USING (is_staff_with_role('staff'))
  WITH CHECK (is_staff_with_role('staff'));

-- Fix books policies
DROP POLICY IF EXISTS "staff_insert_books" ON books;
DROP POLICY IF EXISTS "staff_update_books" ON books;
DROP POLICY IF EXISTS "staff_delete_books" ON books;

CREATE POLICY "staff_insert_books" ON books FOR INSERT
  TO authenticated WITH CHECK (is_staff_with_role('staff'));

CREATE POLICY "staff_update_books" ON books FOR UPDATE
  TO authenticated USING (is_staff_with_role('staff'))
  WITH CHECK (is_staff_with_role('staff'));

CREATE POLICY "staff_delete_books" ON books FOR DELETE
  TO authenticated USING (is_staff_with_role('staff'));

-- Fix copies policies
DROP POLICY IF EXISTS "staff_insert_copies" ON copies;
DROP POLICY IF EXISTS "staff_update_copies" ON copies;
DROP POLICY IF EXISTS "staff_delete_copies" ON copies;

CREATE POLICY "staff_insert_copies" ON copies FOR INSERT
  TO authenticated WITH CHECK (is_staff_with_role('staff'));

CREATE POLICY "staff_update_copies" ON copies FOR UPDATE
  TO authenticated USING (is_staff_with_role('staff'))
  WITH CHECK (is_staff_with_role('staff'));

CREATE POLICY "staff_delete_copies" ON copies FOR DELETE
  TO authenticated USING (is_staff_with_role('staff'));

-- Fix loans policies
DROP POLICY IF EXISTS "staff_insert_loans" ON loans;
DROP POLICY IF EXISTS "staff_select_loans" ON loans;
DROP POLICY IF EXISTS "staff_update_loans" ON loans;

CREATE POLICY "staff_select_loans" ON loans FOR SELECT
  TO authenticated USING (is_staff_member());

CREATE POLICY "staff_insert_loans" ON loans FOR INSERT
  TO authenticated WITH CHECK (is_staff_member());

CREATE POLICY "staff_update_loans" ON loans FOR UPDATE
  TO authenticated USING (is_staff_member())
  WITH CHECK (is_staff_member());

-- Fix members policies
DROP POLICY IF EXISTS "staff_insert_members" ON members;
DROP POLICY IF EXISTS "staff_select_members" ON members;
DROP POLICY IF EXISTS "staff_update_members" ON members;
DROP POLICY IF EXISTS "staff_delete_members" ON members;

CREATE POLICY "staff_select_members" ON members FOR SELECT
  TO authenticated USING (is_staff_member());

CREATE POLICY "staff_insert_members" ON members FOR INSERT
  TO authenticated WITH CHECK (is_staff_member());

CREATE POLICY "staff_update_members" ON members FOR UPDATE
  TO authenticated USING (is_staff_member())
  WITH CHECK (is_staff_member());

CREATE POLICY "staff_delete_members" ON members FOR DELETE
  TO authenticated USING (is_staff_member());

-- Fix reservations policies
DROP POLICY IF EXISTS "staff_insert_reservations" ON reservations;
DROP POLICY IF EXISTS "staff_select_reservations" ON reservations;
DROP POLICY IF EXISTS "staff_update_reservations" ON reservations;
DROP POLICY IF EXISTS "staff_delete_reservations" ON reservations;

CREATE POLICY "staff_select_reservations" ON reservations FOR SELECT
  TO authenticated USING (is_staff_member());

CREATE POLICY "staff_insert_reservations" ON reservations FOR INSERT
  TO authenticated WITH CHECK (is_staff_member());

CREATE POLICY "staff_update_reservations" ON reservations FOR UPDATE
  TO authenticated USING (is_staff_member())
  WITH CHECK (is_staff_member());

CREATE POLICY "staff_delete_reservations" ON reservations FOR DELETE
  TO authenticated USING (is_staff_member());

-- Fix audit_log policies
DROP POLICY IF EXISTS "staff_insert_audit" ON audit_log;
DROP POLICY IF EXISTS "staff_read_audit" ON audit_log;

CREATE POLICY "staff_read_audit" ON audit_log FOR SELECT
  TO authenticated USING (is_staff_member());

CREATE POLICY "staff_insert_audit" ON audit_log FOR INSERT
  TO authenticated WITH CHECK (is_staff_member());
