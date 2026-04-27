-- Migração: Meta → Twilio
-- Adaptação da tabela whatsapp_connections para Twilio

-- Adiciona campos Twilio
ALTER TABLE public.whatsapp_connections
  ADD COLUMN IF NOT EXISTS twilio_account_sid TEXT,
  ADD COLUMN IF NOT EXISTS twilio_auth_token TEXT,
  ADD COLUMN IF NOT EXISTS twilio_whatsapp_number TEXT,
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'twilio';

-- Remove constraint de NOT NULL em phone_number_id (era obrigatório na Meta, no Twilio o número vem do número Twilio)
ALTER TABLE public.whatsapp_connections
  ALTER COLUMN phone_number_id DROP NOT NULL;

-- Remove campos exclusivos da Meta que não fazem mais sentido
ALTER TABLE public.whatsapp_connections
  DROP COLUMN IF EXISTS access_token,
  DROP COLUMN IF EXISTS business_account_id,
  DROP COLUMN IF EXISTS webhook_verify_token;

-- Atualiza tabela connections (legada) para remover campos Meta
ALTER TABLE public.connections
  DROP COLUMN IF EXISTS whatsapp_access_token,
  DROP COLUMN IF EXISTS whatsapp_business_account_id,
  DROP COLUMN IF EXISTS whatsapp_webhook_verify_token;

-- Adiciona campos Twilio na tabela legada (compatibilidade)
ALTER TABLE public.connections
  ADD COLUMN IF NOT EXISTS twilio_account_sid TEXT,
  ADD COLUMN IF NOT EXISTS twilio_auth_token TEXT,
  ADD COLUMN IF NOT EXISTS twilio_whatsapp_number TEXT;

COMMENT ON COLUMN public.whatsapp_connections.provider IS 'Provedor WhatsApp: twilio';
COMMENT ON COLUMN public.whatsapp_connections.twilio_account_sid IS 'Twilio Account SID (ACxxxxxx)';
COMMENT ON COLUMN public.whatsapp_connections.twilio_whatsapp_number IS 'Número Twilio no formato whatsapp:+14155238886';
