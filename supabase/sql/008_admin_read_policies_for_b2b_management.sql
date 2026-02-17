-- =====================================================
-- Admin read policies for multi integration management
-- =====================================================

-- New B2B tables
DROP POLICY IF EXISTS "Admins view all whatsapp connections" ON public.whatsapp_connections;
CREATE POLICY "Admins view all whatsapp connections"
ON public.whatsapp_connections
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins view all google accounts" ON public.google_drive_accounts;
CREATE POLICY "Admins view all google accounts"
ON public.google_drive_accounts
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins view all routing rules" ON public.media_routing_rules;
CREATE POLICY "Admins view all routing rules"
ON public.media_routing_rules
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Legacy/core tables used in admin dashboarding
DROP POLICY IF EXISTS "Admins view all connections" ON public.connections;
CREATE POLICY "Admins view all connections"
ON public.connections
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins view all subscriptions" ON public.subscriptions;
CREATE POLICY "Admins view all subscriptions"
ON public.subscriptions
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins view all media files" ON public.media_files;
CREATE POLICY "Admins view all media files"
ON public.media_files
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
