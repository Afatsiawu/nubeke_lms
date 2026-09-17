/*
# Create storage bucket for book cover images

## Purpose
- Create a public storage bucket called `book_covers` for uploading book cover images.
- Add RLS policies allowing authenticated staff to upload/update/delete images, and anyone (anon) to read them (covers are shown on the public OPAC).

## Security
- SELECT (read): public (anon + authenticated) — covers are displayed on the public catalog.
- INSERT: authenticated staff only.
- UPDATE: authenticated staff only.
- DELETE: authenticated staff only.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('book_covers', 'book_covers', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies use storage.object_owner for ownership checks
DROP POLICY IF EXISTS "public_read_covers" ON storage.objects;
CREATE POLICY "public_read_covers" ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'book_covers');

DROP POLICY IF EXISTS "staff_upload_covers" ON storage.objects;
CREATE POLICY "staff_upload_covers" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'book_covers' AND is_staff_member());

DROP POLICY IF EXISTS "staff_update_covers" ON storage.objects;
CREATE POLICY "staff_update_covers" ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'book_covers' AND is_staff_member())
  WITH CHECK (bucket_id = 'book_covers' AND is_staff_member());

DROP POLICY IF EXISTS "staff_delete_covers" ON storage.objects;
CREATE POLICY "staff_delete_covers" ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'book_covers' AND is_staff_member());
