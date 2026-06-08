-- Create storage bucket for professional photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('professional-photos', 'professional-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view photos (public bucket)
CREATE POLICY "Public can view professional photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'professional-photos');

-- Allow establishment members to upload professional photos
CREATE POLICY "Members can upload professional photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'professional-photos' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.professionals p
    JOIN public.establishments e ON e.id = p.establishment_id
    WHERE p.id::text = (storage.foldername(storage.objects.name))[1]
    AND (e.owner_user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.establishment_members em 
      WHERE em.establishment_id = e.id AND em.user_id = auth.uid()
    ))
  )
);

-- Allow establishment members to update professional photos
CREATE POLICY "Members can update professional photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'professional-photos'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.professionals p
    JOIN public.establishments e ON e.id = p.establishment_id
    WHERE p.id::text = (storage.foldername(storage.objects.name))[1]
    AND (e.owner_user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.establishment_members em 
      WHERE em.establishment_id = e.id AND em.user_id = auth.uid()
    ))
  )
);

-- Allow establishment members to delete professional photos
CREATE POLICY "Members can delete professional photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'professional-photos'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.professionals p
    JOIN public.establishments e ON e.id = p.establishment_id
    WHERE p.id::text = (storage.foldername(storage.objects.name))[1]
    AND (e.owner_user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.establishment_members em 
      WHERE em.establishment_id = e.id AND em.user_id = auth.uid()
    ))
  )
);