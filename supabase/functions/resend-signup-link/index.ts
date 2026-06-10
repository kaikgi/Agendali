import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const APP_URL = Deno.env.get('APP_URL') || 'https://agendali.online'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { email } = await req.json()

    if (!email || typeof email !== 'string') {
      return new Response(
        JSON.stringify({ success: false, message: 'Email é obrigatório.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return new Response(
        JSON.stringify({ success: false, message: 'Email inválido.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Check if email has an approved payment (allowed_establishment_signups)
    const { data: allowedSignup, error: allowedError } = await supabase
      .from('allowed_establishment_signups')
      .select('email, plan_id, used, kiwify_order_id')
      .eq('email', normalizedEmail)
      .limit(1)
      .maybeSingle()

    if (allowedError) {
      console.error('[RESEND-LINK] Error checking allowed signups:', allowedError)
    }

    // Generic safe message to prevent email enumeration
    const safeMessage = 'Se o seu pagamento estiver confirmado e a conta ainda não tiver sido criada, enviaremos um novo link para o seu email.'

    if (!allowedSignup) {
      console.log(`[RESEND-LINK] Email not found in allowed signups: ${normalizedEmail}`)
      return new Response(
        JSON.stringify({ success: true, message: safeMessage }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 2. Check if signup was already used (account already created)
    if (allowedSignup.used) {
      console.log(`[RESEND-LINK] Signup already used for: ${normalizedEmail}`)
      return new Response(
        JSON.stringify({ success: true, message: safeMessage }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 3. Check if auth user already exists for this email
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const userExists = existingUsers?.users?.some(
      (u) => u.email?.toLowerCase() === normalizedEmail,
    )

    if (userExists) {
      console.log(`[RESEND-LINK] User already exists for: ${normalizedEmail}`)
      return new Response(
        JSON.stringify({ success: true, message: safeMessage }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 4. Invalidate existing active signup_tokens for this email
    const { error: invalidateError } = await supabase
      .from('signup_tokens')
      .update({ status: 'cancelled' })
      .eq('email', normalizedEmail)
      .eq('status', 'pending')

    if (invalidateError) {
      console.error('[RESEND-LINK] Error invalidating old tokens:', invalidateError)
    }

    // 5. Generate new signup_token
    const rawToken = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const { error: tokenError } = await supabase.from('signup_tokens').insert({
      email: normalizedEmail,
      token: rawToken,
      plan_id: allowedSignup.plan_id,
      order_id: allowedSignup.kiwify_order_id,
      status: 'pending',
      expires_at: expiresAt,
    })

    if (tokenError) {
      console.error('[RESEND-LINK] Error creating new token:', tokenError)
      return new Response(
        JSON.stringify({ success: false, message: 'Erro interno ao gerar link. Tente novamente.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 7. Send email via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      console.error('[RESEND-LINK] RESEND_API_KEY not configured')
      return new Response(
        JSON.stringify({ success: false, message: 'Erro de configuração do servidor.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const resendFrom = Deno.env.get('RESEND_FROM') || 'noreply@agendali.online'
    const signupLink = `${APP_URL}/criar-conta?token=${rawToken}`

    const planNames: Record<string, string> = {
      solo: 'Solo',
      studio: 'Studio',
      pro: 'Pro',
    }
    const planDisplayName = planNames[allowedSignup.plan_id] || allowedSignup.plan_id

    const emailHtml = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;">
    <tr><td align="center" style="padding:40px 20px 0;">
      <table width="100%" style="max-width:560px;">
        <!-- Header -->
        <tr><td style="text-align:center;padding-bottom:32px;">
          <img src="https://www.agendali.online/logo-512.png" alt="Agendali" width="48" height="48" style="display:inline-block;border-radius:10px;" />
          <p style="margin:12px 0 0;font-size:20px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;"><span style="color:#000000;">Agenda</span><span style="color:#9CA3AF;">li</span></p>
        </td></tr>

        <!-- Badge -->
        <tr><td align="center" style="padding-bottom:24px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background-color:#eff6ff;border:1px solid #2563eb22;border-radius:100px;padding:8px 20px;">
              <span style="font-size:14px;font-weight:600;color:#2563eb;">🔗 Novo Link de Cadastro</span>
            </td>
          </tr></table>
        </td></tr>

        <!-- Body -->
        <tr><td>
          <p style="margin:0 0 12px;font-size:16px;line-height:1.6;color:#374151;">Você solicitou um novo link para criar sua conta no Agendali.</p>
          <p style="margin:0 0 12px;font-size:16px;line-height:1.6;color:#374151;">Seu plano <strong style="color:#111827;">${planDisplayName}</strong> está ativo.</p>
          <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#374151;">Clique no botão abaixo para criar sua conta:</p>
        </td></tr>

        <!-- CTA -->
        <tr><td align="center" style="padding-bottom:8px;">
          <a href="${signupLink}" style="display:inline-block;padding:14px 32px;background-color:#111827;color:#ffffff;text-decoration:none;border-radius:8px;font-size:16px;font-weight:600;">Criar minha conta</a>
        </td></tr>
        <tr><td align="center" style="padding-bottom:24px;">
          <p style="margin:8px 0 0;font-size:12px;color:#9ca3af;word-break:break-all;">Ou copie e cole: <a href="${signupLink}" style="color:#6b7280;text-decoration:underline;">${signupLink}</a></p>
        </td></tr>

        <!-- Note -->
        <tr><td style="padding-bottom:24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
            <tr><td style="padding:14px 18px;font-size:14px;color:#6b7280;line-height:1.5;">
              ⏳ Este link é válido por <strong>24 horas</strong> e pode ser usado apenas uma vez.
            </td></tr>
          </table>
        </td></tr>

        <!-- Divider + footer -->
        <tr><td style="padding-top:24px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;text-align:center;font-size:12px;color:#9ca3af;line-height:1.6;">Se você não solicitou este email, pode ignorá-lo.</p>
          <p style="margin:8px 0 0;text-align:center;font-size:12px;"><a href="https://www.agendali.online" style="color:#9ca3af;text-decoration:underline;">agendali.online</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: resendFrom,
        to: [normalizedEmail],
        subject: 'Novo link de cadastro - Agendali',
        html: emailHtml,
      }),
    })

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text()
      console.error(`[RESEND-LINK] Resend API error [${resendResponse.status}]: ${errorText}`)
      return new Response(
        JSON.stringify({ success: false, message: 'Erro ao enviar email. Tente novamente.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    console.log(`[RESEND-LINK] ✅ New signup link sent to ${normalizedEmail}`)

    return new Response(
      JSON.stringify({ success: true, message: safeMessage }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[RESEND-LINK] Unexpected error:', err)
    return new Response(
      JSON.stringify({ success: false, message: 'Erro interno. Tente novamente.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
