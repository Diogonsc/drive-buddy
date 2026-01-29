-- =====================================================
-- DriveZapSync - Database Schema (PRODUÇÃO)
-- =====================================================

-- =========================
-- ENUMS
-- =========================

CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TYPE public.sync_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed'
);

CREATE TYPE public.media_type AS ENUM (
  'image',
  'video',
  'audio',
  'document'
);

CREATE TYPE public.connection_status AS ENUM (
  'connected',
  'disconnected',
  'pending',
  'error'
);

CREATE TYPE public.plan_type AS ENUM (
  'free',
  'starter',
  'pro',
  'business'
);

-- =========================
-- USER ROLES
-- =========================

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, role)
);

-- =========================
-- CONNECTIONS
-- =========================

CREATE TABLE public.connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- WhatsApp
  whatsapp_phone_number_id TEXT,
  whatsapp_business_account_id TEXT,
  whatsapp_access_token TEXT,
  whatsapp_webhook_verify_token TEXT,
  whatsapp_status connection_status DEFAULT 'disconnected',
  whatsapp_connected_at TIMESTAMPTZ,

  -- Google Drive
  google_client_id TEXT,
  google_client_secret TEXT,
  google_redirect_uri TEXT,
  google_access_token TEXT,
  google_refresh_token TEXT,
  google_token_expires_at TIMESTAMPTZ,
  google_status connection_status DEFAULT 'disconnected',
  google_connected_at TIMESTAMPTZ,
  google_root_folder TEXT DEFAULT '/WhatsApp Uploads',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (user_id)
);

-- =========================
-- USER SETTINGS
-- =========================

CREATE TABLE public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  auto_create_folders BOOLEAN DEFAULT TRUE,
  organize_by_date BOOLEAN DEFAULT TRUE,
  organize_by_type BOOLEAN DEFAULT TRUE,
  organize_by_contact BOOLEAN DEFAULT FALSE,

  max_file_size_mb INTEGER DEFAULT 25,
  enable_notifications BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (user_id)
);

-- =========================
-- SUBSCRIPTIONS (STRIPE)
-- =========================

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  plan plan_type NOT NULL DEFAULT 'free',
  status TEXT NOT NULL, -- active | past_due | canceled

  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_end TIMESTAMPTZ,

  monthly_file_limit INTEGER,
  monthly_storage_mb INTEGER,
  files_used_current_month INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (user_id)
);

-- =========================
-- MEDIA FILES
-- =========================

CREATE TABLE public.media_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  whatsapp_media_id TEXT NOT NULL,
  whatsapp_message_id TEXT,
  sender_phone TEXT,
  sender_name TEXT,

  file_name TEXT NOT NULL,
  file_type media_type NOT NULL,
  file_size_bytes BIGINT,
  mime_type TEXT,

  google_drive_file_id TEXT,
  google_drive_folder_id TEXT,
  google_drive_url TEXT,

  status sync_status DEFAULT 'pending',
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  is_permanent_failure BOOLEAN DEFAULT FALSE,
  last_attempt_at TIMESTAMPTZ,

  received_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  uploaded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (whatsapp_media_id, user_id)
);

-- Idempotência extra (mensagens duplicadas)
CREATE UNIQUE INDEX idx_unique_whatsapp_message
ON public.media_files (whatsapp_message_id, user_id)
WHERE whatsapp_message_id IS NOT NULL;

-- =========================
-- SYNC LOGS
-- =========================

CREATE TABLE public.sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  media_file_id UUID REFERENCES public.media_files(id) ON DELETE SET NULL,

  action TEXT NOT NULL,
  status sync_status NOT NULL,
  message TEXT,
  metadata JSONB,
  source TEXT DEFAULT 'system',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================
-- INDEXES
-- =========================

CREATE INDEX idx_media_files_user_id ON public.media_files(user_id);
CREATE INDEX idx_media_files_status ON public.media_files(status);
CREATE INDEX idx_media_files_received_at ON public.media_files(received_at DESC);
CREATE INDEX idx_sync_logs_user_id ON public.sync_logs(user_id);
CREATE INDEX idx_sync_logs_created_at ON public.sync_logs(created_at DESC);
CREATE INDEX idx_connections_user_id ON public.connections(user_id);

-- =========================
-- UPDATED_AT TRIGGER
-- =========================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_connections_updated_at
BEFORE UPDATE ON public.connections
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================
-- NEW USER BOOTSTRAP
-- =========================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id);

  INSERT INTO public.connections (user_id)
  VALUES (NEW.id);

  INSERT INTO public.subscriptions (
    user_id,
    plan,
    status,
    monthly_file_limit,
    monthly_storage_mb
  ) VALUES (
    NEW.id,
    'free',
    'active',
    300,
    1024
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
