# SwiftwapdriveSync - Supabase Backend

## Instruções de Instalação

### 1. Criar Tabelas

Execute o arquivo `sql/001_create_tables.sql` no **SQL Editor** do Supabase.

Este script cria:
- Enums: `app_role`, `sync_status`, `media_type`, `connection_status`, `plan_type`
- Tabelas: `user_roles`, `connections`, `user_settings`, `subscriptions`, `media_files`, `sync_logs`
- Triggers para auto-criar configurações para novos usuários

### 2. Configurar RLS (Row Level Security)

Execute o arquivo `sql/002_rls_policies.sql` no **SQL Editor** do Supabase.
### 2.1 Migrações complementares (obrigatórias em produção)

Execute também, nesta ordem:

1. `sql/003_health_monitoring.sql`
2. `sql/005_email_notifications.sql`
3. `sql/006_align_user_settings.sql`
4. `sql/007_b2b_plan_enforcement_and_multi_integrations.sql`
5. `sql/008_admin_read_policies_for_b2b_management.sql`
6. `sql/009_whatsapp_phone_global_uniqueness.sql`

Essas migrações ativam:
- monitoramento de integrações;
- campos atuais do frontend em `user_settings`;
- limites por plano (`monthly_file_limit`, contas WhatsApp/Drive);
- suporte a múltiplos números WhatsApp e múltiplas contas Google Drive;
- roteamento WhatsApp -> Google Drive por regra.


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
supabase functions deploy whatsapp-test-connection
supabase functions deploy whatsapp-verify-status
supabase functions deploy reprocess-media
supabase functions deploy google-oauth
```

#### Opção B: Via Dashboard

1. Vá para **Edge Functions** no dashboard do Supabase
2. Clique em **New Function**
3. Copie o conteúdo de cada arquivo `index.ts` da pasta `functions/`
4. Configure as variáveis de ambiente (Secrets) necessárias

### 4. Configurar Variáveis de Ambiente (Secrets)

No dashboard do Supabase: **Project Settings > Edge Functions > Secrets**. Adicione:

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `SUPABASE_ANON_KEY` | Sim (reprocess-media, whatsapp-verify-status) | **Chave anon** do projeto: Project Settings → API → anon public. Usada para validar JWT do usuário (`getUser()`); **nunca** use SERVICE_ROLE_KEY para auth. |
| `WHATSAPP_APP_SECRET` | Sim (webhook POST) | **App Secret** do app no Meta: [developers.facebook.com](https://developers.facebook.com) → Seu App → Configurações do app → Básico → Chave secreta do app. Usado para validar a assinatura `x-hub-signature-256` nas requisições POST do webhook. Sem ela, o webhook retorna **503** (Server misconfiguration). |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Recomendado (webhook GET) | Token global para verificação do webhook (hub.verify_token). Em ambiente multi-tenant é a forma mais simples e segura de validação no callback único do projeto. |
| `GOOGLE_CLIENT_ID` | Sim (process-media) | Client ID do OAuth 2.0 no Google Cloud Console (renovação de token no process-media). |
| `GOOGLE_CLIENT_SECRET` | Sim (process-media) | Client Secret do OAuth 2.0 no Google Cloud Console. |

- **Verificação GET do webhook** não usa `WHATSAPP_APP_SECRET`; apenas o **Verify Token** (igual ao salvo em `connections.whatsapp_webhook_verify_token`).
- Em produção, **nunca** deixe `WHATSAPP_APP_SECRET` em branco, para evitar aceitar POSTs não assinados pelo Meta.

### 5. Configurar WhatsApp Cloud API (Meta)

1. **Criar app e adicionar número**  
   - Acesse [Meta for Developers](https://developers.facebook.com/) → **My Apps** → crie ou selecione um app.  
   - Menu **WhatsApp** → **API Setup**. Em **Step 5: Add a phone number**, adicione um número (ou use o número de teste).  
   - Anote o **Phone number ID** e gere um **Access Token** (temporário ou permanente) em **API Setup**.

2. **App Secret**  
   - **Configurações do app** → **Básico** → **Chave secreta do app**. Use esse valor em `WHATSAPP_APP_SECRET` nas Edge Functions.

3. **Webhook no Meta**  
   - No mesmo app: **WhatsApp** → **Configuration** → **Webhook** → **Edit**.  
   - **Callback URL**: `https://SEU_PROJECT_REF.supabase.co/functions/v1/whatsapp-webhook`  
   - **Verify Token**: Defina um valor secreto (ex: `meu_token_webhook_123`). O **mesmo** valor deve ser informado pelo usuário em **Configurações → WhatsApp → Verify Token** no app e salvo em `connections.whatsapp_webhook_verify_token`.  
   - Ao clicar em **Verify and save**, o Meta envia um GET ao webhook; a função valida o token e responde com `hub.challenge`.

4. **Campos do webhook**  
   - Assine pelo menos o campo **messages** (obrigatório para receber mídias e mensagens).

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
