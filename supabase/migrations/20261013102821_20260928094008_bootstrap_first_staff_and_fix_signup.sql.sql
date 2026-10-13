/*
# Fix staff profile self-registration and member insert policy

## Problem
1. The staff_profiles INSERT policy requires an existing staff member to create
   new profiles (chicken-and-egg deadlock). New sign-ups via the SignUp page
   fail because `is_staff_with_role('staff')` returns false for a brand-new
   user who has no staff_profiles row yet.
2. When sign-up fails to create a staff_profiles row, the user logs in but
   `is_staff_member()` returns false, so every INSERT into `members` fails
   with "new row violates row-level security policy for table members".

## Changes
1. Fix staff_profiles INSERT policy: allow self-registration as 'staff'
   (auth.uid() = id AND role = 'staff').
2. Allow management users to insert staff profiles (admin-managed user creation).
3. Relax books/copies write policies to allow any staff member (both 'staff'
   and 'management' roles).
4. Ensure members table INSERT policy uses is_staff_member() which checks
   for any row in staff_profiles (already the case — no change needed there).
*/

-- 1. Fix staff_profiles INSERT policy: allow self-registration as 'staff'
DROP POLICY IF EXISTS "staff_insert_profiles" ON staff_profiles;
CREATE POLICY "staff_insert_profiles" ON staff_profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id AND role = 'staff');

-- Allow management users to insert staff profiles (admin-managed user creation)
DROP POLICY IF EXISTS "management_insert_profiles" ON staff_profiles;
CREATE POLICY "management_insert_profiles" ON staff_profiles FOR INSERT
  TO authenticated WITH CHECK (is_staff_with_role('management'));

-- 2. Relax books write policies to allow both 'staff' and 'management'
DROP POLICY IF EXISTS "staff_insert_books" ON books;
CREATE POLICY "staff_insert_books" ON books FOR INSERT
  TO authenticated WITH CHECK (is_staff_member());

DROP POLICY IF EXISTS "staff_update_books" ON books;
CREATE POLICY "staff_update_books" ON books FOR UPDATE
  TO authenticated USING (is_staff_member()) WITH CHECK (is_staff_member());

DROP POLICY IF EXISTS "staff_delete_books" ON books;
CREATE POLICY "staff_delete_books" ON books FOR DELETE
  TO authenticated USING (is_staff_member());

-- 3. Relax copies write policies to allow both 'staff' and 'management'
DROP POLICY IF EXISTS "staff_insert_copies" ON copies;
CREATE POLICY "staff_insert_copies" ON copies FOR INSERT
  TO authenticated WITH CHECK (is_staff_member());

DROP POLICY IF EXISTS "staff_update_copies" ON copies;
CREATE POLICY "staff_update_copies" ON copies FOR UPDATE
  TO authenticated USING (is_staff_member()) WITH CHECK (is_staff_member());

DROP POLICY IF EXISTS "staff_delete_copies" ON copies;
CREATE POLICY "staff_delete_copies" ON copies FOR DELETE
  TO authenticated USING (is_staff_member());
