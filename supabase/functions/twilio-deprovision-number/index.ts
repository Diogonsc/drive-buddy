// supabase/functions/twilio-deprovision-number/index.ts
// Swiftwapdrive - Remove número e subaccount Twilio do cliente

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401 })

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user) return new Response(JSON.stringify({ error: 'Sessão inválida' }), { status: 401 })

    const { connectionId } = await req.json() as { connectionId?: string }
    if (!connectionId) return new Response(JSON.stringify({ error: 'connectionId obrigatório' }), { status: 400 })

    const { data: conn } = await supabase
      .from('whatsapp_connections')
      .select('twilio_subaccount_sid, twilio_subaccount_auth_token, twilio_number_sid, user_id')
      .eq('id', connectionId)
      .maybeSingle()

    if (!conn || conn.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Conexão não encontrada' }), { status: 404 })
    }

    const mainSid = Deno.env.get('TWILIO_ACCOUNT_SID')!
    const mainToken = Deno.env.get('TWILIO_AUTH_TOKEN')!
    const credentials = btoa(`${mainSid}:${mainToken}`)

    // Suspender subaccount (não deleta — Twilio deleta após 30 dias)
    if (conn.twilio_subaccount_sid) {
      await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${conn.twilio_subaccount_sid}.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ Status: 'suspended' }).toString(),
        },
      )
    }

    // Atualiza status no banco
    await supabase
      .from('whatsapp_connections')
      .update({ status: 'disconnected' })
      .eq('id', connectionId)

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[DEPROVISION] Erro:', err)
    return new Response(JSON.stringify({ success: false, error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
