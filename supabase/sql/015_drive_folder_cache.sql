-- Cache de pastas do Google Drive
-- Evita criação de pastas duplicadas em processamento paralelo

CREATE TABLE IF NOT EXISTS public.drive_folder_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_account_id UUID REFERENCES public.google_drive_accounts(id) ON DELETE CASCADE,
  folder_path TEXT NOT NULL,
  folder_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, google_account_id, folder_path)
);

-- Índice para busca rápida por caminho
CREATE INDEX IF NOT EXISTS idx_drive_folder_cache_lookup
  ON public.drive_folder_cache (user_id, google_account_id, folder_path);

-- RLS
ALTER TABLE public.drive_folder_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own folder cache"
  ON public.drive_folder_cache
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role bypasses RLS (para Edge Functions)
CREATE POLICY "Service role full access folder cache"
  ON public.drive_folder_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.drive_folder_cache IS
  'Cache de IDs de pastas do Google Drive para evitar duplicação em processamento paralelo';
