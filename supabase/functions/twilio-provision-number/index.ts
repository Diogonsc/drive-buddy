// supabase/functions/twilio-provision-number/index.ts
// Swiftwapdrive - Provisiona Subaccount Twilio + Número WhatsApp por cliente

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TWILIO_MAIN_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!
const TWILIO_MAIN_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// URL do webhook central que receberá todas as mensagens
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/whatsapp-webhook`

function twilioRequest(
  url: string,
  method: 'GET' | 'POST' | 'DELETE' = 'GET',
  body?: Record<string, string>,
  accountSid?: string,
  authToken?: string,
): Promise<Response> {
  const sid = accountSid || TWILIO_MAIN_ACCOUNT_SID
  const token = authToken || TWILIO_MAIN_AUTH_TOKEN
  const credentials = btoa(`${sid}:${token}`)

  return fetch(url, {
    method,
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body ? new URLSearchParams(body).toString() : undefined,
  })
}

// RESERVADO: usado no modelo subaccount (upgrade)
async function createSubaccount(friendlyName: string): Promise<{
  sid: string
  authToken: string
}> {
  const res = await twilioRequest(
    `https://api.twilio.com/2010-04-01/Accounts.json`,
    'POST',
    { FriendlyName: friendlyName },
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Falha ao criar subaccount: ${err.message || res.status}`)
  }

  const data = await res.json()
  return { sid: data.sid, authToken: data.auth_token }
}

// RESERVADO: usado no modelo subaccount (upgrade)
async function searchAvailableNumber(countryCode: string): Promise<string> {
  const res = await twilioRequest(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_MAIN_ACCOUNT_SID}/AvailablePhoneNumbers/${countryCode}/Mobile.json?SmsEnabled=true&MmsEnabled=true&Limit=1`,
  )

  if (!res.ok) {
    // Fallback para Local se Mobile não disponível
    const res2 = await twilioRequest(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_MAIN_ACCOUNT_SID}/AvailablePhoneNumbers/${countryCode}/Local.json?SmsEnabled=true&Limit=1`,
    )
    if (!res2.ok) throw new Error(`Nenhum número disponível em ${countryCode}`)
    const data2 = await res2.json()
    if (!data2.available_phone_numbers?.length) throw new Error(`Nenhum número disponível em ${countryCode}`)
    return data2.available_phone_numbers[0].phone_number
  }

  const data = await res.json()
  if (!data.available_phone_numbers?.length) throw new Error(`Nenhum número disponível em ${countryCode}`)
  return data.available_phone_numbers[0].phone_number
}

// RESERVADO: usado no modelo subaccount (upgrade)
async function purchaseNumber(
  phoneNumber: string,
  subaccountSid: string,
  subaccountAuthToken: string,
): Promise<{ sid: string; phoneNumber: string }> {
  const res = await twilioRequest(
    `https://api.twilio.com/2010-04-01/Accounts/${subaccountSid}/IncomingPhoneNumbers.json`,
    'POST',
    {
      PhoneNumber: phoneNumber,
      SmsUrl: WEBHOOK_URL,
      SmsMethod: 'POST',
    },
    subaccountSid,
    subaccountAuthToken,
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Falha ao comprar número: ${err.message || res.status}`)
  }

  const data = await res.json()
  return { sid: data.sid, phoneNumber: data.phone_number }
}

// RESERVADO: usado no modelo subaccount (upgrade)
async function registerWhatsAppSender(
  phoneNumber: string,
  subaccountSid: string,
  subaccountAuthToken: string,
): Promise<void> {
  // Registra o número no WhatsApp Business Platform via Twilio
  const res = await twilioRequest(
    `https://api.twilio.com/2010-04-01/Accounts/${subaccountSid}/Messages/WhatsApp/Senders.json`,
    'POST',
    { PhoneNumber: phoneNumber },
    subaccountSid,
    subaccountAuthToken,
  )

  // Alguns números já vêm habilitados — erro 409 é aceitável
  if (!res.ok && res.status !== 409) {
    console.warn(`WhatsApp sender registration não crítico: ${res.status}`)
  }
}

// RESERVADO: usado no modelo subaccount (upgrade)
async function configureWebhook(
  numberSid: string,
  subaccountSid: string,
  subaccountAuthToken: string,
): Promise<void> {
  const res = await twilioRequest(
    `https://api.twilio.com/2010-04-01/Accounts/${subaccountSid}/IncomingPhoneNumbers/${numberSid}.json`,
    'POST',
    {
      SmsUrl: WEBHOOK_URL,
      SmsMethod: 'POST',
      StatusCallback: WEBHOOK_URL,
      StatusCallbackMethod: 'POST',
    },
    subaccountSid,
    subaccountAuthToken,
  )

  if (!res.ok) {
    console.warn(`Webhook config falhou: ${res.status}`)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Autenticar o usuário
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    )

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Sessão inválida' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { customerPhone, countryCode = 'BR', label } = body as {
      customerPhone?: string
      countryCode?: string
      label?: string
    }

    if (!customerPhone) {
      return new Response(JSON.stringify({ error: 'customerPhone é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Normaliza o número do cliente
    const normalizedPhone = customerPhone.startsWith('+') ? customerPhone : `+${customerPhone}`

    // Verifica se já existe conexão ativa para este usuário
    const { data: existing } = await supabase
      .from('whatsapp_connections')
      .select('id, status, twilio_whatsapp_number')
      .eq('user_id', user.id)
      .in('status', ['connected', 'pending'])
      .maybeSingle()

    if (existing) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Conexão já existe',
        twilio_number: existing.twilio_whatsapp_number,
        status: existing.status,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const envTwilioWhatsappNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER')
    if (!envTwilioWhatsappNumber) {
      throw new Error('TWILIO_WHATSAPP_NUMBER não configurado')
    }

    const twilioWhatsappNumber = envTwilioWhatsappNumber.startsWith('whatsapp:')
      ? envTwilioWhatsappNumber
      : `whatsapp:${envTwilioWhatsappNumber}`
    const twilioNumber = twilioWhatsappNumber.replace(/^whatsapp:/, '')

    const { data: connection, error: upsertError } = await supabase
      .from('whatsapp_connections')
      .upsert({
        user_id: user.id,
        label: label || `WhatsApp ${normalizedPhone.slice(-4)}`,
        phone_number_id: normalizedPhone,
        customer_phone_number: normalizedPhone,
        provider: 'twilio',
        twilio_whatsapp_number: twilioWhatsappNumber,
        twilio_subaccount_sid: null,
        twilio_subaccount_auth_token: null,
        twilio_number_sid: null,
        status: 'connected',
        connected_at: new Date().toISOString(),
      }, { onConflict: 'user_id,phone_number_id' })
      .select()
      .single()

    if (upsertError || !connection) {
      console.error('[PROVISION] Upsert error:', JSON.stringify(upsertError))
      throw new Error(`Falha ao criar/atualizar conexão: ${upsertError?.message || 'erro desconhecido'}`)
    }

    console.log(`[PROVISION] Conectado em modo shared para user ${user.id}`)

    return new Response(JSON.stringify({
      success: true,
      twilio_number: twilioNumber,
      twilio_whatsapp_number: twilioWhatsappNumber,
      status: 'connected',
      mode: 'shared',
      message: 'WhatsApp conectado com sucesso!',
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[PROVISION] Erro:', err)
    return new Response(JSON.stringify({
      success: false,
      error: (err as Error).message || 'Erro interno ao provisionar número',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
