-- Drop existing policies for establishment-logos bucket
DROP POLICY IF EXISTS "establishment-logos select" ON storage.objects;
DROP POLICY IF EXISTS "establishment-logos insert" ON storage.objects;
DROP POLICY IF EXISTS "establishment-logos update" ON storage.objects;
DROP POLICY IF EXISTS "establishment-logos delete" ON storage.objects;
DROP POLICY IF EXISTS "Establishment logos are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Owners can upload establishment logos" ON storage.objects;
DROP POLICY IF EXISTS "Owners can update establishment logos" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete establishment logos" ON storage.objects;

-- 1) SELECT: Public read access (logos appear on public booking page)
CREATE POLICY "establishment-logos select"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'establishment-logos');

-- 2) INSERT: Owner OR manager/staff member can upload
CREATE POLICY "establishment-logos insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'establishment-logos'
  AND (
    -- Check if user is owner of the establishment
    EXISTS (
      SELECT 1 FROM public.establishments e
      WHERE e.owner_user_id = auth.uid()
        AND e.id::text = split_part(name, '/', 1)
    )
    OR
    -- Check if user is member (manager/staff) of the establishment
    EXISTS (
      SELECT 1 FROM public.establishment_members em
      WHERE em.user_id = auth.uid()
        AND em.role IN ('owner', 'manager')
        AND em.establishment_id::text = split_part(name, '/', 1)
    )
  )
);

-- 3) UPDATE: Owner OR manager can update (for upsert)
CREATE POLICY "establishment-logos update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'establishment-logos'
  AND (
    EXISTS (
      SELECT 1 FROM public.establishments e
      WHERE e.owner_user_id = auth.uid()
        AND e.id::text = split_part(name, '/', 1)
    )
    OR
    EXISTS (
      SELECT 1 FROM public.establishment_members em
      WHERE em.user_id = auth.uid()
        AND em.role IN ('owner', 'manager')
        AND em.establishment_id::text = split_part(name, '/', 1)
    )
  )
)
WITH CHECK (
  bucket_id = 'establishment-logos'
  AND (
    EXISTS (
      SELECT 1 FROM public.establishments e
      WHERE e.owner_user_id = auth.uid()
        AND e.id::text = split_part(name, '/', 1)
    )
    OR
    EXISTS (
      SELECT 1 FROM public.establishment_members em
      WHERE em.user_id = auth.uid()
        AND em.role IN ('owner', 'manager')
        AND em.establishment_id::text = split_part(name, '/', 1)
    )
  )
);

-- 4) DELETE: Owner OR manager can delete
CREATE POLICY "establishment-logos delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'establishment-logos'
  AND (
    EXISTS (
      SELECT 1 FROM public.establishments e
      WHERE e.owner_user_id = auth.uid()
        AND e.id::text = split_part(name, '/', 1)
    )
    OR
    EXISTS (
      SELECT 1 FROM public.establishment_members em
      WHERE em.user_id = auth.uid()
        AND em.role IN ('owner', 'manager')
        AND em.establishment_id::text = split_part(name, '/', 1)
    )
  )
);