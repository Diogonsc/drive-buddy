// =====================================================
// DriveZapSync - WhatsApp Webhook Edge Function
// Recebe eventos do WhatsApp e processa mídias
// =====================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface WhatsAppMessage {
  from: string
  id: string
  timestamp: string
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker'
  image?: { id: string; mime_type: string; sha256: string; caption?: string }
  video?: { id: string; mime_type: string; sha256: string; caption?: string }
  audio?: { id: string; mime_type: string; sha256: string }
  document?: { id: string; mime_type: string; sha256: string; filename: string; caption?: string }
}

interface WhatsAppWebhookPayload {
  object: string
  entry: Array<{
    id: string
    changes: Array<{
      value: {
        messaging_product: string
        metadata: { display_phone_number: string; phone_number_id: string }
        contacts?: Array<{ profile: { name: string }; wa_id: string }>
        messages?: WhatsAppMessage[]
      }
      field: string
    }>
  }>
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // =====================================================
    // VERIFICAÇÃO DO WEBHOOK (GET request do Meta)
    // =====================================================
    if (req.method === 'GET') {
      const url = new URL(req.url)
      const mode = url.searchParams.get('hub.mode')
      const token = url.searchParams.get('hub.verify_token')
      const challenge = url.searchParams.get('hub.challenge')

      console.log('Webhook verification request:', { mode, token })

      if (mode === 'subscribe') {
        // Buscar o verify token do banco
        const { data: connections } = await supabase
          .from('connections')
          .select('whatsapp_webhook_verify_token, user_id')
          .not('whatsapp_webhook_verify_token', 'is', null)

        const validConnection = connections?.find(c => c.whatsapp_webhook_verify_token === token)

        if (validConnection) {
          console.log('Webhook verified successfully for user:', validConnection.user_id)
          return new Response(challenge, { status: 200 })
        }
      }

      return new Response('Forbidden', { status: 403 })
    }

    // =====================================================
    // PROCESSAR MENSAGENS (POST request)
    // =====================================================
    if (req.method === 'POST') {
      const payload: WhatsAppWebhookPayload = await req.json()
      console.log('Received webhook payload:', JSON.stringify(payload, null, 2))

      // Validar estrutura do payload
      if (payload.object !== 'whatsapp_business_account') {
        return new Response('Invalid payload', { status: 400 })
      }

      for (const entry of payload.entry) {
        for (const change of entry.changes) {
          if (change.field !== 'messages') continue

          const { metadata, contacts, messages } = change.value
          const phoneNumberId = metadata.phone_number_id

          // Encontrar o usuário pelo phone_number_id
          const { data: connection } = await supabase
            .from('connections')
            .select('user_id, whatsapp_access_token')
            .eq('whatsapp_phone_number_id', phoneNumberId)
            .single()

          if (!connection) {
            console.log('No connection found for phone_number_id:', phoneNumberId)
            continue
          }

          const userId = connection.user_id
          const accessToken = connection.whatsapp_access_token

          if (!messages) continue

          for (const message of messages) {
            // Processar apenas mensagens de mídia
            const mediaTypes = ['image', 'video', 'audio', 'document']
            if (!mediaTypes.includes(message.type)) continue

            const contact = contacts?.find(c => c.wa_id === message.from)
            const senderName = contact?.profile?.name || message.from

            // Extrair informações da mídia
            const mediaData = message[message.type as keyof WhatsAppMessage] as {
              id: string
              mime_type: string
              filename?: string
            }

            if (!mediaData) continue

            // Mapear tipo de mídia
            const mediaTypeMap: Record<string, string> = {
              image: 'image',
              video: 'video',
              audio: 'audio',
              document: 'document',
            }

            const fileName = (mediaData as any).filename || 
              `${message.type}_${Date.now()}.${getExtensionFromMime(mediaData.mime_type)}`

            // Inserir no banco
            const { data: mediaFile, error: insertError } = await supabase
              .from('media_files')
              .insert({
                user_id: userId,
                whatsapp_media_id: mediaData.id,
                whatsapp_message_id: message.id,
                sender_phone: message.from,
                sender_name: senderName,
                file_name: fileName,
                file_type: mediaTypeMap[message.type],
                mime_type: mediaData.mime_type,
                status: 'pending',
                received_at: new Date(parseInt(message.timestamp) * 1000).toISOString(),
              })
              .select()
              .single()

            if (insertError) {
              console.error('Error inserting media file:', insertError)
              
              // Log do erro
              await supabase.from('sync_logs').insert({
                user_id: userId,
                action: 'webhook_received',
                status: 'failed',
                message: `Erro ao inserir arquivo: ${insertError.message}`,
                metadata: { whatsapp_media_id: mediaData.id, error: insertError },
              })
              
              continue
            }

            // Log de sucesso
            await supabase.from('sync_logs').insert({
              user_id: userId,
              media_file_id: mediaFile.id,
              action: 'webhook_received',
              status: 'pending',
              message: `Mídia recebida: ${fileName}`,
              metadata: {
                sender: senderName,
                type: message.type,
                mime_type: mediaData.mime_type,
              },
            })

            console.log('Media file queued for processing:', mediaFile.id)

            // Chamar função de processamento (async)
            // Isso será feito em uma Edge Function separada
            await supabase.functions.invoke('process-media', {
              body: { mediaFileId: mediaFile.id },
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
  } catch (error) {
    console.error('Webhook error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

function getExtensionFromMime(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/3gpp': '3gp',
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/amr': 'amr',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  }
  return mimeMap[mimeType] || 'bin'
}
