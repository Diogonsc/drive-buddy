// supabase/functions/whatsapp-webhook/index.ts
// Swiftwapdrive - WhatsApp Webhook via Twilio

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
//import { hmac } from 'https://deno.land/x/hmac@v2.0.1/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-twilio-signature',
}

// Valida assinatura Twilio (HMAC-SHA1)
// Docs: https://www.twilio.com/docs/usage/webhooks/webhooks-security
async function validateTwilioSignature(
  req: Request,
  rawBody: string,
  webhookUrl: string,
): Promise<boolean> {
  const twilioSignature = req.headers.get('x-twilio-signature')
  if (!twilioSignature) return false

  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
  if (!authToken) {
    console.error('TWILIO_AUTH_TOKEN não configurado')
    return false
  }

  // Monta string para assinar: URL + params ordenados
  const params = new URLSearchParams(rawBody)
  const sortedKeys = Array.from(params.keys()).sort()
  const stringToSign = webhookUrl + sortedKeys.map(k => k + params.get(k)).join('')

  // HMAC-SHA1 via Web Crypto API (nativo no Deno, sem imports externos)
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(authToken),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(stringToSign))
  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))

  return signature === twilioSignature
}

function getExtensionFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'video/mp4': 'mp4',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/amr': 'amr',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  }
  return map[mime] || 'bin'
}

function getFileType(mime: string): 'image' | 'video' | 'audio' | 'document' {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  return 'document'
}

async function findConnectionByTwilioNumber(
  supabase: ReturnType<typeof createClient>,
  toNumber: string, // formato: whatsapp:+14155238886
) {
  const { data } = await supabase
    .from('whatsapp_connections')
    .select('id, user_id, twilio_account_sid, twilio_auth_token')
    .eq('twilio_whatsapp_number', toNumber)
    .in('status', ['connected', 'pending'])
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!data) return null

  return {
    connectionId: data.id as string,
    userId: data.user_id as string,
    accountSid: data.twilio_account_sid as string,
    authToken: data.twilio_auth_token as string,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Twilio envia GET para verificação de URL (opcional, mas aceitar graciosamente)
  if (req.method === 'GET') {
    return new Response('OK', { status: 200 })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const rawBody = await req.text()

  // Validação de assinatura Twilio
  // Em desenvolvimento/sandbox, pode-se desabilitar via env SKIP_TWILIO_SIGNATURE_VALIDATION=true
  const skipValidation = Deno.env.get('SKIP_TWILIO_SIGNATURE_VALIDATION') === 'true'
  if (!skipValidation) {
    const webhookUrl = req.url
    const isValid = await validateTwilioSignature(req, rawBody, webhookUrl)
    if (!isValid) {
      console.error('Assinatura Twilio inválida')
      return new Response('Forbidden', { status: 403 })
    }
  }

  const params = new URLSearchParams(rawBody)

  // Campos principais do payload Twilio WhatsApp
  const messageSid = params.get('MessageSid') || ''
  const from = params.get('From') || '' // ex: whatsapp:+5511999999999
  const to = params.get('To') || '' // ex: whatsapp:+14155238886
  const profileName = params.get('ProfileName') || from
  const numMedia = parseInt(params.get('NumMedia') || '0', 10)
  const timestamp = new Date().toISOString()

  // Sem mídia: ignorar (só texto)
  if (numMedia === 0) {
    return new Response(
      '<Response></Response>',
      { status: 200, headers: { 'Content-Type': 'text/xml' } },
    )
  }

  // Identificar conexão pelo número Twilio de destino (To)
  const connection = await findConnectionByTwilioNumber(supabase, to)
  if (!connection) {
    console.error(`Nenhuma conexão encontrada para número Twilio: ${to}`)
    return new Response(
      '<Response></Response>',
      { status: 200, headers: { 'Content-Type': 'text/xml' } },
    )
  }

  // Processar cada mídia (Twilio suporta até 10 por mensagem: MediaUrl0..MediaUrl9)
  for (let i = 0; i < numMedia; i++) {
    const mediaUrl = params.get(`MediaUrl${i}`)
    const mimeType = params.get(`MediaContentType${i}`) || 'application/octet-stream'

    if (!mediaUrl) continue

    const mediaId = `${messageSid}_media${i}`

    // Idempotência
    const { data: exists } = await supabase
      .from('media_files')
      .select('id')
      .eq('whatsapp_message_id', mediaId)
      .maybeSingle()

    if (exists) continue

    const fileType = getFileType(mimeType)
    const extension = getExtensionFromMime(mimeType)
    const filename = `${fileType}_${messageSid}_${i}.${extension}`
    const senderPhone = from.replace('whatsapp:', '')

    const { data: mediaFile } = await supabase
      .from('media_files')
      .insert({
        user_id: connection.userId,
        whatsapp_connection_id: connection.connectionId,
        whatsapp_media_id: mediaUrl, // No Twilio, guardamos a URL diretamente como media_id
        whatsapp_message_id: mediaId,
        sender_phone: senderPhone,
        sender_name: profileName,
        file_name: filename,
        file_type: fileType,
        mime_type: mimeType,
        status: 'pending',
        received_at: timestamp,
      })
      .select()
      .single()

    if (!mediaFile) continue

    // Confirmar conexão na primeira mensagem recebida
    await supabase
      .from('whatsapp_connections')
      .update({ status: 'connected', connected_at: timestamp })
      .eq('id', connection.connectionId)
      .eq('status', 'pending')

    // Disparar processamento assíncrono (não aguardar — evita timeout do webhook)
    supabase.functions.invoke('process-media', {
      body: { mediaFileId: mediaFile.id },
    }).catch(err => console.error('process-media invoke error:', err))
  }

  // Twilio exige resposta TwiML (pode ser vazio)
  return new Response(
    '<Response></Response>',
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/xml' } },
  )
})
