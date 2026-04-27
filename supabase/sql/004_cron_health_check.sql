-- =====================================================
-- pg_cron: Health Check automático a cada 15 minutos
-- =====================================================
-- IMPORTANTE: Execute este SQL diretamente no console do Supabase (SQL Editor)
-- NÃO é uma migration — contém dados específicos do projeto.
-- Pré-requisitos: extensões pg_cron e pg_net habilitadas.

-- 1. Habilitar extensões (se ainda não estiverem ativas)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Agendar health-check a cada 15 minutos
SELECT cron.schedule(
  'health-check-every-15min',
  '*/15 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://lzjovvbgrqezlbyoybuk.supabase.co/functions/v1/health-check',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6am92dmJncnFlemxieW95YnVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMzkwMDcsImV4cCI6MjA5MjgxNTAwN30.GimDPiiGMy-YHeKAl8mUel7MT74WS_GaZsIAgzOVwgY"}'::jsonb,
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Para verificar jobs agendados:
-- SELECT * FROM cron.job;

-- Para remover o job (se necessário):
-- SELECT cron.unschedule('health-check-every-15min');
