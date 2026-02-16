# Meta WhatsApp Embedded Signup — Requisitos Técnicos (Fase 2)

## O que é

Embedded Signup é uma interface de autenticação/autorização (desktop e mobile) do Meta que permite onboarding de clientes na WhatsApp Business Platform via popup — sem configuração manual de webhooks ou IDs.

## Pré-requisitos

### 1. Conta Meta / Facebook Business
- **Meta Business Portfolio** (antigo Business Manager)
- **App do tipo Business** criado no Meta for Developers
- Aceitar os Termos de Serviço do Cloud API e WhatsApp Business

### 2. Tipo de Parceiro
O Swiftwapdrive se enquadra como **Tech Provider**:
- Não precisa de linha de crédito (diferente de Solution Partner)
- Clientes devem adicionar método de pagamento na WABA deles
- Limite inicial: **10 clientes novos em 7 dias**
- Após Business Verification + App Review + Access Verification: **200/semana**

### 3. Permissões Necessárias
```
whatsapp_business_management   → Acesso a configurações da WABA e templates
whatsapp_business_messaging    → Envio/recebimento de mensagens
```

### 4. App Review (Obrigatório para Live Mode)
- Submeter app para revisão no Meta com demonstração de uso
- Permissões precisam de **Advanced Access** aprovado
- Em dev mode, apenas admins/devs/testers veem as permissões

### 5. Business Verification
- Verificar empresa no Meta Business Suite
- Documentos: CNPJ, site, nome legal da empresa

## Fluxo Técnico

### Frontend (JavaScript SDK)
```javascript
// 1. Carregar Facebook SDK
window.fbAsyncInit = function() {
  FB.init({
    appId: '{APP_ID}',
    autoLogAppEvents: true,
    xfbml: true,
    version: 'v22.0'
  });
};

// 2. Iniciar Embedded Signup
FB.login(function(response) {
  if (response.authResponse) {
    const code = response.authResponse.code;
    // Enviar code para o backend
  }
}, {
  config_id: '{CONFIG_ID}',  // Criado no App Dashboard
  response_type: 'code',
  override_default_response_type: true,
  extras: {
    setup: {},
    featureType: '',
    sessionInfoVersion: '3'
  }
});
```

### Backend (Edge Function)
```
1. Trocar code por Business Token (server-to-server)
   POST https://graph.facebook.com/v22.0/oauth/access_token
   
2. Registrar número do cliente para Cloud API
   POST /{phone_number_id}/register

3. Inscrever app nos webhooks da WABA do cliente
   POST /{waba_id}/subscribed_apps

4. (Solution Partner only) Compartilhar linha de crédito
```

### Dados retornados pelo Embedded Signup
- `waba_id` — WhatsApp Business Account ID
- `phone_number_id` — ID do número do cliente
- `code` — Token trocável por Business Token

## Limitações

- Máximo 10 clientes/semana (sem verificação) ou 200 (com verificação)
- Números já usados no WhatsApp pessoal ou On-Premises API não são suportados
- Números do WhatsApp Business App requerem fluxo de "Coexistence"
- WABAs criadas diretamente no developer app não podem ser selecionadas no ES

## Custos

- **Sem custo** para usar o Embedded Signup em si
- Clientes pagam por mensagens conforme pricing do WhatsApp Business Platform
- Tech Providers: clientes adicionam método de pagamento diretamente

## Sandbox para Testes

- Conta sandbox disponível em App Dashboard > WhatsApp > Quickstart
- Válida por 30 dias
- Não pode enviar/receber mensagens reais
- Retorna dados simulados (WABA ID, phone number ID, code)

## Implementação no Swiftwapdrive (Roadmap)

### Fase 2A — Preparação
- [ ] Criar app tipo Business no Meta for Developers
- [ ] Solicitar permissões `whatsapp_business_management` e `whatsapp_business_messaging`
- [ ] Completar Business Verification
- [ ] Submeter para App Review

### Fase 2B — Implementação
- [ ] Integrar Facebook JS SDK no frontend
- [ ] Criar edge function para troca de tokens (code → business token)
- [ ] Criar edge function para registro de número e inscrição em webhooks
- [ ] Adaptar webhook existente para multi-tenant (múltiplos clientes)
- [ ] Substituir formulário manual de credenciais pelo botão "Conectar com WhatsApp"

### Fase 2C — Multi-tenant
- [ ] Adaptar tabela `connections` para armazenar WABA ID e business token por usuário
- [ ] Adaptar `whatsapp-webhook` para rotear mensagens por phone_number_id
- [ ] Override de callback URL por WABA para isolamento

## Referências

- [Embedded Signup Overview](https://developers.facebook.com/docs/whatsapp/embedded-signup/)
- [Implementation Guide](https://developers.facebook.com/docs/whatsapp/embedded-signup/implementation/)
- [App Review](https://developers.facebook.com/docs/whatsapp/embedded-signup/app-review/)
- [Sandbox Testing](https://developers.facebook.com/docs/whatsapp/embedded-signup/)
