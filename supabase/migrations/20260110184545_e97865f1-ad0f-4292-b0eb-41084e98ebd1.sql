-- Create RPC for professional to update their own profile via portal
CREATE OR REPLACE FUNCTION public.professional_update_profile(
  p_token text,
  p_name text DEFAULT NULL,
  p_photo_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_session jsonb;
  v_professional_id uuid;
  v_establishment_id uuid;
  v_result jsonb;
BEGIN
  -- Validate session
  v_session := validate_professional_session(p_token);
  
  IF NOT (v_session ->> 'valid')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida');
  END IF;

  v_professional_id := (v_session ->> 'professional_id')::uuid;
  v_establishment_id := (v_session ->> 'establishment_id')::uuid;

  -- Update only provided fields
  UPDATE public.professionals
  SET 
    name = COALESCE(NULLIF(TRIM(p_name), ''), name),
    photo_url = CASE WHEN p_photo_url IS NOT NULL THEN p_photo_url ELSE photo_url END
  WHERE id = v_professional_id;

  -- Return updated professional data
  SELECT jsonb_build_object(
    'success', true,
    'professional', jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'photo_url', p.photo_url,
      'slug', p.slug
    ),
    'message', 'Perfil atualizado com sucesso'
  ) INTO v_result
  FROM public.professionals p
  WHERE p.id = v_professional_id;

  RETURN v_result;
END;
$$;