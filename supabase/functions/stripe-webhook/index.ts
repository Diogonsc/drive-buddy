// SwiftWapDrive — Webhooks Stripe (assinatura / checkout)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

const PRICE_TO_PLAN: Record<
  string,
  {
    plan: string
    plan_name: string
    plan_price: number
    monthly_file_limit: number | null
  }
> = {
  price_1TSQUV0sgLseC26AakPcHCSo: {
    plan: 'starter',
    plan_name: 'Starter',
    plan_price: 9700,
    monthly_file_limit: 500,
  },
  price_1TSQVY0sgLseC26ANk1YOutv: {
    plan: 'professional',
    plan_name: 'Profissional',
    plan_price: 19700,
    monthly_file_limit: 2000,
  },
  price_1TSQWQ0sgLseC26AFTt3xkRc: {
    plan: 'scale',
    plan_name: 'Scale',
    plan_price: 39700,
    monthly_file_limit: null,
  },
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
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!stripeSecret || !webhookSecret || !supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const stripe = new Stripe(stripeSecret, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
  })

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return new Response(JSON.stringify({ error: 'Missing stripe-signature' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const body = await req.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid signature'
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const supabaseUserId = session.metadata?.supabase_user_id

    if (!supabaseUserId) {
      console.error('checkout.session.completed: missing supabase_user_id in metadata')
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 5 })
    const rawPrice = lineItems.data[0]?.price
    const priceId = typeof rawPrice === 'string' ? rawPrice : rawPrice?.id

    if (!priceId) {
      console.error('checkout.session.completed: could not resolve price id', session.id)
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const planData = PRICE_TO_PLAN[priceId]
    if (!planData) {
      console.error('checkout.session.completed: unknown price', priceId)
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: upsertError } = await supabase.from('subscriptions').upsert(
      {
        user_id: supabaseUserId,
        plan: planData.plan,
        plan_name: planData.plan_name,
        plan_price: planData.plan_price,
        monthly_file_limit: planData.monthly_file_limit,
        files_used_current_month: 0,
        overage_enabled: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )

    if (upsertError) {
      console.error('subscriptions upsert error', upsertError)
      return new Response(JSON.stringify({ error: 'Upsert failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Demais eventos: acknowledge (handlers adicionais podem ser encadeados aqui)
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
