// =====================================================
// DriveZapSync - Process Media Edge Function
// Baixa mídia do WhatsApp e faz upload para Google Drive
// =====================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface ProcessMediaRequest {
  mediaFileId: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const { mediaFileId }: ProcessMediaRequest = await req.json()

    if (!mediaFileId) {
      return new Response(JSON.stringify({ error: 'mediaFileId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Buscar arquivo e conexões do usuário
    const { data: mediaFile, error: mediaError } = await supabase
      .from('media_files')
      .select('*, connections:user_id(whatsapp_access_token, google_access_token, google_refresh_token, google_root_folder)')
      .eq('id', mediaFileId)
      .single()

    if (mediaError || !mediaFile) {
      throw new Error(`Media file not found: ${mediaFileId}`)
    }

    const connection = (mediaFile as any).connections
    const userId = mediaFile.user_id

    // Atualizar status para processando
    await supabase
      .from('media_files')
      .update({ status: 'processing' })
      .eq('id', mediaFileId)

    await logAction(supabase, userId, mediaFileId, 'download_started', 'processing', 'Iniciando download da mídia')

    // =====================================================
    // STEP 1: Baixar mídia do WhatsApp
    // =====================================================
    const whatsappAccessToken = connection.whatsapp_access_token

    if (!whatsappAccessToken) {
      throw new Error('WhatsApp access token not configured')
    }

    // Primeiro, obter a URL do arquivo
    const mediaUrlResponse = await fetch(
      `https://graph.facebook.com/v18.0/${mediaFile.whatsapp_media_id}`,
      {
        headers: { Authorization: `Bearer ${whatsappAccessToken}` },
      }
    )

    if (!mediaUrlResponse.ok) {
      const error = await mediaUrlResponse.text()
      throw new Error(`Failed to get media URL: ${error}`)
    }

    const mediaUrlData = await mediaUrlResponse.json()
    const downloadUrl = mediaUrlData.url

    // Baixar o arquivo
    const fileResponse = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${whatsappAccessToken}` },
    })

    if (!fileResponse.ok) {
      throw new Error('Failed to download media file')
    }

    const fileBlob = await fileResponse.blob()
    const fileSize = fileBlob.size

    // Atualizar tamanho do arquivo
    await supabase
      .from('media_files')
      .update({ file_size_bytes: fileSize })
      .eq('id', mediaFileId)

    await logAction(supabase, userId, mediaFileId, 'download_completed', 'processing', 
      `Download concluído: ${formatBytes(fileSize)}`, { file_size: fileSize })

    // =====================================================
    // STEP 2: Buscar configurações do usuário
    // =====================================================
    const { data: settings } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single()

    // Verificar limite de tamanho
    const maxSizeMb = settings?.max_file_size_mb || 25
    if (fileSize > maxSizeMb * 1024 * 1024) {
      throw new Error(`Arquivo excede o limite de ${maxSizeMb}MB`)
    }

    // =====================================================
    // STEP 3: Upload para Google Drive
    // =====================================================
    await logAction(supabase, userId, mediaFileId, 'upload_started', 'processing', 'Iniciando upload para Google Drive')

    let googleAccessToken = connection.google_access_token

    if (!googleAccessToken) {
      throw new Error('Google Drive not connected')
    }

    // Tentar refresh do token se necessário
    // (implementação simplificada - em produção, verificar expiração)
    
    // Construir caminho da pasta
    const rootFolder = connection.google_root_folder || '/WhatsApp Uploads'
    const folderPath = buildFolderPath(
      rootFolder,
      mediaFile.file_type,
      settings?.organize_by_date ?? true,
      settings?.organize_by_type ?? true,
      settings?.organize_by_contact ?? false,
      mediaFile.sender_phone
    )

    // Criar/obter pasta no Google Drive
    const folderId = await getOrCreateFolder(googleAccessToken, folderPath, settings?.auto_create_folders ?? true)

    // Fazer upload do arquivo
    const metadata = {
      name: mediaFile.file_name,
      parents: [folderId],
    }

    const formData = new FormData()
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
    formData.append('file', fileBlob)

    const uploadResponse = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${googleAccessToken}` },
        body: formData,
      }
    )

    if (!uploadResponse.ok) {
      const error = await uploadResponse.text()
      throw new Error(`Google Drive upload failed: ${error}`)
    }

    const uploadResult = await uploadResponse.json()

    // =====================================================
    // STEP 4: Atualizar registro com sucesso
    // =====================================================
    await supabase
      .from('media_files')
      .update({
        status: 'completed',
        google_drive_file_id: uploadResult.id,
        google_drive_url: uploadResult.webViewLink,
        google_drive_folder_id: folderId,
        processed_at: new Date().toISOString(),
        uploaded_at: new Date().toISOString(),
      })
      .eq('id', mediaFileId)

    await logAction(supabase, userId, mediaFileId, 'upload_completed', 'completed',
      `Upload concluído: ${mediaFile.file_name}`, {
        google_drive_id: uploadResult.id,
        google_drive_url: uploadResult.webViewLink,
      })

    return new Response(JSON.stringify({ 
      success: true, 
      googleDriveId: uploadResult.id,
      googleDriveUrl: uploadResult.webViewLink,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Process media error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Tentar atualizar o status para failed
    try {
      const { mediaFileId } = await req.clone().json()
      
      const { data: mediaFile } = await supabase
        .from('media_files')
        .select('user_id, retry_count')
        .eq('id', mediaFileId)
        .single()

      if (mediaFile) {
        await supabase
          .from('media_files')
          .update({ 
            status: 'failed', 
            error_message: errorMessage,
            retry_count: (mediaFile.retry_count || 0) + 1,
          })
          .eq('id', mediaFileId)

        await logAction(supabase, mediaFile.user_id, mediaFileId, 'error', 'failed', errorMessage)
      }
    } catch (e) {
      console.error('Failed to update error status:', e)
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// =====================================================
// HELPER FUNCTIONS
// =====================================================

async function logAction(
  supabase: any,
  userId: string,
  mediaFileId: string,
  action: string,
  status: string,
  message: string,
  metadata?: any
) {
  await supabase.from('sync_logs').insert({
    user_id: userId,
    media_file_id: mediaFileId,
    action,
    status,
    message,
    metadata,
  })
}

function buildFolderPath(
  root: string,
  fileType: string,
  byDate: boolean,
  byType: boolean,
  byContact: boolean,
  senderPhone?: string
): string[] {
  const parts = [root.replace(/^\//, '')]
  
  if (byType) {
    const typeNames: Record<string, string> = {
      image: 'Imagens',
      video: 'Vídeos',
      audio: 'Áudios',
      document: 'Documentos',
    }
    parts.push(typeNames[fileType] || 'Outros')
  }
  
  if (byDate) {
    const now = new Date()
    parts.push(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  }
  
  if (byContact && senderPhone) {
    parts.push(senderPhone.replace(/\D/g, ''))
  }
  
  return parts
}

async function getOrCreateFolder(
  accessToken: string,
  folderPath: string[],
  autoCreate: boolean
): Promise<string> {
  let parentId = 'root'
  
  for (const folderName of folderPath) {
    // Buscar pasta existente
    const searchResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
      )}&fields=files(id,name)`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )
    
    const searchResult = await searchResponse.json()
    
    if (searchResult.files && searchResult.files.length > 0) {
      parentId = searchResult.files[0].id
    } else if (autoCreate) {
      // Criar pasta
      const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentId],
        }),
      })
      
      const createResult = await createResponse.json()
      parentId = createResult.id
    } else {
      throw new Error(`Pasta não encontrada: ${folderName}`)
    }
  }
  
  return parentId
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
