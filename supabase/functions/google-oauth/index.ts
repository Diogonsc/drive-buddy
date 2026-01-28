// =====================================================
// DriveZapSync - Google OAuth Edge Function
// Gerencia autenticação OAuth 2.0 com Google Drive
// =====================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OAuthRequest {
  action: 'authorize' | 'callback' | 'refresh'
  code?: string
  redirectUri?: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // Verificar autenticação do usuário
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: claims, error: claimsError } = await supabase.auth.getClaims(token)
    
    if (claimsError || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = claims.claims.sub as string
    const { action, code, redirectUri }: OAuthRequest = await req.json()

    // Buscar configurações do usuário
    const { data: connection } = await supabase
      .from('connections')
      .select('google_client_id, google_client_secret, google_redirect_uri, google_refresh_token')
      .eq('user_id', userId)
      .single()

    if (!connection?.google_client_id || !connection?.google_client_secret) {
      return new Response(JSON.stringify({ 
        error: 'Google OAuth credentials not configured' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const clientId = connection.google_client_id
    const clientSecret = connection.google_client_secret
    const configuredRedirectUri = connection.google_redirect_uri

    // =====================================================
    // ACTION: AUTHORIZE - Gerar URL de autorização
    // =====================================================
    if (action === 'authorize') {
      const scopes = [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive.metadata.readonly',
      ]

      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
      authUrl.searchParams.set('client_id', clientId)
      authUrl.searchParams.set('redirect_uri', configuredRedirectUri || redirectUri || '')
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('scope', scopes.join(' '))
      authUrl.searchParams.set('access_type', 'offline')
      authUrl.searchParams.set('prompt', 'consent')
      authUrl.searchParams.set('state', userId) // Para validação no callback

      return new Response(JSON.stringify({ authUrl: authUrl.toString() }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // =====================================================
    // ACTION: CALLBACK - Trocar código por tokens
    // =====================================================
    if (action === 'callback' && code) {
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: configuredRedirectUri || redirectUri || '',
        }),
      })

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text()
        console.error('Token exchange failed:', error)
        return new Response(JSON.stringify({ error: 'Token exchange failed' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const tokens = await tokenResponse.json()

      // Calcular expiração
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

      // Salvar tokens no banco
      await supabase
        .from('connections')
        .update({
          google_access_token: tokens.access_token,
          google_refresh_token: tokens.refresh_token || connection.google_refresh_token,
          google_token_expires_at: expiresAt,
          google_status: 'connected',
          google_connected_at: new Date().toISOString(),
        })
        .eq('user_id', userId)

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Google Drive connected successfully',
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // =====================================================
    // ACTION: REFRESH - Renovar access token
    // =====================================================
    if (action === 'refresh') {
      const refreshToken = connection.google_refresh_token

      if (!refreshToken) {
        return new Response(JSON.stringify({ error: 'No refresh token available' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      })

      if (!tokenResponse.ok) {
        // Refresh token inválido - marcar como desconectado
        await supabase
          .from('connections')
          .update({ google_status: 'error' })
          .eq('user_id', userId)

        return new Response(JSON.stringify({ error: 'Token refresh failed' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const tokens = await tokenResponse.json()
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

      await supabase
        .from('connections')
        .update({
          google_access_token: tokens.access_token,
          google_token_expires_at: expiresAt,
          google_status: 'connected',
        })
        .eq('user_id', userId)

      return new Response(JSON.stringify({ 
        success: true,
        accessToken: tokens.access_token,
        expiresAt,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('OAuth error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
