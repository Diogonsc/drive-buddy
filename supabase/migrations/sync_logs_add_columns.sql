-- DOCUMENTACAO: este arquivo nao e executado automaticamente; rode manualmente no Supabase SQL Editor.
-- Verificar colunas atuais:
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'sync_logs' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Se message, metadata, source nao existirem, rodar:
ALTER TABLE sync_logs
  ADD COLUMN IF NOT EXISTS message text,
  ADD COLUMN IF NOT EXISTS metadata jsonb,
  ADD COLUMN IF NOT EXISTS source text;
