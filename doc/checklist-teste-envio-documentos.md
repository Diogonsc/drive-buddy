# Checklist: Teste de envio de documentos (WhatsApp → Google Drive)

Use este checklist para garantir que o fluxo completo funcione antes de testar com usuários reais.

---

## 1. Webhook no Meta (receber mensagens)

- [ ] **WhatsApp** → **Configuração** (menu lateral) → **Webhook** → **Editar**
- [ ] **URL de retorno de chamada**:  
  `https://unzeknvrevrsixvmnqca.supabase.co/functions/v1/whatsapp-webhook`
- [ ] **Token de verificação**: `swiftwapdrivetoken@2026` (igual ao salvo no app)
- [ ] Clicar em **Verificar e salvar**
- [ ] Em **Gerenciar**, marcar o campo **`messages`** (obrigatório para receber mídia)

Se a verificação falhar (403), confira se o Verify Token no Meta é exatamente o mesmo que está em Configurações → WhatsApp no seu app.

---

## 2. Secrets no Supabase (Edge Functions)

No **Supabase Dashboard** → **Project Settings** → **Edge Functions** → **Secrets**, confira:

| Secret | Obrigatório | Onde pegar |
|--------|-------------|------------|
| `WHATSAPP_APP_SECRET` | Sim (webhook POST) | Meta: Seu App → Configurações do app → Básico → **Chave secreta do app** |
| `GOOGLE_CLIENT_ID` | Sim (process-media) | Google Cloud Console → Credentials → OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | Sim (process-media) | Google Cloud Console → Credentials → OAuth 2.0 Client Secret |

Sem `WHATSAPP_APP_SECRET`, o webhook rejeita os POSTs do Meta (503).  
Sem `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`, o `process-media` não consegue renovar o token nem enviar arquivos para o Drive.

---

## 3. Google Drive conectado no app

- [ ] No seu app: **Configurações** → aba **Google Drive**
- [ ] Preencher **Client ID** e **Client Secret** (mesmos do Google Cloud)
- [ ] Clicar em **Autorizar Google Drive** e concluir o OAuth
- [ ] O status do Google deve aparecer como **Conectado**

O fluxo de mídia só envia arquivos para o Drive se a connection tiver `google_access_token` e `google_refresh_token`.

---

## 4. Número que pode enviar mensagens (modo teste)

No **modo de teste** do Meta, só números autorizados podem enviar mensagens para o número do negócio:

- [ ] Meta: **WhatsApp** → **Configuração da API** → **Etapa 1: Selecione números de telefone**
- [ ] Adicionar o número do seu celular (ou do usuário de teste) como número que pode enviar mensagens ao número de teste

Sem isso, mensagens enviadas para o número de negócio podem não gerar webhook.

---

## 5. Teste ponta a ponta

1. **Enviar mídia**  
   Do seu WhatsApp (número autorizado), envie uma **foto**, **vídeo**, **áudio** ou **documento** para o número do negócio (ex.: +1 555 158 0257).

2. **Conferir no app**  
   - Dashboard: em **Última mídia recebida** ou **Atividade recente** deve aparecer o registro.  
   - Ou no Supabase: tabela `media_files` deve ganhar uma nova linha com `status` indo de `pending` → `processing` → `completed`.

3. **Conferir no Google Drive**  
   O arquivo deve aparecer na pasta configurada (ex.: raiz ou “WhatsApp Uploads”).

4. **Se falhar**  
   - Ver logs da Edge Function `whatsapp-webhook` e `process-media` no Supabase (Logs).  
   - Conferir `media_files.error_message` e `media_files.status` para ver em que etapa parou.

---

## Resumo do fluxo

```
Usuário envia mídia no WhatsApp
        ↓
Meta envia POST para whatsapp-webhook (com x-hub-signature-256)
        ↓
whatsapp-webhook valida assinatura (WHATSAPP_APP_SECRET), insere em media_files, chama process-media
        ↓
process-media baixa o arquivo da API do WhatsApp, envia para o Google Drive (usa GOOGLE_* para refresh)
        ↓
media_files.status = completed; arquivo visível no Drive
```

Quando todos os itens acima estiverem marcados e um envio de mídia completar com sucesso, a aplicação está pronta para testes com usuários reais.

---

## Troubleshooting: arquivo preso em `processing`

Se o **Reprocessar** retornar *"Arquivo já está em processamento"* e o status nunca virar `completed` nem `failed`, o registro pode estar travado em `processing` (ex.: `process-media` caiu ou deu timeout).

- **Automático:** Se o arquivo está em `processing` há **mais de 5 minutos** (`last_attempt_at`), o **Reprocessar** passa a considerar "travado" e libera o reprocessamento (reset para `pending` e nova chamada ao `process-media`). Basta clicar em **Reprocessar** de novo após 5 minutos.
- **Manual (agora):** No Supabase → SQL Editor, execute (troque o ID pelo do arquivo):

```sql
UPDATE media_files
SET
  status = 'failed',
  error_message = 'Reset manual após travamento',
  last_attempt_at = now()
WHERE id = 'SEU_MEDIA_FILE_ID';
```

Depois disso, use **Reprocessar** no app normalmente.
