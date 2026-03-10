import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContactRequest {
  name: string;
  email: string;
  message: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { name, email, message }: ContactRequest = await req.json();

    // Validate input
    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({ error: "Nome, email e mensagem são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Email inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save to database
    const { data: contactMessage, error: dbError } = await supabase
      .from("contact_messages")
      .insert({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        message: message.trim(),
        status: "new",
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      return new Response(
        JSON.stringify({ error: "Erro ao salvar mensagem" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Contact message saved:", contactMessage.id);

    // Send notification email to admin
    let emailSent = false;
    if (resendApiKey) {
      try {
        const adminEmailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `Agendali <${Deno.env.get("RESEND_FROM") || "noreply@agendali.online"}>`,
            to: ["contato@agendali.online"],
            subject: `[Agendali] Nova mensagem de contato: ${name}`,
            html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px 0;">
<table width="100%" style="max-width:560px;">
  <tr><td style="text-align:center;padding-bottom:32px;">
    <img src="https://www.agendali.online/logo-512.png" alt="Agendali" width="48" height="48" style="display:inline-block;border-radius:10px;" />
    <p style="margin:12px 0 0;font-size:20px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;"><span style="color:#000000;">Agenda</span><span style="color:#9CA3AF;">li</span></p>
  </td></tr>
  <tr><td align="center" style="padding-bottom:24px;">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="background-color:#eff6ff;border:1px solid #2563eb22;border-radius:100px;padding:8px 20px;">
        <span style="font-size:14px;font-weight:600;color:#2563eb;">📩 Nova Mensagem de Contato</span>
      </td>
    </tr></table>
  </td></tr>
  <tr><td>
    <table width="100%" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;">
      <tr><td style="padding:24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:6px 0;font-size:14px;color:#6b7280;width:80px;">👤 Nome</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#111827;">${name}</td></tr>
          <tr><td style="padding:6px 0;font-size:14px;color:#6b7280;">📧 Email</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#111827;">${email}</td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:16px 0;">
    <table width="100%" style="border:1px solid #e5e7eb;border-radius:8px;">
      <tr><td style="padding:20px;">
        <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;">Mensagem</p>
        <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${message.replace(/\n/g, "<br>")}</p>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding-top:16px;border-top:1px solid #e5e7eb;">
    <p style="margin:0;text-align:center;font-size:12px;color:#9ca3af;">Recebido em: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
  </td></tr>
</table>
</td></tr></table></body></html>`,
          }),
        });

        if (adminEmailResponse.ok) {
          console.log("Admin notification email sent");
          emailSent = true;
        } else {
          const errorData = await adminEmailResponse.text();
          console.error("Failed to send admin email:", errorData);
        }
      } catch (emailError) {
        console.error("Email sending error:", emailError);
      }

      // Send auto-reply to user
      try {
        const userEmailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `Agendali <${Deno.env.get("RESEND_FROM") || "noreply@agendali.online"}>`,
            to: [email],
            subject: "Recebemos sua mensagem - Agendali",
            html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px;">
<table width="100%" style="max-width:560px;">
  <tr><td style="text-align:center;padding-bottom:24px;">
    <img src="https://www.agendali.online/logo-512.png" alt="Agendali" width="40" height="40" style="border-radius:8px;" />
    <p style="margin:10px 0 0;font-size:20px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;"><span style="color:#000000;">Agenda</span><span style="color:#9CA3AF;">li</span></p>
  </td></tr>
  <tr><td>
    <p style="margin:0 0 8px;font-size:16px;color:#374151;">Olá, <strong style="color:#111827;">${name}</strong>!</p>
    <p style="margin:0 0 8px;font-size:16px;line-height:1.6;color:#374151;">Recebemos sua mensagem e agradecemos por entrar em contato.</p>
    <p style="margin:0;font-size:16px;line-height:1.6;color:#374151;">Nossa equipe analisará sua solicitação e responderá em até <strong>24 horas úteis</strong>.</p>
  </td></tr>
  <tr><td style="padding:24px 0;">
    <table width="100%" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;">Sua mensagem</p>
        <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${message.replace(/\n/g, "<br>")}</p>
      </td></tr>
    </table>
  </td></tr>
  <tr><td>
    <p style="margin:0;font-size:14px;color:#374151;">Atenciosamente,<br/><strong>Equipe Agendali</strong></p>
  </td></tr>
  <tr><td style="padding-top:24px;border-top:1px solid #e5e7eb;margin-top:24px;">
    <p style="margin:24px 0 0;text-align:center;font-size:12px;color:#9ca3af;">Este é um email automático. Por favor, não responda diretamente.</p>
    <p style="margin:4px 0 0;text-align:center;font-size:12px;"><a href="https://www.agendali.online" style="color:#9ca3af;text-decoration:underline;">agendali.online</a></p>
  </td></tr>
</table>
</td></tr></table></body></html>`,
          }),
        });

        if (userEmailResponse.ok) {
          console.log("Auto-reply email sent to user");
        } else {
          const errorData = await userEmailResponse.text();
          console.error("Failed to send auto-reply:", errorData);
        }
      } catch (emailError) {
        console.error("Auto-reply email error:", emailError);
      }
    } else {
      console.log("RESEND_API_KEY not configured, skipping email notifications");
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Mensagem enviada com sucesso",
        emailSent,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing contact:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
