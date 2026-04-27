// supabase/functions/whatsapp-test-connection/index.ts
// Valida AccountSid + AuthToken na API da Twilio

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const { accountSid, authToken, whatsappNumber } = (await req.json()) as {
      accountSid?: string
      authToken?: string
      whatsappNumber?: string
    }

    if (!accountSid?.trim() || !authToken?.trim()) {
      return new Response(
        JSON.stringify({ error: 'accountSid e authToken são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Testa credenciais chamando a Accounts API da Twilio
    const credentials = btoa(`${accountSid.trim()}:${authToken.trim()}`)
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid.trim()}.json`,
      {
        headers: { Authorization: `Basic ${credentials}` },
      },
    )

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      const message = data?.message || 'Credenciais inválidas. Verifique seu Account SID e Auth Token.'
      return new Response(
        JSON.stringify({ success: false, error: message }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        friendly_name: data.friendly_name,
        status: data.status,
        whatsapp_number: whatsappNumber || null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    console.error('whatsapp-test-connection error:', e)
    return new Response(
      JSON.stringify({ success: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
