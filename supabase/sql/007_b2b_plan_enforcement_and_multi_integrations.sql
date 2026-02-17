-- =====================================================
-- Swiftwapdrive - B2B SaaS hardening (Plans + Multi Integrations)
-- =====================================================

-- -------------------------
-- 1) Subscription limits per tenant
-- -------------------------
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS whatsapp_numbers_limit INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS google_accounts_limit INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS overage_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Ensure sane defaults if old rows existed
UPDATE public.subscriptions
SET
  whatsapp_numbers_limit = COALESCE(whatsapp_numbers_limit, 1),
  google_accounts_limit = COALESCE(google_accounts_limit, 1),
  overage_enabled = COALESCE(overage_enabled, FALSE),
  features = COALESCE(features, '{}'::jsonb);

-- Align existing plan presets with the commercial positioning
UPDATE public.subscriptions
SET
  monthly_file_limit = CASE
    WHEN plan = 'starter' THEN 100
    WHEN plan = 'pro' THEN 500
    WHEN plan = 'business' THEN 10000
    ELSE COALESCE(monthly_file_limit, 100)
  END,
  whatsapp_numbers_limit = CASE
    WHEN plan = 'starter' THEN 1
    WHEN plan = 'pro' THEN 3
    WHEN plan = 'business' THEN 10
    ELSE COALESCE(whatsapp_numbers_limit, 1)
  END,
  google_accounts_limit = CASE
    WHEN plan = 'starter' THEN 1
    WHEN plan = 'pro' THEN 3
    WHEN plan = 'business' THEN 10
    ELSE COALESCE(google_accounts_limit, 1)
  END,
  features = CASE
    WHEN plan = 'starter' THEN jsonb_build_object(
      'automatic_organization', true,
      'monthly_reports', false,
      'priority_support', false,
      'advanced_dashboard', false,
      'custom_organization', false
    )
    WHEN plan = 'pro' THEN jsonb_build_object(
      'automatic_organization', true,
      'monthly_reports', true,
      'priority_support', true,
      'advanced_dashboard', true,
      'custom_organization', false
    )
    WHEN plan = 'business' THEN jsonb_build_object(
      'automatic_organization', true,
      'monthly_reports', true,
      'priority_support', true,
      'advanced_dashboard', true,
      'custom_organization', true
    )
    ELSE features
  END;

-- -------------------------
-- 2) Multi WhatsApp connections
-- -------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  label TEXT,
  phone_number_id TEXT NOT NULL,
  business_account_id TEXT,
  access_token TEXT,
  webhook_verify_token TEXT,
  status connection_status NOT NULL DEFAULT 'pending',
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, phone_number_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_user_id
  ON public.whatsapp_connections(user_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_status
  ON public.whatsapp_connections(status);

-- -------------------------
-- 3) Multi Google Drive accounts
-- -------------------------
CREATE TABLE IF NOT EXISTS public.google_drive_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  label TEXT,
  account_email TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  root_folder_path TEXT NOT NULL DEFAULT '/WhatsApp Uploads',
  root_folder_id TEXT,
  status connection_status NOT NULL DEFAULT 'disconnected',
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_google_drive_accounts_user_id
  ON public.google_drive_accounts(user_id);

CREATE INDEX IF NOT EXISTS idx_google_drive_accounts_status
  ON public.google_drive_accounts(status);

-- -------------------------
-- 4) Routing rules WhatsApp -> Drive account
-- -------------------------
CREATE TABLE IF NOT EXISTS public.media_routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  whatsapp_connection_id UUID REFERENCES public.whatsapp_connections(id) ON DELETE CASCADE NOT NULL,
  google_drive_account_id UUID REFERENCES public.google_drive_accounts(id) ON DELETE CASCADE NOT NULL,
  file_type media_type,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_routing_rules_user_id
  ON public.media_routing_rules(user_id);

CREATE INDEX IF NOT EXISTS idx_media_routing_rules_whatsapp
  ON public.media_routing_rules(whatsapp_connection_id);

-- -------------------------
-- 5) media_files references for auditability
-- -------------------------
ALTER TABLE public.media_files
ADD COLUMN IF NOT EXISTS whatsapp_connection_id UUID REFERENCES public.whatsapp_connections(id) ON DELETE SET NULL;

ALTER TABLE public.media_files
ADD COLUMN IF NOT EXISTS google_drive_account_id UUID REFERENCES public.google_drive_accounts(id) ON DELETE SET NULL;

-- -------------------------
-- 6) updated_at triggers
-- -------------------------
DROP TRIGGER IF EXISTS update_whatsapp_connections_updated_at ON public.whatsapp_connections;
CREATE TRIGGER update_whatsapp_connections_updated_at
BEFORE UPDATE ON public.whatsapp_connections
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_google_drive_accounts_updated_at ON public.google_drive_accounts;
CREATE TRIGGER update_google_drive_accounts_updated_at
BEFORE UPDATE ON public.google_drive_accounts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_media_routing_rules_updated_at ON public.media_routing_rules;
CREATE TRIGGER update_media_routing_rules_updated_at
BEFORE UPDATE ON public.media_routing_rules
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -------------------------
-- 7) Bootstrap migration from legacy single-row "connections"
-- -------------------------
INSERT INTO public.whatsapp_connections (
  user_id,
  label,
  phone_number_id,
  business_account_id,
  access_token,
  webhook_verify_token,
  status,
  connected_at
)
SELECT
  c.user_id,
  'Principal',
  c.whatsapp_phone_number_id,
  c.whatsapp_business_account_id,
  c.whatsapp_access_token,
  c.whatsapp_webhook_verify_token,
  COALESCE(c.whatsapp_status, 'disconnected')::connection_status,
  c.whatsapp_connected_at
FROM public.connections c
WHERE c.whatsapp_phone_number_id IS NOT NULL
ON CONFLICT (user_id, phone_number_id) DO UPDATE
SET
  business_account_id = EXCLUDED.business_account_id,
  access_token = EXCLUDED.access_token,
  webhook_verify_token = EXCLUDED.webhook_verify_token,
  status = EXCLUDED.status,
  connected_at = EXCLUDED.connected_at,
  updated_at = NOW();

INSERT INTO public.google_drive_accounts (
  user_id,
  label,
  access_token,
  refresh_token,
  token_expires_at,
  root_folder_path,
  status,
  connected_at
)
SELECT
  c.user_id,
  'Principal',
  c.google_access_token,
  c.google_refresh_token,
  c.google_token_expires_at,
  COALESCE(c.google_root_folder, '/WhatsApp Uploads'),
  COALESCE(c.google_status, 'disconnected')::connection_status,
  c.google_connected_at
FROM public.connections c
WHERE c.google_access_token IS NOT NULL OR c.google_refresh_token IS NOT NULL
ON CONFLICT DO NOTHING;

-- -------------------------
-- 8) RLS
-- -------------------------
ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_drive_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_routing_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own whatsapp connections" ON public.whatsapp_connections;
CREATE POLICY "Users manage own whatsapp connections"
ON public.whatsapp_connections
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role whatsapp connections" ON public.whatsapp_connections;
CREATE POLICY "Service role whatsapp connections"
ON public.whatsapp_connections
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Users manage own google accounts" ON public.google_drive_accounts;
CREATE POLICY "Users manage own google accounts"
ON public.google_drive_accounts
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role google accounts" ON public.google_drive_accounts;
CREATE POLICY "Service role google accounts"
ON public.google_drive_accounts
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Users manage own routing rules" ON public.media_routing_rules;
CREATE POLICY "Users manage own routing rules"
ON public.media_routing_rules
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role routing rules" ON public.media_routing_rules;
CREATE POLICY "Service role routing rules"
ON public.media_routing_rules
FOR ALL TO service_role
USING (true)
WITH CHECK (true);
