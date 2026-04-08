-- =====================================================
-- Admin access to media_files for management panel
-- =====================================================

-- Admin can read all media_files (reprocess, inspect, monitor)
DROP POLICY IF EXISTS "Admins view all media files" ON public.media_files;
CREATE POLICY "Admins view all media files"
ON public.media_files
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin can update media_files (e.g. reset status for reprocessing)
DROP POLICY IF EXISTS "Admins update media files" ON public.media_files;
CREATE POLICY "Admins update media files"
ON public.media_files
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admin can read all user settings (for support)
DROP POLICY IF EXISTS "Admins view all user settings" ON public.user_settings;
CREATE POLICY "Admins view all user settings"
ON public.user_settings
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin can read all integration_status (health dashboard)
DROP POLICY IF EXISTS "Admins view all integration status" ON public.integration_status;
CREATE POLICY "Admins view all integration status"
ON public.integration_status
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin can read all integration_health_logs
DROP POLICY IF EXISTS "Admins view all health logs" ON public.integration_health_logs;
CREATE POLICY "Admins view all health logs"
ON public.integration_health_logs
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
