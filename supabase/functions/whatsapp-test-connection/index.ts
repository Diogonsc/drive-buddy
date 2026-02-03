// =====================================================
// SwiftwapdriveSync - Test WhatsApp API Connection
// =====================================================
// Valida Phone Number ID + Access Token junto à Meta Graph API.
// GET https://graph.facebook.com/v18.0/{phone_number_id}
// Ref: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/phone-numbers

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
    const { phoneNumberId, accessToken } = (await req.json()) as {
      phoneNumberId?: string
      accessToken?: string
    }

    if (!phoneNumberId?.trim() || !accessToken?.trim()) {
      return new Response(
        JSON.stringify({ error: 'phoneNumberId e accessToken são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const url = `https://graph.facebook.com/v18.0/${phoneNumberId.trim()}`
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
      },
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      const message =
        data?.error?.message || data?.error?.error_user_msg || res.statusText || 'Erro ao validar credenciais'
      return new Response(
        JSON.stringify({ success: false, error: message }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        display_phone_number: data.display_phone_number,
        verified_name: data.verified_name,
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
