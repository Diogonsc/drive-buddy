# SwiftwapdriveSync - Supabase Backend

## Instruções de Instalação

### 1. Criar Tabelas

Execute o arquivo `migrations/001_create_tables.sql` no **SQL Editor** do Supabase.

Este script cria:
- Enums: `app_role`, `sync_status`, `media_type`, `connection_status`
- Tabelas: `user_roles`, `connections`, `user_settings`, `media_files`, `sync_logs`
- Triggers para auto-criar configurações para novos usuários

### 2. Configurar RLS (Row Level Security)

Execute o arquivo `migrations/002_rls_policies.sql` no **SQL Editor** do Supabase.

Este script configura:
- Função `has_role()` para verificação de permissões
- Políticas RLS para todas as tabelas
- Acesso especial para webhooks (anon)

### 3. Deploy das Edge Functions

#### Opção A: Via Supabase CLI

```bash
# Instalar CLI
npm install -g supabase

# Login
supabase login

# Linkar projeto
supabase link --project-ref SEU_PROJECT_REF

# Deploy das funções
supabase functions deploy whatsapp-webhook
supabase functions deploy process-media
supabase functions deploy google-oauth
```

#### Opção B: Via Dashboard

1. Vá para **Edge Functions** no dashboard do Supabase
2. Clique em **New Function**
3. Copie o conteúdo de cada arquivo `.ts` da pasta `functions/`
4. Configure as variáveis de ambiente necessárias

### 4. Configurar Variáveis de Ambiente

No dashboard do Supabase, vá para **Settings > Edge Functions > Secrets** e adicione:

```
# Já configuradas automaticamente pelo Supabase:
# SUPABASE_URL
# SUPABASE_SERVICE_ROLE_KEY
# SUPABASE_ANON_KEY

# WhatsApp (obrigatório para o webhook POST):
WHATSAPP_APP_SECRET=<App Secret do seu app no Meta (Configurações do app → Básico)>
```

Sem `WHATSAPP_APP_SECRET`, o webhook rejeita todas as requisições POST do Meta (erro 403).

### 5. Configurar Webhook no Meta Business

1. Acesse [Meta for Developers](https://developers.facebook.com/)
2. Vá para seu App > WhatsApp > Configuration
3. Configure o Webhook:
   - **Callback URL**: `https://SEU_PROJECT.supabase.co/functions/v1/whatsapp-webhook`
   - **Verify Token**: O mesmo valor que o usuário define em Configurações → WhatsApp → Verify Token (e salvo em `connections.whatsapp_webhook_verify_token`)
4. Assine o campo **messages** (obrigatório para receber mídias)

### 6. Configurar Google Cloud Console

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um projeto ou selecione existente
3. Ative a **Google Drive API**
4. Vá para **Credentials** > **Create Credentials** > **OAuth 2.0 Client ID**
5. Configure:
   - **Application type**: Web application
   - **Authorized redirect URIs**: `https://seu-app.com/auth/google/callback`
6. Copie o **Client ID** e **Client Secret**

---

## Estrutura do Banco de Dados

### Tabela: `connections`
Armazena credenciais das integrações WhatsApp e Google Drive.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| whatsapp_phone_number_id | TEXT | ID do número no Meta |
| whatsapp_access_token | TEXT | Token de acesso (criptografar em produção) |
| google_access_token | TEXT | Token OAuth atual |
| google_refresh_token | TEXT | Token para renovação |

### Tabela: `media_files`
Registra cada arquivo de mídia processado.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| whatsapp_media_id | TEXT | ID da mídia no WhatsApp |
| file_type | ENUM | image, video, audio, document |
| status | ENUM | pending, processing, completed, failed |
| google_drive_file_id | TEXT | ID do arquivo no Drive |

### Tabela: `sync_logs`
Log de auditoria para todas as operações.

---

## Fluxo de Processamento

```
1. WhatsApp envia webhook
       ↓
2. whatsapp-webhook recebe e valida
       ↓
3. Insere registro em media_files (status: pending)
       ↓
4. Chama process-media
       ↓
5. process-media baixa arquivo do WhatsApp
       ↓
6. Upload para Google Drive
       ↓
7. Atualiza media_files (status: completed)
```

---

## Troubleshooting

### Webhook não está sendo validado
- Verifique se o `whatsapp_webhook_verify_token` está correto na tabela `connections`
- Confirme que a URL do webhook está correta no Meta Business

### Upload para Google Drive falha
- Verifique se o token não expirou (chamar `google-oauth` com action `refresh`)
- Confirme que a API do Drive está ativada no Google Cloud

### Erro de permissão RLS
- Verifique se o usuário está autenticado
- Confirme que as políticas RLS estão aplicadas corretamente
