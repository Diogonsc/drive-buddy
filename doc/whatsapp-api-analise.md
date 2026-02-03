# Análise: Integração com a API oficial do WhatsApp

## Resumo

O projeto já possui webhook (`whatsapp-webhook`), processamento de mídia (`process-media`) e configuração em Settings. Para a integração com a **API oficial do WhatsApp (Cloud API)** funcionar de ponta a ponta, foram identificadas lacunas em configuração, dados e código que precisam ser corrigidas.

---

## O que já está correto

1. **Webhook (GET)** – Verificação do Meta: validação de `hub.mode`, `hub.verify_token` e resposta com `hub.challenge`.
2. **Webhook (POST)** – Assinatura `x-hub-signature-256` com `WHATSAPP_APP_SECRET`, payload `whatsapp_business_account`, filtro por `phone_number_id`, idempotência por `whatsapp_message_id`.
3. **Download de mídia** – Uso de `GET https://graph.facebook.com/v18.0/{media-id}` e depois download pela URL retornada, com Bearer token.
4. **Schema** – Tabelas `connections` e `media_files` com campos WhatsApp (phone_number_id, access_token, webhook_verify_token, etc.).
5. **Fluxo** – Webhook recebe → insere `media_files` → invoca `process-media` de forma assíncrona.

---

## Lacunas e correções necessárias

### 1. Verify Token do webhook não é configurado nem salvo

- **Problema:** Na verificação (GET), o webhook busca uma `connection` com `whatsapp_webhook_verify_token = hub.verify_token`. No Settings há estado `webhookVerifyToken`, mas:
  - Não existe campo na UI para o usuário informar o token.
  - O valor não é persistido no `handleSaveWhatsApp` (não entra no upsert de `connections`).
- **Efeito:** Nenhum usuário tem verify token salvo → verificação do webhook no Meta falha (403).
- **Correção:** Incluir campo “Verify Token” na aba WhatsApp, explicar que deve ser o mesmo valor configurado no Meta, e no `handleSaveWhatsApp` salvar `whatsapp_webhook_verify_token` em `connections`.

---

### 2. Variável de ambiente WHATSAPP_APP_SECRET

- **Problema:** A validação da assinatura do POST usa `Deno.env.get('WHATSAPP_APP_SECRET')`. Se não estiver definida no Supabase (Edge Functions), a função lança e o webhook quebra.
- **Correção:** Definir no Supabase (Dashboard → Project Settings → Edge Functions → Secrets) a variável `WHATSAPP_APP_SECRET` com o **App Secret** do app do Meta (Configurações do app → Básico).
- **Documentação:** Deixar explícito no README ou em `doc/` que esse secret é obrigatório para o webhook POST.

---

### 3. process-media: relação com `connections` inexistente

- **Problema:** O código faz:
  - `media_files` com `.select('*, connections:user_id(...)')` e depois `connection = mediaFile.connections`.
  - No PostgREST/Supabase a embed é por **foreign key**. `media_files` só tem `user_id → auth.users`; não há FK de `media_files` para `connections`. Assim, `connections:user_id` não é uma relação válida nesse contexto e `mediaFile.connections` pode vir vazio/undefined.
- **Efeito:** `connection` undefined → erro ao acessar `connection.whatsapp_access_token` (e demais campos).
- **Correção:** Buscar a connection em uma query separada: `from('connections').select('...').eq('user_id', mediaFile.user_id).single()` e usar esse resultado.

---

### 4. process-media: tabela `user_plans` não existe

- **Problema:** O código consulta `user_plans` (monthly_file_limit, files_used). No schema existe apenas `subscriptions`, com `monthly_file_limit` e `files_used_current_month`.
- **Efeito:** Query falha (tabela inexistente) e o processamento quebra antes de baixar mídia.
- **Correção:** Trocar para a tabela `subscriptions` e usar a coluna `files_used_current_month`. Ao incrementar uso, atualizar `subscriptions.files_used_current_month` (e, se houver lógica de ciclo mensal, considerar `current_period_end`).

---

### 5. process-media: status `permanent_failed` fora do enum

- **Problema:** O enum `sync_status` em `001_create_tables.sql` é `pending | processing | completed | failed`. O código usa `permanent_failed` em `registerFailure` e `markPermanentFailure`.
- **Efeito:** Updates em `media_files` com `status: 'permanent_failed'` falham (valor não permitido pelo enum).
- **Correção:** Usar `status: 'failed'` para falhas (permanentes ou não). A distinção pode ser feita por `retry_count >= MAX_RETRIES` e `error_message` na aplicação/UI. Alternativa: criar migração adicionando `permanent_failed` ao enum, se quiser diferenciar no banco.

---

### 6. Teste de conexão WhatsApp é apenas simulado

- **Problema:** `handleTestWhatsApp` só verifica se há phoneNumberId e accessToken preenchidos e mostra um toast; não chama a API do WhatsApp.
- **Sugestão (opcional):** Chamar algo leve da API (ex.: `GET /v18.0/{phone_number_id}` com o token) e exibir sucesso/erro de acordo com a resposta, para validar credenciais de fato.

---

### 7. Documentação do webhook no Meta

- **Callback URL:** Já exibida na tela: `{VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`.
- **Verify token:** Deve ser o mesmo que o usuário configurar no Settings e salvar em `whatsapp_webhook_verify_token`.
- **Campos a assinar:** Na documentação do Meta, para receber mensagens (e mídia) o campo necessário é **`messages`**. O código atual só processa `change.field === 'messages'`, então está alinhado. O texto na UI que cita `message_template_status_update` é opcional (templates); o essencial é `messages`.

---

### 8. Resposta rápida ao webhook (POST)

- **Situação:** O webhook invoca `process-media` com `invoke(...)` e não faz await do resultado, e depois retorna 200. O Meta recebe resposta rápida, o que é o recomendado.
- **Conclusão:** Nenhuma alteração necessária.

---

## Checklist pós-correção (implementado)

- [x] Definir `WHATSAPP_APP_SECRET` nas Edge Functions do Supabase.
- [x] Incluir campo “Verify Token” na aba WhatsApp (Settings), salvar em `whatsapp_webhook_verify_token`.
- [x] No Meta: Configurar webhook com a Callback URL do Supabase e o mesmo Verify Token definido no app.
- [x] Corrigir `process-media`: buscar connection por `user_id`; usar `subscriptions` e `files_used_current_month`; usar status `failed` e `is_permanent_failure`.
- [x] Teste de conexão real: Edge Function `whatsapp-test-connection` + botão "Testar Conexão" em Settings.
- [x] Documentar no README do Supabase: App Secret, Verify Token, variáveis e passos no Meta.

Depois dessas alterações, o fluxo “mensagem com mídia no WhatsApp → webhook → media_files → process-media → download → Drive” deve funcionar de forma consistente com a API oficial do WhatsApp.
