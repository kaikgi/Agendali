
-- =============================================
-- FIX 1: Update email_type constraint to allow ALL valid email types
-- =============================================
ALTER TABLE public.appointment_email_jobs DROP CONSTRAINT IF EXISTS appointment_email_jobs_email_type_check;
ALTER TABLE public.appointment_email_jobs ADD CONSTRAINT appointment_email_jobs_email_type_check 
CHECK (email_type = ANY (ARRAY[
  'appointment_confirmation'::text,
  'appointment_pending_approval'::text,
  'appointment_cancelled'::text,
  'appointment_rescheduled'::text,
  'appointment_completed'::text,
  'appointment_no_show'::text,
  'appointment_rejected'::text,
  'appointment_reminder'::text,
  'appointment_reminder_24h'::text,
  'appointment_reminder_2h'::text,
  'appointment_payment_received'::text,
  'appointment_payment_confirmed_auto'::text,
  'appointment_payment_failed'::text
]));

-- =============================================
-- FIX 2: Create a DB trigger on appointments for automatic email dispatch
-- This ensures emails are ALWAYS sent regardless of which path changes the status
-- =============================================
CREATE OR REPLACE FUNCTION public.trg_appointment_status_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire on actual status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Skip intermediate statuses that don't need customer emails
    IF NEW.status IN ('arrived', 'in_service') THEN
      RETURN NEW;
    END IF;
    
    -- Call the centralized notification RPC
    PERFORM public.notify_appointment_status_change(
      NEW.id,
      NEW.status,
      OLD.status
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop if exists to avoid duplicate
DROP TRIGGER IF EXISTS trg_appointment_status_email ON public.appointments;

CREATE TRIGGER trg_appointment_status_email
  AFTER UPDATE OF status ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_appointment_status_email();
