DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_service_payment_settings_est_svc'
  ) THEN
    ALTER TABLE public.service_payment_settings
      ADD CONSTRAINT uq_service_payment_settings_est_svc
      UNIQUE (establishment_id, service_id);
  END IF;
END $$;