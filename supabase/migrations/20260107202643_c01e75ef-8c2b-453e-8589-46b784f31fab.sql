-- Enable realtime for appointments table
ALTER TABLE public.appointments REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;