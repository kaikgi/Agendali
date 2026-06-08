-- Allow authenticated users to select their own establishments
CREATE POLICY "Users can view their own establishments"
ON public.establishments
FOR SELECT
USING (auth.uid() = owner_user_id);

-- Allow anyone to view establishments by slug (for public booking pages)
CREATE POLICY "Public can view establishments by slug"
ON public.establishments
FOR SELECT
USING (true);

-- Allow authenticated users to select their own profiles
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id);
