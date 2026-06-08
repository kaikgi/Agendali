
-- professional_hours: cascade on professional delete
ALTER TABLE public.professional_hours
  DROP CONSTRAINT professional_hours_professional_id_fkey,
  ADD CONSTRAINT professional_hours_professional_id_fkey
    FOREIGN KEY (professional_id) REFERENCES public.professionals(id) ON DELETE CASCADE;

-- professional_services: cascade on professional delete
ALTER TABLE public.professional_services
  DROP CONSTRAINT professional_services_professional_id_fkey,
  ADD CONSTRAINT professional_services_professional_id_fkey
    FOREIGN KEY (professional_id) REFERENCES public.professionals(id) ON DELETE CASCADE;

-- professional_services: cascade on service delete
ALTER TABLE public.professional_services
  DROP CONSTRAINT professional_services_service_id_fkey,
  ADD CONSTRAINT professional_services_service_id_fkey
    FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;
