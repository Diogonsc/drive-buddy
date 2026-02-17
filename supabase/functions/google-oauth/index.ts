// =====================================================
// SwiftwapdriveSync - Google OAuth Edge Function
// Gerencia autenticação OAuth 2.0 com Google Drive
// Credenciais centralizadas via Supabase Secrets
// =====================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface OAuthRequest {
  action: 'authorize' | 'callback' | 'refresh'
  code?: string
  redirectUri?: string
  accountId?: string
  accountLabel?: string
}

async function getGoogleAccountEmail(accessToken: string): Promise<string | null> {
  const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) return null
  const json = await res.json()
  return json?.user?.emailAddress || null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Credenciais centralizadas (Supabase Secrets)
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')

  if (!clientId || !clientSecret) {
    return new Response(JSON.stringify({ 
      error: 'Google OAuth credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Supabase secrets.' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    // Verificar autenticação do usuário
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser()
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = user.id
    const { action, code, redirectUri, accountId, accountLabel }: OAuthRequest = await req.json()

    // Criar cliente com service role para operações de banco
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Buscar configurações do usuário (apenas tokens, não credenciais)
    const { data: connection } = await supabase
      .from('connections')
      .select('google_redirect_uri, google_refresh_token')
      .eq('user_id', userId)
      .single()

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('google_accounts_limit')
      .eq('user_id', userId)
      .maybeSingle()

    const googleAccountsLimit = Math.max(1, Number(subscription?.google_accounts_limit || 1))

    const configuredRedirectUri = connection?.google_redirect_uri || redirectUri || ''

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
      authUrl.searchParams.set('redirect_uri', redirectUri || configuredRedirectUri)
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('scope', scopes.join(' '))
      authUrl.searchParams.set('access_type', 'offline')
      authUrl.searchParams.set('prompt', 'consent')
      authUrl.searchParams.set('state', userId)

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
          redirect_uri: redirectUri || configuredRedirectUri,
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
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      const accountEmail = await getGoogleAccountEmail(tokens.access_token)

      // Validate account limit only for a brand new account
      const { data: existingByEmail } = accountEmail
        ? await supabase
            .from('google_drive_accounts')
            .select('id')
            .eq('user_id', userId)
            .eq('account_email', accountEmail)
            .maybeSingle()
        : { data: null }

      const { count: activeGoogleAccounts } = await supabase
        .from('google_drive_accounts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('status', ['connected', 'pending'])

      const isNewAccount = !existingByEmail
      if (isNewAccount && (activeGoogleAccounts || 0) >= googleAccountsLimit) {
        return new Response(JSON.stringify({
          error: `Limite do plano atingido: seu plano permite até ${googleAccountsLimit} conta(s) Google Drive.`,
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (accountId) {
        await supabase
          .from('google_drive_accounts')
          .update({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token || connection?.google_refresh_token,
            token_expires_at: expiresAt,
            account_email: accountEmail,
            status: 'connected',
            connected_at: new Date().toISOString(),
          })
          .eq('id', accountId)
          .eq('user_id', userId)
      } else if (existingByEmail?.id) {
        await supabase
          .from('google_drive_accounts')
          .update({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token || connection?.google_refresh_token,
            token_expires_at: expiresAt,
            status: 'connected',
            connected_at: new Date().toISOString(),
          })
          .eq('id', existingByEmail.id)
      } else {
        await supabase
          .from('google_drive_accounts')
          .insert({
            user_id: userId,
            label: accountLabel || (accountEmail ? `Drive ${accountEmail}` : 'Drive Principal'),
            account_email: accountEmail,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token || connection?.google_refresh_token,
            token_expires_at: expiresAt,
            status: 'connected',
            connected_at: new Date().toISOString(),
          })
      }

      await supabase
        .from('connections')
        .update({
          google_access_token: tokens.access_token,
          google_refresh_token: tokens.refresh_token || connection?.google_refresh_token,
          google_token_expires_at: expiresAt,
          google_status: 'connected',
          google_connected_at: new Date().toISOString(),
          google_redirect_uri: redirectUri || configuredRedirectUri,
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
      let refreshToken = connection?.google_refresh_token || null
      let updateTarget: { type: 'legacy' | 'multi'; id?: string } = { type: 'legacy' }

      if (accountId) {
        const { data: selectedAccount } = await supabase
          .from('google_drive_accounts')
          .select('id, refresh_token')
          .eq('id', accountId)
          .eq('user_id', userId)
          .maybeSingle()
        if (selectedAccount?.refresh_token) {
          refreshToken = selectedAccount.refresh_token
          updateTarget = { type: 'multi', id: selectedAccount.id }
        }
      } else {
        const { data: firstAccount } = await supabase
          .from('google_drive_accounts')
          .select('id, refresh_token')
          .eq('user_id', userId)
          .eq('status', 'connected')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()
        if (firstAccount?.refresh_token) {
          refreshToken = firstAccount.refresh_token
          updateTarget = { type: 'multi', id: firstAccount.id }
        }
      }

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

      if (updateTarget.type === 'multi' && updateTarget.id) {
        await supabase
          .from('google_drive_accounts')
          .update({
            access_token: tokens.access_token,
            token_expires_at: expiresAt,
            status: 'connected',
          })
          .eq('id', updateTarget.id)
      }

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
