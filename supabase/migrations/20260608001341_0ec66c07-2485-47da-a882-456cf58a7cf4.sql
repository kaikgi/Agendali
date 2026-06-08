-- 1. Versionamento de Documentos Legais
CREATE TABLE public.legal_document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('terms_of_use', 'privacy_policy', 'cookie_policy', 'security')),
    version TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_active BOOLEAN DEFAULT false,
    published_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Garantir que apenas uma versão por tipo esteja ativa
CREATE UNIQUE INDEX idx_legal_docs_active_type ON public.legal_document_versions (type) WHERE (is_active = true);

GRANT SELECT ON public.legal_document_versions TO anon, authenticated;
GRANT ALL ON public.legal_document_versions TO service_role;
ALTER TABLE public.legal_document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active legal documents" ON public.legal_document_versions
    FOR SELECT USING (is_active = true);

-- 2. Registro de Aceite de Termos (Multi-tenant)
CREATE TABLE public.legal_acceptance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    establishment_id UUID REFERENCES public.establishments(id),
    document_type TEXT NOT NULL,
    document_version TEXT NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

GRANT SELECT, INSERT ON public.legal_acceptance_logs TO authenticated;
GRANT SELECT ON public.legal_acceptance_logs TO anon; 
GRANT ALL ON public.legal_acceptance_logs TO service_role;
ALTER TABLE public.legal_acceptance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own acceptances" ON public.legal_acceptance_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Owners can view establishment acceptances" ON public.legal_acceptance_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.establishments e
            WHERE e.id = establishment_id AND e.owner_user_id = auth.uid()
        )
    );

-- 3. Central de Solicitações LGPD
CREATE TABLE public.privacy_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_name TEXT NOT NULL,
    requester_email TEXT NOT NULL,
    requester_phone TEXT,
    establishment_id UUID REFERENCES public.establishments(id),
    request_type TEXT NOT NULL CHECK (request_type IN ('access', 'correction', 'deletion', 'revocation', 'query')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'resolved', 'rejected')),
    notes TEXT,
    user_agent TEXT,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

GRANT INSERT ON public.privacy_requests TO anon, authenticated;
GRANT SELECT ON public.privacy_requests TO authenticated;
GRANT ALL ON public.privacy_requests TO service_role;
ALTER TABLE public.privacy_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a privacy request" ON public.privacy_requests
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view their own privacy requests" ON public.privacy_requests
    FOR SELECT USING (requester_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Owners can view privacy requests for their establishment" ON public.privacy_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.establishments e
            WHERE e.id = establishment_id AND e.owner_user_id = auth.uid()
        )
    );

-- 4. Logs de Auditoria do Sistema
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES auth.users(id),
    actor_role TEXT,
    establishment_id UUID REFERENCES public.establishments(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view audit logs for their establishment" ON public.audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.establishments e
            WHERE e.id = establishment_id AND e.owner_user_id = auth.uid()
        )
    );

-- 5. Inserir versões iniciais dos documentos
INSERT INTO public.legal_document_versions (type, version, title, content, is_active)
VALUES 
('terms_of_use', '1.0', 'Termos de Uso', 'Ao acessar e usar a plataforma Agendali, você concorda com nossos termos...', true),
('privacy_policy', '1.0', 'Política de Privacidade', 'Sua privacidade é importante para nós. Coletamos apenas o necessário...', true),
('cookie_policy', '1.0', 'Política de Cookies', 'Usamos cookies para melhorar sua experiência...', true),
('security', '1.0', 'Segurança', 'Nossos sistemas utilizam as melhores práticas de segurança...', true);
