ALTER TABLE public.admin_whatsapp_instances
ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'whatsapi',
ADD COLUMN IF NOT EXISTS connected_phone text,
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS connected_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_validated_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS idx_admin_whatsapp_instances_active
ON public.admin_whatsapp_instances (is_active)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_admin_whatsapp_instances_provider_name
ON public.admin_whatsapp_instances (provider, instance_name);