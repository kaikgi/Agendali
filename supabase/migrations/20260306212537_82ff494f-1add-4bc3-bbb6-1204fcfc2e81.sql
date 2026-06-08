
-- Update default status from 'trial' to 'active' for establishments
ALTER TABLE public.establishments ALTER COLUMN status SET DEFAULT 'active';

-- Update default plano from 'nenhum' to 'solo'
ALTER TABLE public.establishments ALTER COLUMN plano SET DEFAULT 'solo';
