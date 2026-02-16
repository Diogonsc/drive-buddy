-- =====================================================
-- Migration: Alinhar user_settings com o frontend
-- Adiciona colunas que o frontend espera e remove as antigas
-- =====================================================

-- Novas colunas esperadas pelo frontend
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS auto_sync_enabled BOOLEAN DEFAULT TRUE;

ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS sync_images BOOLEAN DEFAULT TRUE;

ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS sync_videos BOOLEAN DEFAULT TRUE;

ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS sync_audio BOOLEAN DEFAULT TRUE;

ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS sync_documents BOOLEAN DEFAULT TRUE;

ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS folder_structure TEXT DEFAULT 'date_type';

ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS notification_on_error BOOLEAN DEFAULT TRUE;

ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS notification_on_success BOOLEAN DEFAULT FALSE;
