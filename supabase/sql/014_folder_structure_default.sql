-- Atualiza o padrão de estrutura de pastas para sender_date_type
-- Aplica apenas para usuários que ainda usam o padrão antigo (date_type)
-- ou que não têm folder_structure definido

UPDATE public.user_settings
SET folder_structure = 'sender_date_type'
WHERE folder_structure = 'date_type'
   OR folder_structure IS NULL;

-- Garante que novos usuários já entrem com o novo padrão
ALTER TABLE public.user_settings
  ALTER COLUMN folder_structure SET DEFAULT 'sender_date_type';

COMMENT ON COLUMN public.user_settings.folder_structure IS
  'Estrutura de pastas: sender_date_type (padrão), date_type, type_date, type, date';
