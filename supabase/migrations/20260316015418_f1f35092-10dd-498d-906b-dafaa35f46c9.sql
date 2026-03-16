-- Add storage policies for client avatar uploads (avatars/{user_id}/avatar.jpg)
-- Users can only manage files in their own folder

CREATE POLICY "Authenticated can insert own avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'uploads'
  AND (storage.foldername(storage.objects.name))[1] = 'avatars'
  AND (storage.foldername(storage.objects.name))[2] = auth.uid()::text
);

CREATE POLICY "Authenticated can update own avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'uploads'
  AND (storage.foldername(storage.objects.name))[1] = 'avatars'
  AND (storage.foldername(storage.objects.name))[2] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'uploads'
  AND (storage.foldername(storage.objects.name))[1] = 'avatars'
  AND (storage.foldername(storage.objects.name))[2] = auth.uid()::text
);

CREATE POLICY "Authenticated can delete own avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'uploads'
  AND (storage.foldername(storage.objects.name))[1] = 'avatars'
  AND (storage.foldername(storage.objects.name))[2] = auth.uid()::text
);