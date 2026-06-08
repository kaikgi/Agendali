-- ===================================
-- 1. Tabela de avaliações (ratings)
-- ===================================
CREATE TABLE public.ratings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  customer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  stars integer NOT NULL CHECK (stars >= 1 AND stars <= 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(appointment_id)
);

-- Índices para performance
CREATE INDEX idx_ratings_establishment ON public.ratings(establishment_id);
CREATE INDEX idx_ratings_customer_user ON public.ratings(customer_user_id);

-- RLS para ratings
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

-- Clientes podem inserir avaliação apenas para seus próprios agendamentos concluídos
CREATE POLICY "Clients can insert own rating"
ON public.ratings
FOR INSERT
WITH CHECK (
  auth.uid() = customer_user_id 
  AND EXISTS (
    SELECT 1 FROM public.appointments a 
    WHERE a.id = appointment_id 
    AND a.customer_user_id = auth.uid() 
    AND a.status = 'completed'
  )
);

-- Qualquer um pode ver avaliações (para exibição pública)
CREATE POLICY "Anyone can view ratings"
ON public.ratings
FOR SELECT
USING (true);

-- Apenas o cliente pode atualizar sua própria avaliação
CREATE POLICY "Clients can update own rating"
ON public.ratings
FOR UPDATE
USING (auth.uid() = customer_user_id);

-- Membros do estabelecimento podem ver avaliações
CREATE POLICY "Members can view establishment ratings"
ON public.ratings
FOR SELECT
USING (is_establishment_member(establishment_id));

-- ===================================
-- 2. Tabela de prompts de conclusão (evita pop-up repetido)
-- ===================================
CREATE TABLE public.appointment_completion_prompts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_type text NOT NULL CHECK (user_type IN ('customer', 'establishment', 'professional')),
  prompted_at timestamptz NOT NULL DEFAULT now(),
  action_taken text CHECK (action_taken IN ('dismissed', 'completed', 'not_yet')),
  UNIQUE(appointment_id, user_id)
);

-- Índices
CREATE INDEX idx_completion_prompts_appointment ON public.appointment_completion_prompts(appointment_id);
CREATE INDEX idx_completion_prompts_user ON public.appointment_completion_prompts(user_id);

-- RLS para prompts
ALTER TABLE public.appointment_completion_prompts ENABLE ROW LEVEL SECURITY;

-- Usuários podem inserir/atualizar seus próprios prompts
CREATE POLICY "Users can manage own prompts"
ON public.appointment_completion_prompts
FOR ALL
USING (auth.uid()::text = user_id::text OR auth.uid() = user_id)
WITH CHECK (auth.uid()::text = user_id::text OR auth.uid() = user_id);

-- Membros podem ver prompts de seus estabelecimentos
CREATE POLICY "Members can view establishment prompts"
ON public.appointment_completion_prompts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.appointments a 
    WHERE a.id = appointment_id 
    AND is_establishment_member(a.establishment_id)
  )
);

-- ===================================
-- 3. Adicionar colunas na tabela appointments
-- ===================================
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS completed_at timestamptz,
ADD COLUMN IF NOT EXISTS completed_by text CHECK (completed_by IN ('customer', 'establishment', 'professional'));

-- ===================================
-- 4. View para média de avaliações por estabelecimento
-- ===================================
CREATE OR REPLACE VIEW public.v_establishment_ratings AS
SELECT 
  establishment_id,
  ROUND(AVG(stars)::numeric, 1) as rating_avg,
  COUNT(*)::integer as rating_count
FROM public.ratings
GROUP BY establishment_id;

-- ===================================
-- 5. Função para obter rating do estabelecimento
-- ===================================
CREATE OR REPLACE FUNCTION public.get_establishment_rating(p_establishment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'rating_avg', COALESCE(ROUND(AVG(stars)::numeric, 1), 0),
    'rating_count', COUNT(*)::integer
  ) INTO v_result
  FROM public.ratings
  WHERE establishment_id = p_establishment_id;
  
  RETURN v_result;
END;
$$;