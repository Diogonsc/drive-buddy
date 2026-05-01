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

// Envia mensagem de resposta automática via Twilio
async function sendTwilioReply(
  to: string,   // número de quem enviou (From)
  from: string, // número Twilio da plataforma (To)
  message: string,
  subaccountSid?: string | null,
  subaccountAuthToken?: string | null,
): Promise<void> {
  // Usa credenciais da subaccount do cliente se disponíveis (modelo profissional)
  // Fallback para credenciais globais (modelo sandbox/teste)
  const accountSid = subaccountSid || Deno.env.get('TWILIO_ACCOUNT_SID')
  const authToken = subaccountAuthToken || Deno.env.get('TWILIO_AUTH_TOKEN')
  if (!accountSid || !authToken) return

  const credentials = btoa(`${accountSid}:${authToken}`)
  await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: from,
        To: to,
        Body: message,
      }).toString(),
    },
  ).catch(err => console.error('[WEBHOOK] Erro ao enviar resposta automática:', err))
}

// Retorna mensagem de erro amigável baseada no tipo de mídia
function getFileSizeErrorMessage(mimeType: string): string {
  if (mimeType.startsWith('video/')) {
    return '⚠️ Vídeo não processado: o arquivo é muito grande (máximo 16 MB).\n\nDica: compacte o vídeo ou envie em partes menores e tente novamente.'
  }
  if (mimeType.startsWith('image/')) {
    return '⚠️ Imagem não processada: o arquivo é muito grande (máximo 5 MB).\n\nTente enviar a imagem em resolução menor.'
  }
  if (mimeType.startsWith('audio/')) {
    return '⚠️ Áudio não processado: o arquivo é muito grande (máximo 16 MB).\n\nTente enviar o áudio em partes menores.'
  }
  return '⚠️ Arquivo não processado: o tamanho excede o limite permitido.\n\nVerifique o tamanho e tente novamente.'
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

  // Identifica o usuário pelo número Twilio de destino (To)
  // O From (remetente) é salvo como sender_phone no registro de mídia
  const { data: activeConnection } = await supabase
    .from('whatsapp_connections')
    .select('id, user_id, twilio_subaccount_sid, twilio_subaccount_auth_token')
    .eq('twilio_whatsapp_number', to)
    .in('status', ['connected', 'pending'])
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (numMedia === 0) {
    // Mensagem de texto sem mídia — orienta o usuário
    const body = params.get('Body') || ''
    if (body.trim() && !activeConnection) {
      // Só responde se não for o join do sandbox
      const lowerBody = body.toLowerCase().trim()
      const isSandboxJoin = lowerBody.startsWith('join ')
      if (!isSandboxJoin) {
        await sendTwilioReply(
          from,
          to,
          '📁 Olá! Para usar o Swiftwapdrive, envie arquivos (fotos, vídeos, áudios ou documentos) diretamente nesta conversa e eles serão salvos automaticamente no Google Drive.',
          activeConnection?.twilio_subaccount_sid as string | null,
          activeConnection?.twilio_subaccount_auth_token as string | null,
        )
      }
    }
    return new Response('<Response></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    })
  }

  if (!activeConnection) {
    console.error(`[WEBHOOK] Nenhuma conexão para número: ${to}`)
    return new Response('<Response></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    })
  }

  // Valida assinatura usando credenciais da SUBACCOUNT do cliente
  const skipValidation = Deno.env.get('SKIP_TWILIO_SIGNATURE_VALIDATION') === 'true'
  if (!skipValidation && activeConnection.twilio_subaccount_auth_token) {
    const isValid = await validateTwilioSignature(
      req,
      rawBody,
      req.url,
      activeConnection.twilio_subaccount_auth_token as string,
    )
    if (!isValid) {
      console.error('[WEBHOOK] Assinatura inválida')
      return new Response('Forbidden', { status: 403 })
    }
  }

  // Processa cada mídia
  for (let i = 0; i < numMedia; i++) {
    const mediaUrl = params.get(`MediaUrl${i}`) || ''
    const mimeType = params.get(`MediaContentType${i}`) || 'application/octet-stream'

    // Verifica se a URL indica erro de tamanho (Twilio retorna URL vazia ou com erro)
    // O erro 11751 faz o Twilio não enviar MediaUrl, mas envia NumMedia > 0
    // Nesse caso, registra erro e avisa o remetente
    if (!mediaUrl || mediaUrl.includes('error')) {
      console.error(`[WEBHOOK] Mídia ${i} com erro de tamanho`)
      
      const errorMessage = getFileSizeErrorMessage(mimeType)
      await sendTwilioReply(
        from,
        to,
        errorMessage,
        activeConnection?.twilio_subaccount_sid as string | null,
        activeConnection?.twilio_subaccount_auth_token as string | null,
      )
      
      // Registra tentativa no banco para aparecer no dashboard
      if (activeConnection) {
        await supabase.from('media_files').insert({
          user_id: activeConnection.user_id,
          whatsapp_connection_id: activeConnection.id,
          whatsapp_media_id: `error_${messageSid}_${i}`,
          whatsapp_message_id: `${messageSid}_media${i}`,
          sender_phone: from.replace('whatsapp:', ''),
          sender_name: profileName,
          file_name: `arquivo_rejeitado_${i}`,
          file_type: mimeType.startsWith('video/') ? 'video' :
                     mimeType.startsWith('image/') ? 'image' :
                     mimeType.startsWith('audio/') ? 'audio' : 'document',
          mime_type: mimeType,
          status: 'failed',
          error_message: 'Arquivo rejeitado: tamanho excede o limite permitido (vídeos: 16 MB, imagens: 5 MB)',
          received_at: timestamp,
        })
      }
      continue
    }

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
        user_id: activeConnection.user_id,
        whatsapp_connection_id: activeConnection.id,
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
      .eq('id', activeConnection.id)
      .eq('status', 'pending')

    // Processa em sequência para evitar condição de corrida nas pastas do Drive
    try {
      await supabase.functions.invoke('process-media', {
        body: { mediaFileId: mediaFile.id },
      })
    } catch (err) {
      console.error('[WEBHOOK] process-media error:', err)
    }
  }

  return new Response('<Response></Response>', {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
  })
})
