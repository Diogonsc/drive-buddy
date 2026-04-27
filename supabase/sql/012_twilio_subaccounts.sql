-- =====================================================
-- Swiftwapdrive - Twilio Subaccount por cliente
-- =====================================================

-- Adiciona campos de subaccount Twilio na tabela whatsapp_connections
ALTER TABLE public.whatsapp_connections
  ADD COLUMN IF NOT EXISTS twilio_subaccount_sid TEXT,
  ADD COLUMN IF NOT EXISTS twilio_subaccount_auth_token TEXT,
  ADD COLUMN IF NOT EXISTS twilio_whatsapp_number TEXT,
  ADD COLUMN IF NOT EXISTS twilio_number_sid TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone_number TEXT,
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'twilio';

-- Remove NOT NULL de phone_number_id (era obrigatório na Meta)
ALTER TABLE public.whatsapp_connections
  ALTER COLUMN phone_number_id DROP NOT NULL;

-- Remove campos exclusivos da Meta
ALTER TABLE public.whatsapp_connections
  DROP COLUMN IF EXISTS access_token,
  DROP COLUMN IF EXISTS business_account_id,
  DROP COLUMN IF EXISTS webhook_verify_token;

-- Índice para busca pelo número Twilio (usado no webhook)
CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_twilio_number
  ON public.whatsapp_connections (twilio_whatsapp_number)
  WHERE twilio_whatsapp_number IS NOT NULL;

-- Índice para busca pelo número do cliente
CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_customer_phone
  ON public.whatsapp_connections (customer_phone_number)
  WHERE customer_phone_number IS NOT NULL;

-- Garante unicidade do número Twilio ativo por tenant
CREATE UNIQUE INDEX IF NOT EXISTS ux_whatsapp_connections_twilio_number_active
  ON public.whatsapp_connections (twilio_whatsapp_number)
  WHERE twilio_whatsapp_number IS NOT NULL
    AND status IN ('connected', 'pending');

COMMENT ON COLUMN public.whatsapp_connections.twilio_subaccount_sid IS 'SID da subaccount Twilio criada para este cliente';
COMMENT ON COLUMN public.whatsapp_connections.twilio_whatsapp_number IS 'Número Twilio no formato whatsapp:+5511XXXXXXXX';
COMMENT ON COLUMN public.whatsapp_connections.customer_phone_number IS 'Número do cliente no formato +5511XXXXXXXX (input do onboarding)';
COMMENT ON COLUMN public.whatsapp_connections.provider IS 'Provedor: twilio';
