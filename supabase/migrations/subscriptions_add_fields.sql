-- Migration: adicionar campos de controle financeiro em subscriptions
-- Executar manualmente no Supabase SQL Editor

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS manually_disabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS disabled_reason text;
