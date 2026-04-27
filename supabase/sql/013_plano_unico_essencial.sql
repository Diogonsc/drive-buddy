-- =====================================================
-- Swiftwapdrive - Migração para Plano Único Essencial
-- R$ 97/mês | 200 mídias inclusas | R$0,10 excedente
-- =====================================================

-- Atualiza todos os registros existentes para o plano essencial
UPDATE public.subscriptions
SET
  plan = 'starter',
  monthly_file_limit = 200,
  whatsapp_numbers_limit = 1,
  google_accounts_limit = 1,
  overage_enabled = TRUE,
  features = jsonb_build_object(
    'automatic_organization', true,
    'organize_by_sender', true,
    'organize_by_date', true,
    'all_media_types', true,
    'google_drive', true,
    'whatsapp_integration', true
  )
WHERE plan IN ('free', 'starter', 'pro', 'business');

-- Garante que novos usuários criados pelo trigger já entrem com o plano correto
-- (o trigger de criação de subscription deve usar estes valores como padrão)
ALTER TABLE public.subscriptions
  ALTER COLUMN monthly_file_limit SET DEFAULT 200;

ALTER TABLE public.subscriptions
  ALTER COLUMN overage_enabled SET DEFAULT TRUE;

COMMENT ON TABLE public.subscriptions IS 
  'Plano Essencial: R$97/mês | 200 mídias/mês | R$0,10 por mídia excedente';
