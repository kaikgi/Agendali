
-- Fix: The existing INSERT policy on profiles is RESTRICTIVE, which blocks inserts
-- when there's no permissive policy. Drop it and recreate as PERMISSIVE.

DROP POLICY IF EXISTS "Permissão total de inserção de perfil" ON public.profiles;

CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);
