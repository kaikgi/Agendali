import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  message_id: string;
  reply_text?: string;
  status: 'replied' | 'closed';
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    // Get the Authorization header to identify the caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a client with the user's token to verify they are admin
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get the current user
    const { data: { user: callerUser }, error: userError } = await userClient.auth.getUser();
    if (userError || !callerUser) {
      console.error('Error getting caller user:', userError);
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role client for privileged operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check if caller is admin
    const { data: isAdmin, error: adminError } = await adminClient.rpc('is_admin', {
      p_user_id: callerUser.id
    });

    if (adminError || !isAdmin) {
      console.error('Admin check failed:', adminError);
      return new Response(
        JSON.stringify({ error: 'Acesso negado. Apenas administradores podem executar esta ação.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { message_id, reply_text, status }: RequestBody = await req.json();
    
    if (!message_id || !status) {
      return new Response(
        JSON.stringify({ error: 'message_id e status são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[admin-reply-contact] Admin ${callerUser.email} updating message ${message_id} to ${status}`);

    // Get the message first
    const { data: message, error: msgError } = await adminClient
      .from('contact_messages')
      .select('*')
      .eq('id', message_id)
      .single();

    if (msgError || !message) {
      console.error('Error fetching message:', msgError);
      return new Response(
        JSON.stringify({ error: 'Mensagem não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update the message
    const updateData: Record<string, unknown> = {
      status,
      replied_by: callerUser.id,
    };

    if (reply_text) {
      updateData.admin_reply = reply_text;
      updateData.replied_at = new Date().toISOString();
    }

    const { error: updateError } = await adminClient
      .from('contact_messages')
      .update(updateData)
      .eq('id', message_id);

    if (updateError) {
      console.error('Error updating message:', updateError);
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar mensagem' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send email reply if we have a reply text and Resend API key
    if (reply_text && resendApiKey && status === 'replied') {
      try {
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `Agendali <${Deno.env.get("RESEND_FROM") || "contato@agendali.online"}>`,
            to: [message.email],
            subject: `Re: Sua mensagem para o Agendali`,
            html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px;">
<table width="100%" style="max-width:560px;">
  <tr><td style="text-align:center;padding-bottom:24px;">
    <img src="https://www.agendali.online/logo-512.png" alt="Agendali" width="40" height="40" style="border-radius:8px;" />
    <p style="margin:10px 0 0;font-size:20px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;"><span style="color:#000000;">Agenda</span><span style="color:#9CA3AF;">li</span></p>
  </td></tr>
  <tr><td>
    <p style="margin:0 0 16px;font-size:16px;color:#374151;">Olá, <strong style="color:#111827;">${message.name}</strong>!</p>
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#374151;">Recebemos sua mensagem e aqui está nossa resposta:</p>
  </td></tr>
  <tr><td style="padding-bottom:16px;">
    <table width="100%" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;">Sua mensagem</p>
        <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.5;font-style:italic;">${message.message}</p>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding-bottom:24px;">
    <table width="100%" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#16a34a;">Nossa resposta</p>
        <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${reply_text}</p>
      </td></tr>
    </table>
  </td></tr>
  <tr><td>
    <p style="margin:0;font-size:14px;color:#374151;">Atenciosamente,<br/><strong>Equipe Agendali</strong></p>
  </td></tr>
  <tr><td style="padding-top:24px;border-top:1px solid #e5e7eb;">
    <p style="margin:24px 0 0;text-align:center;font-size:12px;"><a href="https://www.agendali.online" style="color:#9ca3af;text-decoration:underline;">agendali.online</a></p>
  </td></tr>
</table>
</td></tr></table></body></html>`,
          }),
        });

        if (!emailResponse.ok) {
          console.error('Failed to send reply email:', await emailResponse.text());
        } else {
          console.log(`[admin-reply-contact] Email sent to ${message.email}`);
        }
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        // Don't fail the request if email fails
      }
    }

    console.log(`[admin-reply-contact] Successfully updated message ${message_id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: status === 'replied' ? 'Resposta enviada com sucesso' : 'Mensagem fechada',
        email_sent: !!reply_text && !!resendApiKey
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in admin-reply-contact:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
