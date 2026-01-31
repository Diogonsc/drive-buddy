-- =====================================================
-- SwiftwapdriveSync - RLS Policies
-- =====================================================

-- =========================
-- HELPER FUNCTION
-- =========================

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- =========================
-- ENABLE RLS
-- =========================

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

-- =========================
-- USER ROLES
-- =========================

CREATE POLICY "Users view own roles"
ON public.user_roles
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins manage roles"
ON public.user_roles
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================
-- CONNECTIONS / SETTINGS / SUBSCRIPTIONS
-- =========================

CREATE POLICY "Users manage own connections"
ON public.connections
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own settings"
ON public.user_settings
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own subscription"
ON public.subscriptions
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- =========================
-- MEDIA FILES
-- =========================

CREATE POLICY "Users manage own media"
ON public.media_files
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access media"
ON public.media_files
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- =========================
-- SYNC LOGS
-- =========================

CREATE POLICY "Users view own logs"
ON public.sync_logs
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service role full access logs"
ON public.sync_logs
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins view all logs"
ON public.sync_logs
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =========================
-- WEBHOOK (ANON)
-- =========================

CREATE POLICY "Webhook insert media"
ON public.media_files
FOR INSERT TO anon
WITH CHECK (true);

CREATE POLICY "Webhook insert logs"
ON public.sync_logs
FOR INSERT TO anon
WITH CHECK (true);

CREATE POLICY "Webhook read connections"
ON public.connections
FOR SELECT TO anon
USING (true);
