/*
# Bootstrap first staff user and fix staff profile creation policy

## Problem
1. There are zero users in auth.users — no staff account exists, so nobody can sign in.
2. The staff_profiles INSERT policy requires an existing staff member to create new profiles
   (chicken-and-egg deadlock).
3. The books/copies write policies require role = 'staff' specifically, but management
   role users also need to manage the catalog.

## Changes
1. Create the first staff auth user with a known email/password.
2. Insert a matching staff_profiles row with role 'staff'.
3. Fix staff_profiles INSERT policy: allow self-registration as 'staff'.
4. Relax books/copies write policies to allow both 'staff' and 'management'.

## Login credentials
- Email: admin@nubuke.org
- Password: nubuke2024
*/

-- 1. Bootstrap the first staff user (only if no users exist yet)
DO $$
DECLARE
  user_count int;
  new_user_id uuid;
BEGIN
  SELECT count(*) INTO user_count FROM auth.users;
  IF user_count = 0 THEN
    new_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      new_user_id,
      'authenticated',
      'authenticated',
      'admin@nubuke.org',
      crypt('nubuke2024', gen_salt('bf')),
      now(),
      now(),
      now(),
      '',
      '',
      '',
      ''
    );
    INSERT INTO staff_profiles (id, full_name, role) VALUES (new_user_id, 'System Administrator', 'staff');
  END IF;
END $$;

-- 2. Fix staff_profiles INSERT policy: allow self-registration as 'staff'
DROP POLICY IF EXISTS "staff_insert_profiles" ON staff_profiles;
CREATE POLICY "staff_insert_profiles" ON staff_profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id AND role = 'staff');

-- Allow management users to insert staff profiles (admin-managed user creation)
DROP POLICY IF EXISTS "management_insert_profiles" ON staff_profiles;
CREATE POLICY "management_insert_profiles" ON staff_profiles FOR INSERT
  TO authenticated WITH CHECK (is_staff_with_role('management'));

-- 3. Relax books write policies to allow both 'staff' and 'management'
DROP POLICY IF EXISTS "staff_insert_books" ON books;
CREATE POLICY "staff_insert_books" ON books FOR INSERT
  TO authenticated WITH CHECK (is_staff_member());

DROP POLICY IF EXISTS "staff_update_books" ON books;
CREATE POLICY "staff_update_books" ON books FOR UPDATE
  TO authenticated USING (is_staff_member()) WITH CHECK (is_staff_member());

DROP POLICY IF EXISTS "staff_delete_books" ON books;
CREATE POLICY "staff_delete_books" ON books FOR DELETE
  TO authenticated USING (is_staff_member());

-- 4. Relax copies write policies to allow both 'staff' and 'management'
DROP POLICY IF EXISTS "staff_insert_copies" ON copies;
CREATE POLICY "staff_insert_copies" ON copies FOR INSERT
  TO authenticated WITH CHECK (is_staff_member());

DROP POLICY IF EXISTS "staff_update_copies" ON copies;
CREATE POLICY "staff_update_copies" ON copies FOR UPDATE
  TO authenticated USING (is_staff_member()) WITH CHECK (is_staff_member());

DROP POLICY IF EXISTS "staff_delete_copies" ON copies;
CREATE POLICY "staff_delete_copies" ON copies FOR DELETE
  TO authenticated USING (is_staff_member());
