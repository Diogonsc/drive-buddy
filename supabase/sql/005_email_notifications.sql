-- =====================================================
-- Email Notifications Log (controle de cooldown e histórico)
-- =====================================================

CREATE TABLE IF NOT EXISTS email_notifications_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  service_name TEXT NOT NULL,
  message TEXT NOT NULL,
  email_to TEXT NOT NULL,
  resend_id TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index para consulta de cooldown (user + tipo + data)
CREATE INDEX IF NOT EXISTS idx_email_notifications_cooldown 
  ON email_notifications_log (user_id, alert_type, sent_at DESC);

-- RLS
ALTER TABLE email_notifications_log ENABLE ROW LEVEL SECURITY;

-- Usuário vê apenas seus próprios logs de notificação
CREATE POLICY "Users can view own email notifications"
  ON email_notifications_log FOR SELECT
  USING (auth.uid() = user_id);

-- Service role pode inserir (usado pela edge function)
CREATE POLICY "Service role can insert email notifications"
  ON email_notifications_log FOR INSERT
  WITH CHECK (true);
