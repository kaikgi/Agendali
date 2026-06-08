-- Drop existing broken policies for establishment-logos
DROP POLICY IF EXISTS "Owners can upload establishment logos" ON storage.objects;
DROP POLICY IF EXISTS "Owners can update establishment logos" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete establishment logos" ON storage.objects;

-- Recreate policies with correct logic (using objects.name instead of establishments.name)
CREATE POLICY "Owners can upload establishment logos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'establishment-logos'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM establishments
    WHERE establishments.id::text = (storage.foldername(name))[1]
    AND establishments.owner_user_id = auth.uid()
  )
);

CREATE POLICY "Owners can update establishment logos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'establishment-logos'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM establishments
    WHERE establishments.id::text = (storage.foldername(name))[1]
    AND establishments.owner_user_id = auth.uid()
  )
);

CREATE POLICY "Owners can delete establishment logos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'establishment-logos'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM establishments
    WHERE establishments.id::text = (storage.foldername(name))[1]
    AND establishments.owner_user_id = auth.uid()
  )
);