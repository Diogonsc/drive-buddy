// SwiftWapDrive — Admin: consultar assinatura no Stripe (somente role admin)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface Body {
  stripeSubscriptionId?: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')
  if (!stripeSecret) {
    return new Response(JSON.stringify({ error: 'STRIPE_SECRET_KEY not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
    error: userError,
  } = await supabaseAuth.auth.getUser()

  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: adminRole, error: roleError } = await supabaseAuth
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle()

  if (roleError || !adminRole) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let parsed: Body
  try {
    parsed = (await req.json()) as Body
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const stripeSubscriptionId = parsed.stripeSubscriptionId?.trim()
  if (!stripeSubscriptionId || !stripeSubscriptionId.startsWith('sub_')) {
    return new Response(JSON.stringify({ error: 'Invalid stripeSubscriptionId' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const stripe = new Stripe(stripeSecret, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
  })

  try {
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId)

    const dpm = subscription.default_payment_method
    let defaultPaymentMethod: string | null = null
    if (typeof dpm === 'string') defaultPaymentMethod = dpm
    else if (dpm && typeof dpm === 'object' && 'id' in dpm) {
      defaultPaymentMethod = (dpm as { id: string }).id
    }

    return new Response(
      JSON.stringify({
        status: subscription.status,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
        default_payment_method: defaultPaymentMethod,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Stripe error'
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
