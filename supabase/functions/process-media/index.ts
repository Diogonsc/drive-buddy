// =====================================================
// DriveZapSync - Process Media (SaaS Production Ready)
// =====================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MAX_RETRIES = 3

Deno.serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    const { mediaFileId } = await req.json()
    if (!mediaFileId) throw new Error('mediaFileId required')

    // =====================================================
    // 1️⃣ LOCK + IDEMPOTÊNCIA
    // =====================================================
    const { data: mediaFile } = await supabase
      .from('media_files')
      .update({ status: 'processing' })
      .eq('id', mediaFileId)
      .eq('status', 'pending')
      .select(`
        *,
        connections:user_id(
          whatsapp_access_token,
          google_access_token,
          google_refresh_token,
          google_root_folder
        )
      `)
      .single()

    if (!mediaFile) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'Already processed or locked' }),
        { status: 200 },
      )
    }

    const userId = mediaFile.user_id
    const connection = mediaFile.connections

    // =====================================================
    // 2️⃣ CONTROLE DE RETRY
    // =====================================================
    if ((mediaFile.retry_count || 0) >= MAX_RETRIES) {
      await markPermanentFailure(
        supabase,
        mediaFileId,
        userId,
        'Retry limit exceeded',
      )
      return new Response(JSON.stringify({ error: 'Retry limit exceeded' }), {
        status: 429,
      })
    }

    // =====================================================
    // 3️⃣ VALIDAR PLANO / LIMITES
    // =====================================================
    const { data: plan } = await supabase
      .from('user_plans')
      .select('monthly_file_limit, files_used')
      .eq('user_id', userId)
      .single()

    if (plan && plan.files_used >= plan.monthly_file_limit) {
      throw new Error('Monthly file limit exceeded')
    }

    // =====================================================
    // 4️⃣ DOWNLOAD DO WHATSAPP
    // =====================================================
    const mediaMeta = await fetch(
      `https://graph.facebook.com/v18.0/${mediaFile.whatsapp_media_id}`,
      {
        headers: {
          Authorization: `Bearer ${connection.whatsapp_access_token}`,
        },
      },
    ).then(r => {
      if (!r.ok) throw new Error('Failed to fetch media metadata')
      return r.json()
    })

    const fileResponse = await fetch(mediaMeta.url, {
      headers: {
        Authorization: `Bearer ${connection.whatsapp_access_token}`,
      },
    })

    if (!fileResponse.ok) throw new Error('Failed to download media')

    const blob = await fileResponse.blob()

    // =====================================================
    // 5️⃣ UPLOAD GOOGLE DRIVE (COM REFRESH)
    // =====================================================
    let googleToken = connection.google_access_token
    let upload = await uploadToDrive(
      googleToken,
      mediaFile.file_name,
      blob,
    )

    if (upload.status === 401) {
      googleToken = await refreshGoogleToken(
        connection.google_refresh_token,
        supabase,
        userId,
      )
      upload = await uploadToDrive(
        googleToken,
        mediaFile.file_name,
        blob,
      )
    }

    if (!upload.ok) {
      throw new Error(await upload.text())
    }

    const result = await upload.json()

    // =====================================================
    // 6️⃣ FINALIZAÇÃO
    // =====================================================
    await supabase
      .from('media_files')
      .update({
        status: 'completed',
        google_drive_file_id: result.id,
        google_drive_url: result.webViewLink,
        processed_at: new Date().toISOString(),
      })
      .eq('id', mediaFileId)

    await supabase
      .from('user_plans')
      .update({ files_used: (plan?.files_used || 0) + 1 })
      .eq('user_id', userId)

    return new Response(JSON.stringify({ success: true }), { status: 200 })

  } catch (error) {
    console.error('Process media error:', error)

    try {
      const { mediaFileId } = await req.clone().json()
      await registerFailure(supabase, mediaFileId, (error as Error).message)
    } catch {}

    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500 },
    )
  }
})

// =====================================================
// HELPERS
// =====================================================

async function uploadToDrive(token: string, filename: string, blob: Blob) {
  const form = new FormData()
  form.append(
    'metadata',
    new Blob([JSON.stringify({ name: filename })], {
      type: 'application/json',
    }),
  )
  form.append('file', blob)

  return fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    },
  )
}

async function refreshGoogleToken(refreshToken: string, supabase: any, userId: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  const data = await res.json()

  await supabase
    .from('connections')
    .update({ google_access_token: data.access_token })
    .eq('user_id', userId)

  return data.access_token
}

async function registerFailure(
  supabase: any,
  mediaFileId: string,
  errorMessage: string,
) {
  const { data } = await supabase
    .from('media_files')
    .select('retry_count')
    .eq('id', mediaFileId)
    .single()

  const retries = (data?.retry_count || 0) + 1

  await supabase
    .from('media_files')
    .update({
      status: retries >= MAX_RETRIES ? 'permanent_failed' : 'pending',
      retry_count: retries,
      error_message: errorMessage,
    })
    .eq('id', mediaFileId)
}

async function markPermanentFailure(
  supabase: any,
  mediaFileId: string,
  userId: string,
  reason: string,
) {
  await supabase
    .from('media_files')
    .update({
      status: 'permanent_failed',
      error_message: reason,
    })
    .eq('id', mediaFileId)
}
