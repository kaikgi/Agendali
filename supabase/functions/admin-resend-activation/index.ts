import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const APP_URL = 'https://www.agendali.online'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Validate admin auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')

    // Verify caller is admin using their token
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: claimsData, error: claimsError } = await userClient.auth.getUser()
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check admin status
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { data: adminCheck } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', claimsData.user.id)
      .single()

    if (!adminCheck) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { email } = await req.json()
    if (!email) {
      return new Response(JSON.stringify({ error: 'Email required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Check email is in allowed signups
    const { data: signup } = await supabase
      .from('allowed_establishment_signups')
      .select('email, plan_id')
      .eq('email', normalizedEmail)
      .single()

    if (!signup) {
      return new Response(JSON.stringify({ ok: false, error: 'Email não encontrado na lista de autorizados' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create user if not exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const userExists = existingUsers?.users?.some(
      (u: { email?: string }) => u.email?.toLowerCase().trim() === normalizedEmail
    )

    if (!userExists) {
      const tempPassword = crypto.randomUUID() + 'A1!'
      await supabase.auth.admin.createUser({
        email: normalizedEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { activation_pending: true },
      })
    }

    // Generate recovery link
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: normalizedEmail,
      options: { redirectTo: `${APP_URL}/auth/activate` },
    })

    if (linkError || !linkData?.properties?.action_link) {
      console.error('Error generating link:', linkError)
      return new Response(JSON.stringify({ ok: false, error: 'Erro ao gerar link' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const actionLink = linkData.properties.action_link

    // Send via Resend
    if (!resendApiKey) {
      return new Response(JSON.stringify({ ok: false, error: 'RESEND_API_KEY não configurada' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const planNames: Record<string, string> = {
      solo: 'Solo',
      studio: 'Studio',
      pro: 'Pro',
    }

    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="100%" style="max-width:560px;">
        <tr><td style="text-align:center;padding-bottom:32px;"><img src="https://www.agendali.online/logo-512.png" alt="Agendali" width="48" height="48" style="display:inline-block;border-radius:10px;" /><p style="margin:12px 0 0;font-size:20px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;"><span style="color:#000000;">Agenda</span><span style="color:#9CA3AF;">li</span></p></td></tr>
        <tr><td style="background-color:#f9fafb;border-radius:12px;padding:32px;">
          <h2 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#111827;">🎉 Ative sua conta do Agendali</h2>
          <p style="margin:0 0 12px;font-size:16px;line-height:1.6;color:#374151;">Seu plano <strong>${planNames[signup.plan_id] || signup.plan_id}</strong> está ativo.</p>
          <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#374151;">Clique abaixo para criar sua senha e acessar o painel:</p>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
            <a href="${actionLink}" style="display:inline-block;padding:14px 32px;background-color:#111827;color:#ffffff;text-decoration:none;border-radius:8px;font-size:16px;font-weight:600;">Criar senha e acessar</a>
          </td></tr></table>
          <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">⏳ Este link expira em 1 hora.</p>
        </td></tr>
        <tr><td style="text-align:center;padding-top:24px;"><p style="margin:0;font-size:12px;color:#9ca3af;">${APP_URL}</p></td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Agendali <${Deno.env.get("RESEND_FROM") || "noreply@agendali.online"}>`,
        to: [normalizedEmail],
        subject: 'Ative sua conta do Agendali — Crie sua senha',
        html: emailHtml,
      }),
    })

    if (!resendResponse.ok) {
      const err = await resendResponse.text()
      console.error('Resend error:', err)
      return new Response(JSON.stringify({ ok: false, error: 'Erro ao enviar email' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Update activation_sent_at
    await supabase
      .from('allowed_establishment_signups')
      .update({ activation_sent_at: new Date().toISOString() })
      .eq('email', normalizedEmail)

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
