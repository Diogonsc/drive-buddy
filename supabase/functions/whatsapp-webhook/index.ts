// =====================================================
// DriveZapSync - WhatsApp Webhook (Production Ready)
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
): Promise<boolean> {
  const signature = req.headers.get('x-hub-signature-256')
  if (!signature) return false

  const secret = Deno.env.get('WHATSAPP_APP_SECRET')
  if (!secret) throw new Error('Missing WHATSAPP_APP_SECRET')

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
  if (signature.length !== expected.length) return false
  
  const sigBytes = encoder.encode(signature)
  const expBytes = encoder.encode(expected)
  
  let result = 0
  for (let i = 0; i < sigBytes.length; i++) {
    result |= sigBytes[i] ^ expBytes[i]
  }
  
  return result === 0
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

    if (mode === 'subscribe') {
      const { data } = await supabase
        .from('connections')
        .select('user_id')
        .eq('whatsapp_webhook_verify_token', token)
        .maybeSingle()

      if (data) {
        return new Response(challenge, { status: 200 })
      }
    }

    return new Response('Forbidden', { status: 403 })
  }

  // =====================================================
  // PROCESS EVENTS (POST)
  // =====================================================
  if (req.method === 'POST') {
    const rawBody = await req.text()

    // 🔐 Signature validation
    const validSignature = await verifySignature(req, rawBody)
    if (!validSignature) {
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

        const { data: connection } = await supabase
          .from('connections')
          .select('user_id, whatsapp_access_token')
          .eq('whatsapp_phone_number_id', metadata.phone_number_id)
          .single()

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
            (message as any).document?.filename ||
            `${message.type}_${message.id}.${extension}`

          const { data: mediaFile } = await supabase
            .from('media_files')
            .insert({
              user_id: connection.user_id,
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

          // 🔄 Async processing (download + Drive)
          await supabase.functions.invoke('process-media', {
            body: {
              mediaFileId: mediaFile.id,
              accessToken: connection.whatsapp_access_token,
            },
          })
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
