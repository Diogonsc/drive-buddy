-- =====================================================
-- DriveZapSync - Database Schema
-- Execute este script no SQL Editor do Supabase
-- =====================================================

-- 1. Criar enum para roles de usuário
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 2. Criar enum para status de sincronização
CREATE TYPE public.sync_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- 3. Criar enum para tipo de mídia
CREATE TYPE public.media_type AS ENUM ('image', 'video', 'audio', 'document');

-- 4. Criar enum para status de conexão
CREATE TYPE public.connection_status AS ENUM ('connected', 'disconnected', 'pending', 'error');

-- =====================================================
-- TABELA: user_roles
-- Armazena os roles dos usuários (separado do profiles)
-- =====================================================
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, role)
);

-- =====================================================
-- TABELA: connections
-- Armazena as conexões do WhatsApp e Google Drive
-- =====================================================
CREATE TABLE public.connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- WhatsApp Config
    whatsapp_phone_number_id TEXT,
    whatsapp_business_account_id TEXT,
    whatsapp_access_token TEXT, -- Criptografado
    whatsapp_webhook_verify_token TEXT,
    whatsapp_status connection_status DEFAULT 'disconnected',
    whatsapp_connected_at TIMESTAMPTZ,
    
    -- Google Drive Config
    google_client_id TEXT,
    google_client_secret TEXT, -- Criptografado
    google_redirect_uri TEXT,
    google_access_token TEXT, -- Criptografado
    google_refresh_token TEXT, -- Criptografado
    google_token_expires_at TIMESTAMPTZ,
    google_status connection_status DEFAULT 'disconnected',
    google_connected_at TIMESTAMPTZ,
    google_root_folder TEXT DEFAULT '/WhatsApp Uploads',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE (user_id)
);

-- =====================================================
-- TABELA: user_settings
-- Configurações de organização de arquivos
-- =====================================================
CREATE TABLE public.user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Organização de pastas
    auto_create_folders BOOLEAN DEFAULT TRUE,
    organize_by_date BOOLEAN DEFAULT TRUE,
    organize_by_type BOOLEAN DEFAULT TRUE,
    organize_by_contact BOOLEAN DEFAULT FALSE,
    
    -- Limites
    max_file_size_mb INTEGER DEFAULT 25,
    
    -- Notificações
    enable_notifications BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE (user_id)
);

-- =====================================================
-- TABELA: media_files
-- Arquivos de mídia sincronizados
-- =====================================================
CREATE TABLE public.media_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Informações do WhatsApp
    whatsapp_media_id TEXT NOT NULL,
    whatsapp_message_id TEXT,
    sender_phone TEXT,
    sender_name TEXT,
    
    -- Informações do arquivo
    file_name TEXT NOT NULL,
    file_type media_type NOT NULL,
    file_size_bytes BIGINT,
    mime_type TEXT,
    
    -- Google Drive
    google_drive_file_id TEXT,
    google_drive_folder_id TEXT,
    google_drive_url TEXT,
    
    -- Status
    status sync_status DEFAULT 'pending',
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Timestamps
    received_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    uploaded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE (whatsapp_media_id, user_id)
);

-- =====================================================
-- TABELA: sync_logs
-- Logs de sincronização para auditoria
-- =====================================================
CREATE TABLE public.sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    media_file_id UUID REFERENCES public.media_files(id) ON DELETE SET NULL,
    
    -- Log info
    action TEXT NOT NULL, -- 'webhook_received', 'download_started', 'download_completed', 'upload_started', 'upload_completed', 'error'
    status sync_status NOT NULL,
    message TEXT,
    metadata JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ÍNDICES para performance
-- =====================================================
CREATE INDEX idx_media_files_user_id ON public.media_files(user_id);
CREATE INDEX idx_media_files_status ON public.media_files(status);
CREATE INDEX idx_media_files_file_type ON public.media_files(file_type);
CREATE INDEX idx_media_files_received_at ON public.media_files(received_at DESC);
CREATE INDEX idx_sync_logs_user_id ON public.sync_logs(user_id);
CREATE INDEX idx_sync_logs_created_at ON public.sync_logs(created_at DESC);
CREATE INDEX idx_sync_logs_status ON public.sync_logs(status);
CREATE INDEX idx_connections_user_id ON public.connections(user_id);

-- =====================================================
-- TRIGGERS para updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_connections_updated_at
    BEFORE UPDATE ON public.connections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON public.user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TRIGGER: Criar settings e connections ao criar usuário
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Criar role padrão
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
    
    -- Criar settings padrão
    INSERT INTO public.user_settings (user_id)
    VALUES (NEW.id);
    
    -- Criar connections vazio
    INSERT INTO public.connections (user_id)
    VALUES (NEW.id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
