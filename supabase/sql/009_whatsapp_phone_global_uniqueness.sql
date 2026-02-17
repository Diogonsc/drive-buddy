-- =====================================================
-- Prevent active phone_number collisions across tenants
-- =====================================================

-- A phone number must not be active (connected/pending) in more than one account.
-- We keep disconnected/error rows for audit history.
CREATE UNIQUE INDEX IF NOT EXISTS ux_whatsapp_connections_active_phone
ON public.whatsapp_connections (phone_number_id)
WHERE phone_number_id IS NOT NULL
  AND status IN ('connected', 'pending');
