-- =====================================================
-- DriveZapSync - Row Level Security Policies
-- Execute este script APÓS criar as tabelas
-- =====================================================

-- =====================================================
-- FUNÇÃO: has_role (Security Definer)
-- Verifica roles sem recursão
-- =====================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- =====================================================
-- HABILITAR RLS em todas as tabelas
-- =====================================================
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLICIES: user_roles
-- =====================================================

-- Usuários podem ver apenas seus próprios roles
CREATE POLICY "Users can view own roles"
    ON public.user_roles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Admins podem ver todos os roles
CREATE POLICY "Admins can view all roles"
    ON public.user_roles
    FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- Apenas admins podem inserir/atualizar/deletar roles
CREATE POLICY "Admins can manage roles"
    ON public.user_roles
    FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- POLICIES: connections
-- =====================================================

-- Usuários podem ver suas próprias conexões
CREATE POLICY "Users can view own connections"
    ON public.connections
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Usuários podem atualizar suas próprias conexões
CREATE POLICY "Users can update own connections"
    ON public.connections
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Usuários podem inserir suas próprias conexões
CREATE POLICY "Users can insert own connections"
    ON public.connections
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- POLICIES: user_settings
-- =====================================================

-- Usuários podem ver suas próprias configurações
CREATE POLICY "Users can view own settings"
    ON public.user_settings
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Usuários podem atualizar suas próprias configurações
CREATE POLICY "Users can update own settings"
    ON public.user_settings
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Usuários podem inserir suas próprias configurações
CREATE POLICY "Users can insert own settings"
    ON public.user_settings
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- POLICIES: media_files
-- =====================================================

-- Usuários podem ver seus próprios arquivos
CREATE POLICY "Users can view own media files"
    ON public.media_files
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Usuários podem inserir seus próprios arquivos
CREATE POLICY "Users can insert own media files"
    ON public.media_files
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Usuários podem atualizar seus próprios arquivos
CREATE POLICY "Users can update own media files"
    ON public.media_files
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Usuários podem deletar seus próprios arquivos
CREATE POLICY "Users can delete own media files"
    ON public.media_files
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Service role pode fazer tudo (para Edge Functions)
CREATE POLICY "Service role full access media files"
    ON public.media_files
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- POLICIES: sync_logs
-- =====================================================

-- Usuários podem ver seus próprios logs
CREATE POLICY "Users can view own sync logs"
    ON public.sync_logs
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Usuários podem inserir seus próprios logs
CREATE POLICY "Users can insert own sync logs"
    ON public.sync_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Service role pode fazer tudo (para Edge Functions)
CREATE POLICY "Service role full access sync logs"
    ON public.sync_logs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Admins podem ver todos os logs
CREATE POLICY "Admins can view all sync logs"
    ON public.sync_logs
    FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- POLICY ESPECIAL: Webhook público (anon)
-- Para receber webhooks do WhatsApp sem auth
-- =====================================================

-- Permitir que anon insira arquivos de mídia via webhook
CREATE POLICY "Anon can insert media files via webhook"
    ON public.media_files
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- Permitir que anon insira logs via webhook
CREATE POLICY "Anon can insert sync logs via webhook"
    ON public.sync_logs
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- Permitir que anon leia connections para validar webhook
CREATE POLICY "Anon can read connections for webhook validation"
    ON public.connections
    FOR SELECT
    TO anon
    USING (true);
