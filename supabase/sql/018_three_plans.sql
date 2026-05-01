-- =====================================================
-- Swiftwapdrive — 3 Planos: Starter, Profissional, Scale
-- =====================================================

-- Adiciona novos valores ao enum plan_type se não existirem
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'starter'
    AND enumtypid = 'plan_type'::regtype
  ) THEN
    ALTER TYPE plan_type ADD VALUE 'starter';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'professional'
    AND enumtypid = 'plan_type'::regtype
  ) THEN
    ALTER TYPE plan_type ADD VALUE 'professional';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'scale'
    AND enumtypid = 'plan_type'::regtype
  ) THEN
    ALTER TYPE plan_type ADD VALUE 'scale';
  END IF;
END$$;

-- Adiciona campos necessários à tabela subscriptions
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan_name TEXT,
  ADD COLUMN IF NOT EXISTS plan_price INTEGER,
  ADD COLUMN IF NOT EXISTS overage_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS whatsapp_numbers_limit INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS google_accounts_limit INTEGER NOT NULL DEFAULT 1;

-- Atualiza registros existentes para Profissional (plano atual)
UPDATE public.subscriptions
SET
  plan = 'professional',
  plan_name = 'Profissional',
  plan_price = 9700,
  monthly_file_limit = 200,
  overage_enabled = TRUE,
  whatsapp_numbers_limit = 1,
  google_accounts_limit = 1
WHERE monthly_file_limit = 200
   OR plan IN ('starter', 'free', 'pro', 'business');

-- Tabela de definição dos planos (referência)
CREATE TABLE IF NOT EXISTS public.plan_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  monthly_file_limit INTEGER NOT NULL,
  overage_price_cents INTEGER NOT NULL DEFAULT 25,
  whatsapp_numbers_limit INTEGER NOT NULL DEFAULT 1,
  google_accounts_limit INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insere os 3 planos
INSERT INTO public.plan_definitions
  (id, name, price_cents, monthly_file_limit, overage_price_cents)
VALUES
  ('starter',      'Starter',      5900,  80,  25),
  ('professional', 'Profissional', 9700,  200, 25),
  ('scale',        'Scale',        24700, 600, 25)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price_cents = EXCLUDED.price_cents,
  monthly_file_limit = EXCLUDED.monthly_file_limit,
  overage_price_cents = EXCLUDED.overage_price_cents;

-- RLS na tabela plan_definitions (leitura pública)
ALTER TABLE public.plan_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Plan definitions are publicly readable"
  ON public.plan_definitions FOR SELECT
  USING (true);

COMMENT ON TABLE public.plan_definitions IS
  'Definição dos planos: starter (R$59/80), profissional (R$97/200), scale (R$247/600)';
COMMENT ON COLUMN public.subscriptions.plan_name IS
  'Nome legível do plano: Starter, Profissional, Scale';
COMMENT ON COLUMN public.subscriptions.plan_price IS
  'Preço em centavos: 5900, 9700, 24700';
