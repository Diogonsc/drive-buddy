// =====================================================
// SwiftwapdriveSync - WhatsApp Webhook (Production Ready)
// =====================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
}

// =====================================================
// TYPES
// =====================================================

interface MediaPayload {
  id: string
  mime_type: string
}

interface WhatsAppMessage {
  from: string
  id: string
  timestamp: string
  type: 'text' | 'image' | 'video' | 'audio' | 'document'
  image?: MediaPayload
  video?: MediaPayload
  audio?: MediaPayload
  document?: MediaPayload & { filename?: string }
}

interface WhatsAppWebhookPayload {
  object: string
  entry: Array<{
    changes: Array<{
      value: {
        messaging_product: string
        metadata: {
          phone_number_id: string
        }
        contacts?: Array<{ wa_id: string; profile: { name: string } }>
        messages?: WhatsAppMessage[]
      }
      field: string
    }>
  }>
}

// =====================================================
// HELPERS
// =====================================================

async function verifySignature(
  req: Request,
  rawBody: string,
): Promise<{ valid: boolean; missingSecret?: boolean }> {
  const signature = req.headers.get('x-hub-signature-256')
  if (!signature) return { valid: false }

  const secret = Deno.env.get('WHATSAPP_APP_SECRET')
  if (!secret) return { valid: false, missingSecret: true }

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signed = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(rawBody),
  )

  const expected =
    'sha256=' +
    Array.from(new Uint8Array(signed))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

  // Constant-time comparison to prevent timing attacks
  if (signature.length !== expected.length) return { valid: false }
  
  const sigBytes = encoder.encode(signature)
  const expBytes = encoder.encode(expected)
  
  let result = 0
  for (let i = 0; i < sigBytes.length; i++) {
    result |= sigBytes[i] ^ expBytes[i]
  }

  return { valid: result === 0 }
}

function getExtensionFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'video/mp4': 'mp4',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      'docx',
  }
  return map[mime] || 'bin'
}

async function findWhatsAppConnectionByPhoneNumber(
  supabase: ReturnType<typeof createClient>,
  phoneNumberId: string,
) {
  const { data: multiConn } = await supabase
    .from('whatsapp_connections')
    .select('id, user_id, access_token')
    .eq('phone_number_id', phoneNumberId)
    .maybeSingle()

  if (multiConn) {
    return {
      connectionId: multiConn.id as string,
      userId: multiConn.user_id as string,
      accessToken: (multiConn.access_token as string | null) || null,
    }
  }

  const { data: legacyConn } = await supabase
    .from('connections')
    .select('user_id, whatsapp_access_token')
    .eq('whatsapp_phone_number_id', phoneNumberId)
    .maybeSingle()

  if (!legacyConn) return null

  return {
    connectionId: null,
    userId: legacyConn.user_id as string,
    accessToken: (legacyConn.whatsapp_access_token as string | null) || null,
  }
}

// =====================================================
// SERVER
// =====================================================

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // =====================================================
  // WEBHOOK VERIFICATION (GET)
  // =====================================================
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    if (mode === 'subscribe' && token != null && challenge != null) {
      const globalVerifyToken = Deno.env.get('WHATSAPP_WEBHOOK_VERIFY_TOKEN')
      if (globalVerifyToken && token === globalVerifyToken) {
        return new Response(challenge, {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        })
      }

      const { data: multiConnection } = await supabase
        .from('whatsapp_connections')
        .select('user_id')
        .eq('webhook_verify_token', token)
        .maybeSingle()

      if (multiConnection) {
        return new Response(challenge, {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        })
      }

      const { data } = await supabase
        .from('connections')
        .select('user_id')
        .eq('whatsapp_webhook_verify_token', token)
        .maybeSingle()

      if (data) {
        return new Response(challenge, {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        })
      }
    }

    return new Response('Forbidden', { status: 403 })
  }

  // =====================================================
  // PROCESS EVENTS (POST)
  // =====================================================
  if (req.method === 'POST') {
    const rawBody = await req.text()

    // 🔐 Signature validation (WHATSAPP_APP_SECRET obrigatório em produção)
    const sigResult = await verifySignature(req, rawBody)
    if (sigResult.missingSecret) {
      console.error('WHATSAPP_APP_SECRET not set in Edge Function secrets')
      return new Response(
        JSON.stringify({ error: 'Server misconfiguration: WHATSAPP_APP_SECRET required' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    if (!sigResult.valid) {
      return new Response('Invalid signature', { status: 403 })
    }

    const payload: WhatsAppWebhookPayload = JSON.parse(rawBody)

    if (payload.object !== 'whatsapp_business_account') {
      return new Response('Invalid payload', { status: 400 })
    }

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.field !== 'messages') continue

        const { metadata, messages, contacts } = change.value
        if (!messages) continue

        const connection = await findWhatsAppConnectionByPhoneNumber(
          supabase,
          metadata.phone_number_id,
        )

        if (!connection) continue

        for (const message of messages) {
          if (!['image', 'video', 'audio', 'document'].includes(message.type))
            continue

          // 🧠 Idempotência
          const { data: exists } = await supabase
            .from('media_files')
            .select('id')
            .eq('whatsapp_message_id', message.id)
            .maybeSingle()

          if (exists) continue

          const mediaType = message.type as 'image' | 'video' | 'audio' | 'document'
          const media: MediaPayload | undefined = 
            mediaType === 'image' ? message.image :
            mediaType === 'video' ? message.video :
            mediaType === 'audio' ? message.audio :
            mediaType === 'document' ? message.document :
            undefined
          if (!media) continue

          const contact = contacts?.find(c => c.wa_id === message.from)
          const senderName = contact?.profile?.name || message.from

          const extension = getExtensionFromMime(media.mime_type)
          const filename =
            message.document?.filename ||
            `${message.type}_${message.id}.${extension}`

          const { data: mediaFile } = await supabase
            .from('media_files')
            .insert({
              user_id: connection.userId,
              whatsapp_connection_id: connection.connectionId,
              whatsapp_media_id: media.id,
              whatsapp_message_id: message.id,
              sender_phone: message.from,
              sender_name: senderName,
              file_name: filename,
              file_type: message.type,
              mime_type: media.mime_type,
              status: 'pending',
              received_at: new Date(
                Number(message.timestamp) * 1000,
              ).toISOString(),
            })
            .select()
            .single()

          if (!mediaFile) continue

          // Marcar conexão como confirmada na primeira mensagem recebida
          await supabase
            .from('connections')
            .update({
              whatsapp_status: 'connected',
              whatsapp_connected_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', connection.userId)
            .eq('whatsapp_status', 'pending')

          if (connection.connectionId) {
            await supabase
              .from('whatsapp_connections')
              .update({
                status: 'connected',
                connected_at: new Date().toISOString(),
              })
              .eq('id', connection.connectionId)
          }

          // 🔄 Processamento assíncrono (não aguardar — evita timeout do webhook no Meta)
          supabase.functions.invoke('process-media', {
            body: { mediaFileId: mediaFile.id },
          }).catch(err => console.error('process-media invoke error:', err))
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response('Method not allowed', { status: 405 })
})
