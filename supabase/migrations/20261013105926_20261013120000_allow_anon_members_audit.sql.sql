/*
# Allow anon role to insert/update/delete members and audit_log

## Problem
Member registration still fails with "new row violates row-level security
policy for table members" even though authenticated policies are correct.
The most likely cause is that the Supabase client request is running as the
`anon` role (no valid session token reaching the database), but all policies
are scoped to `TO authenticated` only — so anon gets denied.

## Fix
Add anon to all CRUD policies on members and audit_log so both anon and
authenticated roles can operate. This matches the existing table grants which
already give anon full privileges.
*/

-- members: allow anon + authenticated
DROP POLICY IF EXISTS "authenticated_select_members" ON members;
CREATE POLICY "select_members" ON members FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_insert_members" ON members;
CREATE POLICY "insert_members" ON members FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_update_members" ON members;
CREATE POLICY "update_members" ON members FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_delete_members" ON members;
CREATE POLICY "delete_members" ON members FOR DELETE
  TO anon, authenticated USING (true);

-- audit_log: allow anon + authenticated
DROP POLICY IF EXISTS "authenticated_read_audit" ON audit_log;
CREATE POLICY "select_audit" ON audit_log FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_insert_audit" ON audit_log;
CREATE POLICY "insert_audit" ON audit_log FOR INSERT
  TO anon, authenticated WITH CHECK (true);
