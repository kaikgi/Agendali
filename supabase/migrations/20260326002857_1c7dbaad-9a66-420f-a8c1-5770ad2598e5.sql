
-- Create batches table
CREATE TABLE public.admin_broadcast_contact_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'manual',
  source_file_name TEXT,
  total_contacts INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.admin_broadcast_contact_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can manage contact batches"
  ON public.admin_broadcast_contact_batches
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Add batch_id to contacts
ALTER TABLE public.admin_broadcast_contacts
  ADD COLUMN batch_id UUID REFERENCES public.admin_broadcast_contact_batches(id) ON DELETE SET NULL;

-- Create a default "manual" batch for existing manual contacts
INSERT INTO public.admin_broadcast_contact_batches (id, name, type)
VALUES ('00000000-0000-0000-0000-000000000001', 'Contatos Manuais', 'manual');

-- Assign existing manual contacts to the default batch
UPDATE public.admin_broadcast_contacts
SET batch_id = '00000000-0000-0000-0000-000000000001'
WHERE source = 'manual';

-- Create a batch for existing excel contacts (if any)
INSERT INTO public.admin_broadcast_contact_batches (id, name, type, source_file_name)
SELECT '00000000-0000-0000-0000-000000000002', 'Importação anterior', 'import', 'importação-legada'
WHERE EXISTS (SELECT 1 FROM public.admin_broadcast_contacts WHERE source = 'excel');

UPDATE public.admin_broadcast_contacts
SET batch_id = '00000000-0000-0000-0000-000000000002'
WHERE source = 'excel' AND batch_id IS NULL;
