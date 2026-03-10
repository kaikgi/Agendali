import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-kiwify-secret, x-kiwify-token',
}

const ACTIVATION_EVENTS = new Set([
  'order_approved',
  'order_paid',
  'subscription_renewed',
  'subscription_active',
])

const CANCELLATION_EVENTS = new Set([
  'order_refunded',
  'order_chargedback',
  'subscription_canceled',
])

const PAST_DUE_EVENTS = new Set([
  'subscription_past_due',
  'subscription_payment_failed',
])

const IGNORED_EVENTS = new Set([
  'pix_created',
  'boleto_created',
  'waiting_payment',
  'cart_abandoned',
  'checkout_started',
])

function normalizeEmail(email: string | undefined | null): string | null {
  if (!email) return null
  return email.toLowerCase().trim()
}

const APP_URL = 'https://www.agendali.online'

interface KiwifyWebhookPayload {
  order_id?: string
  order_ref?: string
  order_status?: string
  subscription_id?: string
  payment_method?: string
  created_at?: string
  updated_at?: string
  approved_date?: string
  refunded_at?: string
  store_id?: string
  product_type?: string
  sale_type?: string
  webhook_event_type?: string
  Customer?: {
    email?: string
    full_name?: string
    first_name?: string
    mobile?: string
    CPF?: string
    [key: string]: unknown
  }
  Product?: {
    product_id?: string
    product_name?: string
  }
  Subscription?: {
    id?: string
    status?: string
    start_date?: string
    next_payment?: string
    plan?: {
      id?: string
      name?: string
      frequency?: string
      qty_charges?: number
    }
    charges?: unknown
    customer_access?: {
      has_access?: boolean
      active_period?: boolean
      access_until?: string
    }
  }
  TrackingParameters?: {
    src?: string
    s1?: string
    s2?: string
    s3?: string
    [key: string]: unknown
  }
  Commissions?: unknown
  Discount?: unknown
  customer_email?: string
  customer_name?: string
  product_id?: string
  product_name?: string
}

serve(async (req) => {
  const url = new URL(req.url)
  const method = req.method

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (method === 'GET') {
    return new Response(
      JSON.stringify({ ok: true, version: '5.0.0', message: 'Kiwify webhook ready (product-filtered)' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Validate webhook secret
    const headerSecret = req.headers.get('x-kiwify-secret') || req.headers.get('x-kiwify-token')
    const queryToken = url.searchParams.get('token')
    const receivedToken = headerSecret || queryToken
    const expectedSecret = Deno.env.get('KIWIFY_WEBHOOK_SECRET')

    if (!expectedSecret) {
      console.error('[KIWIFY] KIWIFY_WEBHOOK_SECRET not configured')
      return new Response(
        JSON.stringify({ error: 'Server config error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!receivedToken || receivedToken !== expectedSecret) {
      console.error('[KIWIFY] Invalid webhook token')
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse payload
    let payload: KiwifyWebhookPayload
    try {
      payload = await req.json()
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const eventType = payload.webhook_event_type || 'unknown'
    const eventId = payload.order_id || payload.subscription_id || payload.Subscription?.id || crypto.randomUUID()
    const buyerEmail = normalizeEmail(payload.Customer?.email || payload.customer_email)
    const productId = payload.Product?.product_id || payload.product_id || null
    const productName = payload.Product?.product_name || payload.product_name || ''
    const subscriptionId = payload.subscription_id || payload.Subscription?.id

    console.log(`[KIWIFY] Event: ${eventType} | Order: ${eventId} | Email: ${buyerEmail} | Product: ${productName} | ProductID: ${productId}`)

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[KIWIFY] Missing Supabase credentials')
      return new Response(
        JSON.stringify({ error: 'Server config error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Idempotency: insert event
    const { data: insertedEvent, error: insertError } = await supabase
      .from('billing_webhook_events')
      .insert({
        provider: 'kiwify',
        event_id: eventId,
        event_type: eventType,
        payload: payload as unknown,
        kiwify_product_id: productId,
      })
      .select()
      .single()

    if (insertError) {
      if (insertError.code === '23505') {
        console.log(`[KIWIFY] Duplicate event ${eventId}, skipping`)
        return new Response(
          JSON.stringify({ ok: true, dedup: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      throw insertError
    }

    // ===== EVENT FILTER: ignore non-actionable events =====
    if (IGNORED_EVENTS.has(eventType)) {
      console.log(`[KIWIFY] Event ${eventType} is non-actionable (payment not confirmed), logging only`)
      await supabase
        .from('billing_webhook_events')
        .update({
          processed_at: new Date().toISOString(),
          ignored: true,
          ignore_reason: `NON_ACTIONABLE_EVENT: ${eventType}`,
        })
        .eq('id', insertedEvent.id)
      return new Response(
        JSON.stringify({ ok: true, ignored: true, reason: `NON_ACTIONABLE_EVENT: ${eventType}` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Look up product/plan mapping
    const productMatch = await findAgendaliProduct(supabase, productId, productName)
    const planCode = productMatch.plan_code
    console.log(`[KIWIFY] ✅ Product resolved: plan=${planCode} (product="${productName}", id=${productId})`)

    // Process event
    let processingError: string | null = null

    try {
      if (!buyerEmail) {
        throw new Error('No customer email found in payload')
      }
      await processKiwifyEvent(supabase, payload, eventType, buyerEmail, planCode, subscriptionId)
    } catch (err) {
      processingError = err instanceof Error ? err.message : String(err)
      console.error('[KIWIFY] Processing error:', processingError)
    }

    // Update event record
    await supabase
      .from('billing_webhook_events')
      .update({ processed_at: new Date().toISOString(), processing_error: processingError })
      .eq('id', insertedEvent.id)

    return new Response(
      JSON.stringify({ ok: true, processed: !processingError, error: processingError }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[KIWIFY] FATAL:', error instanceof Error ? error.stack : error)
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Find matching Agendali product/plan by product_id or product_name.
 * 
 * This webhook endpoint is Agendali-specific, so ALL products received here
 * are assumed to be Agendali products. We try to match a specific plan,
 * and default to 'solo' if no match is found.
 */
async function findAgendaliProduct(
  supabase: SupabaseClient,
  productId: string | null,
  productName: string,
): Promise<{ plan_code: string }> {
  // 1. Try exact match by kiwify_product_id
  if (productId) {
    const { data } = await supabase
      .from('kiwify_products')
      .select('plan_code')
      .eq('kiwify_product_id', productId)
      .eq('active', true)
      .limit(1)
      .single()
    if (data) {
      console.log(`[KIWIFY] Product matched by ID: ${productId} -> plan=${data.plan_code}`)
      return data
    }
  }

  // 2. Try matching by product_name against registered products
  if (productName) {
    const nameLower = productName.toLowerCase()
    const { data: allProducts } = await supabase
      .from('kiwify_products')
      .select('plan_code, product_name')
      .eq('active', true)

    if (allProducts) {
      for (const p of allProducts) {
        if (p.product_name && nameLower.includes(p.product_name.toLowerCase())) {
          console.log(`[KIWIFY] Product matched by name: "${productName}" -> plan=${p.plan_code}`)
          return { plan_code: p.plan_code }
        }
      }
    }

    // 3. Try detecting plan from keywords in product name
    if (nameLower.includes('pro') || nameLower.includes('profissional')) {
      console.log(`[KIWIFY] Product matched by keyword "pro" in name: "${productName}"`)
      return { plan_code: 'pro' }
    }
    if (nameLower.includes('studio')) {
      console.log(`[KIWIFY] Product matched by keyword "studio" in name: "${productName}"`)
      return { plan_code: 'studio' }
    }
  }

  // 4. Default: this webhook is Agendali-only, so default to 'solo'
  console.log(`[KIWIFY] No specific plan match for product "${productName}" (ID: ${productId}). Defaulting to 'solo'.`)
  return { plan_code: 'solo' }
}

async function processKiwifyEvent(
  supabase: SupabaseClient,
  payload: KiwifyWebhookPayload,
  eventType: string,
  buyerEmail: string,
  planCode: string,
  subscriptionId: string | undefined,
) {
  console.log(`[KIWIFY] Processing: plan=${planCode}, event=${eventType}`)

  let status: string
  if (ACTIVATION_EVENTS.has(eventType)) {
    status = 'active'
  } else if (PAST_DUE_EVENTS.has(eventType)) {
    status = 'past_due'
  } else if (CANCELLATION_EVENTS.has(eventType)) {
    status = 'canceled'
  } else {
    console.log(`[KIWIFY] ⚠️ Unknown event type "${eventType}", ignoring (will NOT authorize)`)
    return // Do NOT process unknown events as active
  }

  // Calculate period dates
  const now = new Date()
  let periodStart = now
  if (payload.approved_date) {
    const parsed = new Date(payload.approved_date.replace(' ', 'T'))
    if (!isNaN(parsed.getTime())) periodStart = parsed
  } else if (payload.Subscription?.start_date) {
    const parsed = new Date(payload.Subscription.start_date)
    if (!isNaN(parsed.getTime())) periodStart = parsed
  }

  let periodEnd = new Date(periodStart)
  if (payload.Subscription?.next_payment) {
    const parsed = new Date(payload.Subscription.next_payment)
    if (!isNaN(parsed.getTime())) periodEnd = parsed
    else periodEnd.setMonth(periodEnd.getMonth() + 1)
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1)
  }

  const orderId = payload.order_id || subscriptionId || crypto.randomUUID()

  // ===== ACTIVATION =====
  if (status === 'active') {
    const { data: existingSignup } = await supabase
      .from('allowed_establishment_signups')
      .select('email, activation_sent_at, used')
      .eq('email', buyerEmail)
      .single()

    const { error: signupError } = await supabase
      .from('allowed_establishment_signups')
      .upsert({
        email: buyerEmail,
        plan_id: planCode,
        kiwify_order_id: orderId,
        paid_at: periodStart.toISOString(),
        used: existingSignup?.used ?? false,
      }, {
        onConflict: 'email',
        ignoreDuplicates: false,
      })

    if (signupError && signupError.code !== '23505') {
      console.error('[KIWIFY] Error upserting allowed signup:', signupError)
    } else {
      console.log(`[KIWIFY] ✅ Email ${buyerEmail} authorized for plan ${planCode}`)
    }

    // Send activation email (only if not already sent)
    const alreadySent = existingSignup?.activation_sent_at != null
    if (!alreadySent) {
      await sendActivationEmail(supabase, buyerEmail, planCode)
    } else {
      console.log(`[KIWIFY] Activation email already sent for ${buyerEmail}, skipping`)
    }
  }

  // ===== CANCELLATION =====
  if (status === 'canceled') {
    const { error: revokeError } = await supabase
      .from('allowed_establishment_signups')
      .update({ used: true })
      .eq('email', buyerEmail)

    if (revokeError) {
      console.error('[KIWIFY] Error revoking signup:', revokeError)
    } else {
      console.log(`[KIWIFY] ❌ Email ${buyerEmail} revoked`)
    }
  }

  // ===== SUBSCRIPTION: upsert if user exists =====
  let userId: string | null = null

  const trackingUserId = payload.TrackingParameters?.s1
  if (trackingUserId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', trackingUserId)
      .single()
    if (profile) {
      userId = profile.id as string
      console.log(`[KIWIFY] User found via tracking: ${userId}`)
    }
  }

  if (!userId) {
    const { data: authUsers } = await supabase.auth.admin.listUsers()
    if (authUsers?.users) {
      const match = authUsers.users.find(
        (u: { email?: string }) => u.email?.toLowerCase().trim() === buyerEmail
      )
      if (match) {
        userId = match.id
        console.log(`[KIWIFY] User found via email: ${userId}`)
      }
    }
  }

  if (userId) {
    const { error: upsertError } = await supabase
      .from('subscriptions')
      .upsert({
        owner_user_id: userId,
        plan_code: planCode,
        status,
        provider: 'kiwify',
        provider_subscription_id: subscriptionId || null,
        provider_order_id: payload.order_id || null,
        buyer_email: buyerEmail,
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        raw_last_event: payload as unknown,
        updated_at: now.toISOString(),
      }, {
        onConflict: 'owner_user_id',
      })

    if (upsertError) {
      console.error('[KIWIFY] Error upserting subscription:', upsertError)
      throw upsertError
    }
    console.log(`[KIWIFY] Subscription ${status} for user ${userId}`)

    if (status === 'active') {
      // Mark signup as used
      await supabase
        .from('allowed_establishment_signups')
        .update({ used: true })
        .eq('email', buyerEmail)

      // Activate establishment
      const { error: estUpdateError } = await supabase
        .from('establishments')
        .update({ status: 'active' } as any)
        .eq('owner_user_id', userId)

      if (estUpdateError) {
        console.error('[KIWIFY] Error activating establishment:', estUpdateError)
      } else {
        console.log(`[KIWIFY] ✅ Establishment activated for user ${userId}`)
      }
    }

    // On cancellation, mark establishment as canceled
    if (status === 'canceled') {
      const { error: estRevertError } = await supabase
        .from('establishments')
        .update({ status: 'canceled' } as any)
        .eq('owner_user_id', userId)

      if (estRevertError) {
        console.error('[KIWIFY] Error canceling establishment:', estRevertError)
      } else {
        console.log(`[KIWIFY] ❌ Establishment canceled for user ${userId}`)
      }
    }
  } else {
    console.log(`[KIWIFY] No user found for ${buyerEmail}. Email authorized for future signup.`)
  }
}

/**
 * Create auth user (if needed) and send activation email via Resend
 */
async function sendActivationEmail(
  supabase: SupabaseClient,
  email: string,
  planCode: string,
) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')

  // Step 1: Create or find auth user
  let userExists = false
  const { data: existingUsers } = await supabase.auth.admin.listUsers()
  if (existingUsers?.users) {
    userExists = existingUsers.users.some(
      (u: { email?: string }) => u.email?.toLowerCase().trim() === email
    )
  }

  if (!userExists) {
    const tempPassword = crypto.randomUUID() + 'A1!'
    const { error: createError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { activation_pending: true },
    })
    if (createError) {
      console.error('[KIWIFY] Error creating auth user:', createError)
    } else {
      console.log(`[KIWIFY] Auth user created for ${email}`)
    }
  }

  // Step 2: Generate password reset link
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: {
      redirectTo: `${APP_URL}/auth/activate`,
    },
  })

  if (linkError || !linkData?.properties?.action_link) {
    console.error('[KIWIFY] Error generating activation link:', linkError)
    await supabase
      .from('allowed_establishment_signups')
      .update({ activation_sent_at: new Date().toISOString() })
      .eq('email', email)
    return
  }

  const actionLink = linkData.properties.action_link
  console.log(`[KIWIFY] Generated activation link for ${email}`)

  // Step 3: Send email via Resend
  if (!resendApiKey) {
    console.warn('[KIWIFY] RESEND_API_KEY not configured, skipping email send')
    await supabase
      .from('allowed_establishment_signups')
      .update({ activation_sent_at: new Date().toISOString() })
      .eq('email', email)
    return
  }

  const planNames: Record<string, string> = {
    solo: 'Solo',
    studio: 'Studio',
    pro: 'Pro',
  }
  const planDisplayName = planNames[planCode] || planCode

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="100%" style="max-width:560px;">
          <tr>
            <td style="text-align:center;padding-bottom:32px;">
              <h1 style="margin:0;font-size:28px;font-weight:700;color:#111827;">Agendali</h1>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f9fafb;border-radius:12px;padding:32px;">
              <h2 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#111827;">
                🎉 Sua assinatura foi confirmada!
              </h2>
              <p style="margin:0 0 12px;font-size:16px;line-height:1.6;color:#374151;">
                Parabéns! Seu plano <strong>${planDisplayName}</strong> do Agendali está ativo.
              </p>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#374151;">
                Clique no botão abaixo para criar sua senha e acessar o painel do seu estabelecimento:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${actionLink}" 
                       style="display:inline-block;padding:14px 32px;background-color:#111827;color:#ffffff;text-decoration:none;border-radius:8px;font-size:16px;font-weight:600;">
                      Criar senha e acessar painel
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">
                ⏳ Este link expira em 1 hora. Se expirar, acesse 
                <a href="${APP_URL}/esqueci-senha" style="color:#111827;">agendali.online</a> 
                e solicite um novo link.
              </p>
            </td>
          </tr>
          <tr>
            <td style="text-align:center;padding-top:24px;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Você recebeu este email porque adquiriu um plano no Agendali.
              </p>
              <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">
                ${APP_URL}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  try {
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Agendali <${Deno.env.get("RESEND_FROM") || "noreply@agendali.online"}>`,
        to: [email],
        subject: 'Ative sua conta do Agendali — Crie sua senha',
        html: emailHtml,
      }),
    })

    if (!resendResponse.ok) {
      const resendError = await resendResponse.text()
      console.error('[KIWIFY] Resend error:', resendError)
    } else {
      console.log(`[KIWIFY] ✅ Activation email sent to ${email}`)
    }
  } catch (err) {
    console.error('[KIWIFY] Error sending email via Resend:', err)
  }

  // Mark activation as sent
  await supabase
    .from('allowed_establishment_signups')
    .update({ activation_sent_at: new Date().toISOString() })
    .eq('email', email)
}
