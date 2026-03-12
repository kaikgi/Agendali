
-- Create establishment notifications table
CREATE TABLE public.establishment_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  type text NOT NULL, -- 'new_appointment', 'cancelled_appointment', 'new_rating', 'rescheduled_appointment', 'pending_approval'
  title text NOT NULL,
  message text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_establishment_notifications_establishment ON public.establishment_notifications(establishment_id, created_at DESC);
CREATE INDEX idx_establishment_notifications_unread ON public.establishment_notifications(establishment_id, is_read) WHERE is_read = false;

-- Enable RLS
ALTER TABLE public.establishment_notifications ENABLE ROW LEVEL SECURITY;

-- Owner can read own notifications
CREATE POLICY "Owner can read notifications"
  ON public.establishment_notifications FOR SELECT
  TO authenticated
  USING (establishment_id IN (
    SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()
  ));

-- Owner can update (mark as read)
CREATE POLICY "Owner can update notifications"
  ON public.establishment_notifications FOR UPDATE
  TO authenticated
  USING (establishment_id IN (
    SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()
  ))
  WITH CHECK (establishment_id IN (
    SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()
  ));

-- Owner can delete notifications
CREATE POLICY "Owner can delete notifications"
  ON public.establishment_notifications FOR DELETE
  TO authenticated
  USING (establishment_id IN (
    SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()
  ));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.establishment_notifications;

-- Function to create notification on new appointment
CREATE OR REPLACE FUNCTION public.trg_notify_new_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_name text;
  v_service_name text;
  v_professional_name text;
  v_start_date text;
  v_start_time text;
  v_title text;
  v_message text;
  v_type text;
BEGIN
  -- Only on INSERT
  SELECT name INTO v_customer_name FROM public.customers WHERE id = NEW.customer_id;
  SELECT name INTO v_service_name FROM public.services WHERE id = NEW.service_id;
  SELECT name INTO v_professional_name FROM public.professionals WHERE id = NEW.professional_id;

  v_start_date := to_char(NEW.start_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM');
  v_start_time := to_char(NEW.start_at AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI');

  IF NEW.status = 'pending_approval' THEN
    v_type := 'pending_approval';
    v_title := 'Agendamento aguardando aprovação';
    v_message := coalesce(v_customer_name, 'Cliente') || ' solicitou ' || coalesce(v_service_name, 'serviço') ||
                 ' com ' || coalesce(v_professional_name, 'profissional') ||
                 ' em ' || v_start_date || ' às ' || v_start_time;
  ELSIF NEW.status = 'pending_payment' THEN
    v_type := 'new_appointment';
    v_title := 'Novo agendamento (aguardando pagamento)';
    v_message := coalesce(v_customer_name, 'Cliente') || ' agendou ' || coalesce(v_service_name, 'serviço') ||
                 ' com ' || coalesce(v_professional_name, 'profissional') ||
                 ' em ' || v_start_date || ' às ' || v_start_time;
  ELSE
    v_type := 'new_appointment';
    v_title := 'Novo agendamento';
    v_message := coalesce(v_customer_name, 'Cliente') || ' agendou ' || coalesce(v_service_name, 'serviço') ||
                 ' com ' || coalesce(v_professional_name, 'profissional') ||
                 ' em ' || v_start_date || ' às ' || v_start_time;
  END IF;

  INSERT INTO public.establishment_notifications (
    establishment_id, type, title, message, appointment_id, data
  ) VALUES (
    NEW.establishment_id,
    v_type,
    v_title,
    v_message,
    NEW.id,
    jsonb_build_object(
      'appointment_id', NEW.id,
      'customer_name', coalesce(v_customer_name, 'Cliente'),
      'service_name', coalesce(v_service_name, 'Serviço'),
      'professional_name', coalesce(v_professional_name, 'Profissional'),
      'start_at', NEW.start_at,
      'status', NEW.status
    )
  );

  RETURN NEW;
END;
$$;

-- Trigger on appointments INSERT
CREATE TRIGGER trg_appointment_notify_establishment
  AFTER INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_new_appointment();

-- Function to notify on cancellation/status changes
CREATE OR REPLACE FUNCTION public.trg_notify_appointment_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_name text;
  v_service_name text;
  v_professional_name text;
  v_start_date text;
  v_start_time text;
  v_title text;
  v_message text;
  v_type text;
BEGIN
  -- Only fire on status change
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_customer_name FROM public.customers WHERE id = NEW.customer_id;
  SELECT name INTO v_service_name FROM public.services WHERE id = NEW.service_id;
  SELECT name INTO v_professional_name FROM public.professionals WHERE id = NEW.professional_id;
  v_start_date := to_char(NEW.start_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM');
  v_start_time := to_char(NEW.start_at AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI');

  CASE NEW.status
    WHEN 'canceled', 'canceled_by_customer', 'canceled_by_establishment' THEN
      v_type := 'cancelled_appointment';
      v_title := 'Agendamento cancelado';
      v_message := coalesce(v_customer_name, 'Cliente') || ' cancelou ' || coalesce(v_service_name, 'serviço') ||
                   ' de ' || v_start_date || ' às ' || v_start_time;
    WHEN 'rescheduled' THEN
      v_type := 'rescheduled_appointment';
      v_title := 'Agendamento reagendado';
      v_message := coalesce(v_customer_name, 'Cliente') || ' reagendou ' || coalesce(v_service_name, 'serviço') ||
                   ' para ' || v_start_date || ' às ' || v_start_time;
    ELSE
      -- Don't notify for other status changes (completed, no_show, confirmed, etc.)
      RETURN NEW;
  END CASE;

  INSERT INTO public.establishment_notifications (
    establishment_id, type, title, message, appointment_id, data
  ) VALUES (
    NEW.establishment_id,
    v_type,
    v_title,
    v_message,
    NEW.id,
    jsonb_build_object(
      'appointment_id', NEW.id,
      'customer_name', coalesce(v_customer_name, 'Cliente'),
      'service_name', coalesce(v_service_name, 'Serviço'),
      'professional_name', coalesce(v_professional_name, 'Profissional'),
      'start_at', NEW.start_at,
      'status', NEW.status
    )
  );

  RETURN NEW;
END;
$$;

-- Trigger on appointments UPDATE for status changes
CREATE TRIGGER trg_appointment_status_notify_establishment
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_appointment_status_change();
