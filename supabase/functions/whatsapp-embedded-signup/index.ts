// =====================================================
// SwiftwapdriveSync - WhatsApp Embedded Signup
// Handles: code→token exchange, webhook registration, phone registration
// =====================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const GRAPH_API_VERSION = 'v22.0'
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`

// =====================================================
// ERROR MESSAGES (user-friendly, pt-BR)
// =====================================================

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_CODE: 'Código de autorização inválido ou expirado. Tente conectar novamente.',
  ACCOUNT_NOT_VERIFIED: 'Sua conta Meta precisa ser verificada antes de conectar o WhatsApp.',
  NUMBER_ALREADY_REGISTERED: 'Este número já está registrado no WhatsApp Business por outra conta.',
  INSUFFICIENT_PERMISSIONS: 'Permissões insuficientes. Certifique-se de autorizar todas as permissões solicitadas.',
  TOKEN_EXCHANGE_FAILED: 'Erro ao processar a autorização. Tente novamente em alguns instantes.',
  WEBHOOK_REGISTRATION_FAILED: 'Erro ao configurar o webhook automaticamente. A equipe foi notificada.',
  PHONE_REGISTRATION_FAILED: 'Erro ao registrar o número para a API Cloud. Tente novamente.',
  GENERIC_ERROR: 'Ocorreu um erro inesperado. Tente novamente mais tarde.',
  MISSING_CONFIG: 'Configuração do servidor incompleta. Entre em contato com o suporte.',
  ALREADY_CONNECTED: 'Você já possui uma conexão WhatsApp ativa.',
}

function friendlyError(code: string, details?: string): string {
  console.error(`[embedded-signup] Error ${code}:`, details)
  return ERROR_MESSAGES[code] || ERROR_MESSAGES.GENERIC_ERROR
}

async function getSubscriptionLimits(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
) {
  const { data } = await adminClient
    .from('subscriptions')
    .select('whatsapp_numbers_limit')
    .eq('user_id', userId)
    .maybeSingle()

  return {
    whatsappNumbersLimit: Math.max(1, Number(data?.whatsapp_numbers_limit || 1)),
  }
}

// =====================================================
// MAIN HANDLER
// =====================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // ---- Auth check ----
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const authHeader = req.headers.get('authorization')
  if (!authHeader) {
    return jsonError('Não autorizado', 401)
  }

  // Validate user JWT
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { authorization: authHeader } },
  })
  const { data: { user }, error: userError } = await userClient.auth.getUser()
  if (userError || !user) {
    return jsonError('Sessão inválida', 401)
  }

  // Admin client for DB operations
  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  // ---- Get config ----
  const META_APP_ID = Deno.env.get('META_APP_ID')
  const META_APP_SECRET = Deno.env.get('META_APP_SECRET')

  if (!META_APP_ID || !META_APP_SECRET) {
    return jsonError(friendlyError('MISSING_CONFIG', 'META_APP_ID or META_APP_SECRET not set'), 503)
  }

  try {
    const body = await req.json()
    const { action } = body

    // =====================================================
    // ACTION: exchange_code
    // =====================================================
    if (action === 'exchange_code') {
      const { code, waba_id, phone_number_id } = body

      if (!code) {
        return jsonError(friendlyError('INVALID_CODE'), 400)
      }

      // Log: signup started
      await logEvent(adminClient, user.id, 'embedded_signup_started', 'processing', 'Iniciando troca de código por token')

      // 1. Exchange code for access token
      let accessToken: string
      try {
        const tokenUrl = `${GRAPH_BASE}/oauth/access_token?` + new URLSearchParams({
          client_id: META_APP_ID,
          client_secret: META_APP_SECRET,
          code: code,
        })

        const tokenRes = await fetch(tokenUrl)
        const tokenData = await tokenRes.json()

        if (!tokenRes.ok || tokenData.error) {
          const errorMsg = tokenData.error?.message || 'Token exchange failed'
          
          // Detect specific error types
          if (errorMsg.includes('expired') || errorMsg.includes('invalid')) {
            return jsonError(friendlyError('INVALID_CODE', errorMsg), 400)
          }
          if (errorMsg.includes('verified')) {
            return jsonError(friendlyError('ACCOUNT_NOT_VERIFIED', errorMsg), 403)
          }
          if (errorMsg.includes('permission')) {
            return jsonError(friendlyError('INSUFFICIENT_PERMISSIONS', errorMsg), 403)
          }

          return jsonError(friendlyError('TOKEN_EXCHANGE_FAILED', errorMsg), 400)
        }

        accessToken = tokenData.access_token
      } catch (err) {
        return jsonError(friendlyError('TOKEN_EXCHANGE_FAILED', String(err)), 500)
      }

      // 2. If waba_id and phone_number_id came from the frontend (session info), use them
      //    Otherwise, fetch them from the Graph API
      let finalWabaId = waba_id
      let finalPhoneNumberId = phone_number_id

      if (!finalWabaId) {
        try {
          // Get WABA ID from shared WABAs
          const wabaRes = await fetch(
            `${GRAPH_BASE}/debug_token?input_token=${accessToken}`,
            { headers: { Authorization: `Bearer ${META_APP_ID}|${META_APP_SECRET}` } }
          )
          const wabaData = await wabaRes.json()
          
          // Try to extract from granular scopes
          const scopes = wabaData?.data?.granular_scopes || []
          const wabaScope = scopes.find((s: any) => 
            s.permission === 'whatsapp_business_management'
          )
          if (wabaScope?.target_ids?.length > 0) {
            finalWabaId = wabaScope.target_ids[0]
          }
        } catch (err) {
          console.error('[embedded-signup] Error fetching WABA ID:', err)
        }
      }

      if (!finalPhoneNumberId && finalWabaId) {
        try {
          // Get phone numbers from WABA
          const phonesRes = await fetch(
            `${GRAPH_BASE}/${finalWabaId}/phone_numbers`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          )
          const phonesData = await phonesRes.json()
          
          if (phonesData?.data?.length > 0) {
            finalPhoneNumberId = phonesData.data[0].id
          }
        } catch (err) {
          console.error('[embedded-signup] Error fetching phone numbers:', err)
        }
      }

      if (!finalPhoneNumberId) {
        return jsonError(
          "Não foi possível identificar o Phone Number ID da conta WhatsApp. Conclua a configuração no Meta e tente novamente.",
          400,
        )
      }

      // 3. Validate plan limits and save to multi-connection table
      const limits = await getSubscriptionLimits(adminClient, user.id)

      const { count: activeConnectionsCount } = await adminClient
        .from('whatsapp_connections')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('status', ['connected', 'pending'])

      const { data: existingByPhone } = finalPhoneNumberId
        ? await adminClient
            .from('whatsapp_connections')
            .select('id')
            .eq('user_id', user.id)
            .eq('phone_number_id', finalPhoneNumberId)
            .maybeSingle()
        : { data: null }

      const isNewPhone = !existingByPhone && Boolean(finalPhoneNumberId)
      if (isNewPhone && (activeConnectionsCount || 0) >= limits.whatsappNumbersLimit) {
        return jsonError(
          `Limite do plano atingido: seu plano permite até ${limits.whatsappNumbersLimit} número(s) WhatsApp.`,
          403,
        )
      }

      const webhookVerifyToken =
        Deno.env.get('WHATSAPP_WEBHOOK_VERIFY_TOKEN') || crypto.randomUUID().replace(/-/g, '')

      const { error: upsertError } = await adminClient
        .from('whatsapp_connections')
        .upsert({
          user_id: user.id,
          label: finalPhoneNumberId ? `WhatsApp ${finalPhoneNumberId.slice(-4)}` : 'WhatsApp',
          access_token: accessToken,
          business_account_id: finalWabaId || null,
          phone_number_id: finalPhoneNumberId,
          webhook_verify_token: webhookVerifyToken,
          status: 'pending',
          connected_at: new Date().toISOString(),
        }, { onConflict: 'user_id,phone_number_id' })

      if (upsertError) {
        console.error('[embedded-signup] DB upsert error:', upsertError)
        return jsonError(friendlyError('GENERIC_ERROR', upsertError.message), 500)
      }

      // Legacy compatibility (current frontend reads this table)
      await adminClient
        .from('connections')
        .upsert({
          user_id: user.id,
          whatsapp_access_token: accessToken,
          whatsapp_business_account_id: finalWabaId || null,
          whatsapp_phone_number_id: finalPhoneNumberId || null,
          whatsapp_webhook_verify_token: webhookVerifyToken,
          whatsapp_status: 'pending',
          whatsapp_connected_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

      // 4. Auto-configure webhook and register phone
      let webhookOk = false
      let phoneRegOk = false

      if (finalWabaId) {
        // 4a. Subscribe app to WABA webhooks
        try {
          const subRes = await fetch(
            `${GRAPH_BASE}/${finalWabaId}/subscribed_apps`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
            }
          )
          const subData = await subRes.json()
          webhookOk = subRes.ok && subData.success !== false

          if (webhookOk) {
            await logEvent(adminClient, user.id, 'webhook_registered', 'completed', `Webhook registrado para WABA ${finalWabaId}`)
          } else {
            await logEvent(adminClient, user.id, 'webhook_registration_failed', 'failed', JSON.stringify(subData))
          }
        } catch (err) {
          await logEvent(adminClient, user.id, 'webhook_registration_failed', 'failed', String(err))
        }
      }

      if (finalPhoneNumberId) {
        // 4b. Register phone number for Cloud API
        try {
          const regRes = await fetch(
            `${GRAPH_BASE}/${finalPhoneNumberId}/register`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                pin: '123456', // Required by API but auto-generated for Cloud API
              }),
            }
          )
          const regData = await regRes.json()
          phoneRegOk = regRes.ok && regData.success !== false

          if (!phoneRegOk && regData.error?.message?.includes('already registered')) {
            // Already registered is OK
            phoneRegOk = true
          }
        } catch (err) {
          console.error('[embedded-signup] Phone registration error:', err)
        }
      }

      // 5. Update final status
      const finalStatus = (webhookOk || !finalWabaId) ? 'connected' : 'pending'
      
      await adminClient
        .from('connections')
        .update({
          whatsapp_status: finalStatus,
        })
        .eq('user_id', user.id)

      await adminClient
        .from('whatsapp_connections')
        .update({
          status: finalStatus,
        })
        .eq('user_id', user.id)
        .eq('phone_number_id', finalPhoneNumberId || '')

      // Log: signup completed
      await logEvent(adminClient, user.id, 'embedded_signup_completed', 'completed', 
        `WABA: ${finalWabaId || 'N/A'}, Phone: ${finalPhoneNumberId || 'N/A'}, Webhook: ${webhookOk}, PhoneReg: ${phoneRegOk}`)

      return jsonSuccess({
        success: true,
        status: finalStatus,
        waba_id: finalWabaId,
        phone_number_id: finalPhoneNumberId,
        webhook_registered: webhookOk,
        phone_registered: phoneRegOk,
      })
    }

    // =====================================================
    // ACTION: get_config (returns public app config for SDK)
    // =====================================================
    if (action === 'get_config') {
      const configId = Deno.env.get('META_CONFIG_ID')
      
      return jsonSuccess({
        app_id: META_APP_ID,
        config_id: configId || null,
        sdk_version: GRAPH_API_VERSION,
      })
    }

    // =====================================================
    // ACTION: disconnect
    // =====================================================
    if (action === 'disconnect') {
      await adminClient
        .from('whatsapp_connections')
        .update({
          access_token: null,
          business_account_id: null,
          webhook_verify_token: null,
          status: 'disconnected',
          connected_at: null,
        })
        .eq('user_id', user.id)

      await adminClient
        .from('connections')
        .update({
          whatsapp_access_token: null,
          whatsapp_business_account_id: null,
          whatsapp_phone_number_id: null,
          whatsapp_webhook_verify_token: null,
          whatsapp_status: 'disconnected',
          whatsapp_connected_at: null,
        })
        .eq('user_id', user.id)

      await logEvent(adminClient, user.id, 'whatsapp_disconnected', 'completed', 'Usuário desconectou o WhatsApp')

      return jsonSuccess({ success: true })
    }

    return jsonError('Ação não reconhecida', 400)

  } catch (err) {
    console.error('[embedded-signup] Unhandled error:', err)
    return jsonError(friendlyError('GENERIC_ERROR', String(err)), 500)
  }
})

// =====================================================
// HELPERS
// =====================================================

function jsonSuccess(data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function logEvent(
  client: ReturnType<typeof createClient>,
  userId: string,
  action: string,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  message: string,
) {
  try {
    await client.from('sync_logs').insert({
      user_id: userId,
      action,
      status,
      message,
      source: 'embedded-signup',
    })
  } catch (err) {
    console.error('[embedded-signup] Log error:', err)
  }
}
