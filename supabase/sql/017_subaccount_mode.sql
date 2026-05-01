-- Marca todas as conexões existentes como modo compartilhado (legado)
-- Novas conexões serão criadas no modo subaccount automaticamente

UPDATE public.whatsapp_connections
SET provider = 'twilio_shared'
WHERE provider = 'twilio'
  AND twilio_subaccount_sid IS NULL
  AND status IN ('connected', 'pending');

COMMENT ON COLUMN public.whatsapp_connections.provider IS
  'twilio_shared = número compartilhado (sandbox/legado) | twilio = subaccount dedicada';
