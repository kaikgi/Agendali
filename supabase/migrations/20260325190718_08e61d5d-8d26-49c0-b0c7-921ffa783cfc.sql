-- =============================================
-- WhatsApp Broadcast Module Tables
-- =============================================

-- 1. WhatsApp Instances
CREATE TABLE public.admin_whatsapp_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_name text NOT NULL,
  server_url text NOT NULL,
  instance_token text,
  api_key text,
  status text NOT NULL DEFAULT 'disconnected',
  is_connected boolean NOT NULL DEFAULT false,
  qr_code text,
  last_connection_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_whatsapp_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can manage whatsapp instances"
  ON public.admin_whatsapp_instances FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- 2. Broadcast Contacts
CREATE TABLE public.admin_broadcast_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_name text NOT NULL,
  phone text NOT NULL,
  normalized_phone text NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_broadcast_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can manage broadcast contacts"
  ON public.admin_broadcast_contacts FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- 3. Broadcast Campaigns
CREATE TABLE public.admin_broadcast_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  message text NOT NULL,
  delay_seconds integer NOT NULL DEFAULT 60,
  status text NOT NULL DEFAULT 'draft',
  total_contacts integer NOT NULL DEFAULT 0,
  total_sent integer NOT NULL DEFAULT 0,
  total_failed integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  finished_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_broadcast_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can manage broadcast campaigns"
  ON public.admin_broadcast_campaigns FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- 4. Campaign Contacts (junction)
CREATE TABLE public.admin_broadcast_campaign_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.admin_broadcast_campaigns(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.admin_broadcast_contacts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  failed_at timestamptz,
  provider_message_id text,
  error_message text,
  attempt_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_broadcast_campaign_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can manage campaign contacts"
  ON public.admin_broadcast_campaign_contacts FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- 5. Broadcast Logs
CREATE TABLE public.admin_broadcast_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.admin_broadcast_campaigns(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.admin_broadcast_contacts(id) ON DELETE SET NULL,
  phone text NOT NULL,
  establishment_name text,
  message text,
  status text NOT NULL DEFAULT 'sent',
  provider_message_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_broadcast_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can manage broadcast logs"
  ON public.admin_broadcast_logs FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));