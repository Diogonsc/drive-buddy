-- DOCUMENTACAO: este arquivo nao e executado automaticamente; rode manualmente no Supabase SQL Editor.
CREATE OR REPLACE FUNCTION increment_files_used(p_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE subscriptions
  SET files_used_current_month = COALESCE(files_used_current_month, 0) + 1
  WHERE user_id = p_user_id;
$$;
