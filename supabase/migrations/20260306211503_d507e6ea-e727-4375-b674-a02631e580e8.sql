
-- Remove professional_services entries
DELETE FROM public.professional_services 
WHERE professional_id IN ('5d5e7bc2-a097-47f3-ab6c-3fd7d9cc8937', '0002927c-4d38-4d86-a00e-1fff4c77e0dc');

-- Remove professional_hours entries
DELETE FROM public.professional_hours 
WHERE professional_id IN ('5d5e7bc2-a097-47f3-ab6c-3fd7d9cc8937', '0002927c-4d38-4d86-a00e-1fff4c77e0dc');

-- Remove the professionals
DELETE FROM public.professionals 
WHERE id IN ('5d5e7bc2-a097-47f3-ab6c-3fd7d9cc8937', '0002927c-4d38-4d86-a00e-1fff4c77e0dc');
