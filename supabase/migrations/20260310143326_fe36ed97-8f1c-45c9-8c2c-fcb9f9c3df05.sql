DROP INDEX IF EXISTS public.idx_billing_webhook_events_event_id;
CREATE UNIQUE INDEX idx_billing_webhook_events_event_id_type ON public.billing_webhook_events (event_id, event_type);