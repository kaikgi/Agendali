-- Replace broad uploads write policies with path-restricted authenticated policies
DROP POLICY IF EXISTS "Authenticated can update uploads" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete uploads" ON storage.objects;
DROP POLICY IF EXISTS "Permitir upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can insert establishment logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update establishment logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete establishment logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can insert professional photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update professional photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete professional photos" ON storage.objects;

CREATE POLICY "Authenticated can insert establishment logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'uploads'
  AND (storage.foldername(storage.objects.name))[1] = 'logos'
  AND EXISTS (
    SELECT 1
    FROM public.establishments e
    WHERE e.id::text = (storage.foldername(storage.objects.name))[2]
      AND (
        e.owner_user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.establishment_members em
          WHERE em.establishment_id = e.id
            AND em.user_id = auth.uid()
        )
      )
  )
);

CREATE POLICY "Authenticated can update establishment logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'uploads'
  AND (storage.foldername(storage.objects.name))[1] = 'logos'
  AND EXISTS (
    SELECT 1
    FROM public.establishments e
    WHERE e.id::text = (storage.foldername(storage.objects.name))[2]
      AND (
        e.owner_user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.establishment_members em
          WHERE em.establishment_id = e.id
            AND em.user_id = auth.uid()
        )
      )
  )
)
WITH CHECK (
  bucket_id = 'uploads'
  AND (storage.foldername(storage.objects.name))[1] = 'logos'
  AND EXISTS (
    SELECT 1
    FROM public.establishments e
    WHERE e.id::text = (storage.foldername(storage.objects.name))[2]
      AND (
        e.owner_user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.establishment_members em
          WHERE em.establishment_id = e.id
            AND em.user_id = auth.uid()
        )
      )
  )
);

CREATE POLICY "Authenticated can delete establishment logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'uploads'
  AND (storage.foldername(storage.objects.name))[1] = 'logos'
  AND EXISTS (
    SELECT 1
    FROM public.establishments e
    WHERE e.id::text = (storage.foldername(storage.objects.name))[2]
      AND (
        e.owner_user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.establishment_members em
          WHERE em.establishment_id = e.id
            AND em.user_id = auth.uid()
        )
      )
  )
);

CREATE POLICY "Authenticated can insert professional photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'uploads'
  AND (storage.foldername(storage.objects.name))[1] = 'professional-photos'
  AND EXISTS (
    SELECT 1
    FROM public.professionals p
    LEFT JOIN public.establishments e ON e.id = p.establishment_id
    LEFT JOIN public.establishment_members em ON em.establishment_id = e.id AND em.user_id = auth.uid()
    WHERE p.id::text = (storage.foldername(storage.objects.name))[2]
      AND (e.owner_user_id = auth.uid() OR em.user_id IS NOT NULL OR p.user_id = auth.uid())
  )
);

CREATE POLICY "Authenticated can update professional photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'uploads'
  AND (storage.foldername(storage.objects.name))[1] = 'professional-photos'
  AND EXISTS (
    SELECT 1
    FROM public.professionals p
    LEFT JOIN public.establishments e ON e.id = p.establishment_id
    LEFT JOIN public.establishment_members em ON em.establishment_id = e.id AND em.user_id = auth.uid()
    WHERE p.id::text = (storage.foldername(storage.objects.name))[2]
      AND (e.owner_user_id = auth.uid() OR em.user_id IS NOT NULL OR p.user_id = auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'uploads'
  AND (storage.foldername(storage.objects.name))[1] = 'professional-photos'
  AND EXISTS (
    SELECT 1
    FROM public.professionals p
    LEFT JOIN public.establishments e ON e.id = p.establishment_id
    LEFT JOIN public.establishment_members em ON em.establishment_id = e.id AND em.user_id = auth.uid()
    WHERE p.id::text = (storage.foldername(storage.objects.name))[2]
      AND (e.owner_user_id = auth.uid() OR em.user_id IS NOT NULL OR p.user_id = auth.uid())
  )
);

CREATE POLICY "Authenticated can delete professional photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'uploads'
  AND (storage.foldername(storage.objects.name))[1] = 'professional-photos'
  AND EXISTS (
    SELECT 1
    FROM public.professionals p
    LEFT JOIN public.establishments e ON e.id = p.establishment_id
    LEFT JOIN public.establishment_members em ON em.establishment_id = e.id AND em.user_id = auth.uid()
    WHERE p.id::text = (storage.foldername(storage.objects.name))[2]
      AND (e.owner_user_id = auth.uid() OR em.user_id IS NOT NULL OR p.user_id = auth.uid())
  )
);