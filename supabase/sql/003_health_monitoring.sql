-- =====================================================
-- Health Monitoring - Fase 3
-- =====================================================

-- =========================
-- HEALTH CHECK TYPES
-- =========================

CREATE TYPE public.health_check_type AS ENUM (
  'whatsapp_token',
  'whatsapp_webhook',
  'google_token',
  'google_api',
  'media_processing'
);

CREATE TYPE public.health_status AS ENUM (
  'healthy',
  'warning',
  'critical',
  'unknown'
);

-- =========================
-- INTEGRATION HEALTH LOGS
-- =========================

CREATE TABLE public.integration_health_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  check_type health_check_type NOT NULL,
  status health_status NOT NULL DEFAULT 'unknown',
  message TEXT,
  metadata JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_health_logs_user_id ON public.integration_health_logs(user_id);
CREATE INDEX idx_health_logs_created_at ON public.integration_health_logs(created_at DESC);
CREATE INDEX idx_health_logs_check_type ON public.integration_health_logs(check_type);

-- =========================
-- INTEGRATION STATUS (per user, updated by cron)
-- =========================

CREATE TABLE public.integration_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  whatsapp_health health_status DEFAULT 'unknown',
  whatsapp_last_check TIMESTAMPTZ,
  whatsapp_message TEXT,

  google_health health_status DEFAULT 'unknown',
  google_last_check TIMESTAMPTZ,
  google_message TEXT,

  processing_health health_status DEFAULT 'unknown',
  processing_last_check TIMESTAMPTZ,
  processing_message TEXT,

  overall_status health_status DEFAULT 'unknown',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (user_id)
);

CREATE TRIGGER update_integration_status_updated_at
BEFORE UPDATE ON public.integration_status
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Bootstrap: create integration_status for new users
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
    user_id, plan, status, monthly_file_limit, monthly_storage_mb
  ) VALUES (
    NEW.id, 'free', 'active', 300, 1024
  );

  INSERT INTO public.integration_status (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================
-- RLS POLICIES
-- =========================

ALTER TABLE public.integration_health_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own health logs"
  ON public.integration_health_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service can insert health logs"
  ON public.integration_health_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Users can read own integration status"
  ON public.integration_status FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service can manage integration status"
  ON public.integration_status FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to insert their own status (for bootstrap)
CREATE POLICY "Users can insert own integration status"
  ON public.integration_status FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
