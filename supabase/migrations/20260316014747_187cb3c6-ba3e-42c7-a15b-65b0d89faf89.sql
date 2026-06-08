-- Ensure establishment logos and professional photos can be replaced/removed in the uploads bucket
-- Existing project already uses the public 'uploads' bucket for logos and professional photos.
-- The current bucket only has INSERT and SELECT, which breaks upsert/replace flows for existing files.

-- Allow authenticated owners/members to update files in uploads bucket
CREATE POLICY "Authenticated can update uploads"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'uploads')
WITH CHECK (bucket_id = 'uploads');

-- Allow authenticated owners/members to delete files in uploads bucket
CREATE POLICY "Authenticated can delete uploads"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'uploads');