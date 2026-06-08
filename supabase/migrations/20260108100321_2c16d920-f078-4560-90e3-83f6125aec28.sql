-- Create storage bucket for establishment logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('establishment-logos', 'establishment-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view logos (public bucket)
CREATE POLICY "Public can view establishment logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'establishment-logos');

-- Allow establishment owners to upload their logo
CREATE POLICY "Owners can upload establishment logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'establishment-logos' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.establishments
    WHERE id::text = (storage.foldername(name))[1]
    AND owner_user_id = auth.uid()
  )
);

-- Allow establishment owners to update their logo
CREATE POLICY "Owners can update establishment logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'establishment-logos'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.establishments
    WHERE id::text = (storage.foldername(name))[1]
    AND owner_user_id = auth.uid()
  )
);

-- Allow establishment owners to delete their logo
CREATE POLICY "Owners can delete establishment logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'establishment-logos'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.establishments
    WHERE id::text = (storage.foldername(name))[1]
    AND owner_user_id = auth.uid()
  )
);