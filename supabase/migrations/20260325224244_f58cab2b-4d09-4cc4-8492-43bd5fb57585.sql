ALTER TABLE public.admin_whatsapp_instances
ADD COLUMN IF NOT EXISTS token text,
ADD COLUMN IF NOT EXISTS device_name text,
ADD COLUMN IF NOT EXISTS webhook text;