// supabase/functions/whatsapp-webhook/index.ts
// Swiftwapdrive - Webhook central Twilio (modelo subaccount)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-twilio-signature',
}

async function validateTwilioSignature(
  req: Request,
  rawBody: string,
  webhookUrl: string,
  authToken: string,
): Promise<boolean> {
  const twilioSignature = req.headers.get('x-twilio-signature')
  if (!twilioSignature) return false

  const params = new URLSearchParams(rawBody)
  const sortedKeys = Array.from(params.keys()).sort()
  const stringToSign = webhookUrl + sortedKeys.map(k => k + params.get(k)).join('')

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
    'image/jpeg': 'jpg', 'image/png': 'png', 'video/mp4': 'mp4',
    'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/amr': 'amr',
    'application/pdf': 'pdf', 'application/msword': 'doc',
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method === 'GET') return new Response('OK', { status: 200 })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const rawBody = await req.text()
  const params = new URLSearchParams(rawBody)

  const messageSid = params.get('MessageSid') || ''
  const from = params.get('From') || ''       // whatsapp:+5511999999999
  const to = params.get('To') || ''           // whatsapp:+5511XXXXXXXX (número Twilio do cliente)
  const profileName = params.get('ProfileName') || from
  const numMedia = parseInt(params.get('NumMedia') || '0', 10)
  const timestamp = new Date().toISOString()

  if (numMedia === 0) {
    return new Response('<Response></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    })
  }

  // Busca conexão pelo número Twilio de destino
  const { data: connection } = await supabase
    .from('whatsapp_connections')
    .select('id, user_id, twilio_subaccount_sid, twilio_subaccount_auth_token')
    .eq('twilio_whatsapp_number', to)
    .in('status', ['connected', 'pending'])
    .maybeSingle()

  if (!connection) {
    console.error(`[WEBHOOK] Nenhuma conexão para número: ${to}`)
    return new Response('<Response></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    })
  }

  // Valida assinatura usando credenciais da SUBACCOUNT do cliente
  const skipValidation = Deno.env.get('SKIP_TWILIO_SIGNATURE_VALIDATION') === 'true'
  if (!skipValidation && connection.twilio_subaccount_auth_token) {
    const isValid = await validateTwilioSignature(
      req,
      rawBody,
      req.url,
      connection.twilio_subaccount_auth_token as string,
    )
    if (!isValid) {
      console.error('[WEBHOOK] Assinatura inválida')
      return new Response('Forbidden', { status: 403 })
    }
  }

  // Processa cada mídia
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
        user_id: connection.user_id,
        whatsapp_connection_id: connection.id,
        whatsapp_media_id: mediaUrl,
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

    // Atualiza status para connected na primeira mensagem
    await supabase
      .from('whatsapp_connections')
      .update({ status: 'connected', connected_at: timestamp })
      .eq('id', connection.id)
      .eq('status', 'pending')

    // Dispara processamento assíncrono
    supabase.functions.invoke('process-media', {
      body: { mediaFileId: mediaFile.id },
    }).catch(err => console.error('[WEBHOOK] process-media error:', err))
  }

  return new Response('<Response></Response>', {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
  })
})
