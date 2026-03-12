-- Drop the old 11-arg version of public_create_appointment that causes PostgREST ambiguity
-- The 12-arg version (with p_requires_payment DEFAULT false) handles all cases
DROP FUNCTION IF EXISTS public.public_create_appointment(
  text, uuid, uuid, timestamptz, timestamptz, text, text, text, text, uuid, integer
);
