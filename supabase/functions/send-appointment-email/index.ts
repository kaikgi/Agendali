import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "noreply@agendali.online";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple Resend API call function
async function sendEmail(to: string, subject: string, html: string, from: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${error}`);
  }
  
  return response.json();
}

interface EmailRequest {
  type: "confirmation" | "reminder" | "cancellation" | "reschedule";
  appointmentId: string;
}

interface AppointmentData {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  customer_notes: string | null;
  customer: {
    name: string;
    email: string | null;
    phone: string;
  };
  professional: {
    name: string;
  };
  service: {
    name: string;
    duration_minutes: number;
  };
  establishment: {
    name: string;
    phone: string | null;
    address: string | null;
    slug: string;
  };
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getEmailSubject(type: EmailRequest['type'], establishmentName: string): string {
  switch (type) {
    case 'confirmation':
      return `✅ Agendamento confirmado - ${establishmentName}`;
    case 'reminder':
      return `⏰ Lembrete de agendamento - ${establishmentName}`;
    case 'cancellation':
      return `❌ Agendamento cancelado - ${establishmentName}`;
    case 'reschedule':
      return `🔄 Agendamento reagendado - ${establishmentName}`;
    default:
      return `Atualização de agendamento - ${establishmentName}`;
  }
}

function getStatusColor(type: EmailRequest['type']): { accent: string; bg: string } {
  switch (type) {
    case 'confirmation': return { accent: '#16a34a', bg: '#f0fdf4' };
    case 'reminder': return { accent: '#d97706', bg: '#fffbeb' };
    case 'cancellation': return { accent: '#dc2626', bg: '#fef2f2' };
    case 'reschedule': return { accent: '#2563eb', bg: '#eff6ff' };
    default: return { accent: '#111827', bg: '#f9fafb' };
  }
}

function getStatusIcon(type: EmailRequest['type']): string {
  switch (type) {
    case 'confirmation': return '✅';
    case 'reminder': return '⏰';
    case 'cancellation': return '❌';
    case 'reschedule': return '🔄';
    default: return '📋';
  }
}

function getStatusTitle(type: EmailRequest['type']): string {
  switch (type) {
    case 'confirmation': return 'Agendamento Confirmado';
    case 'reminder': return 'Lembrete de Agendamento';
    case 'cancellation': return 'Agendamento Cancelado';
    case 'reschedule': return 'Agendamento Reagendado';
    default: return 'Atualização de Agendamento';
  }
}

function getStatusMessage(type: EmailRequest['type'], establishmentName: string): string {
  switch (type) {
    case 'confirmation': return `Seu agendamento em <strong>${establishmentName}</strong> foi confirmado com sucesso.`;
    case 'reminder': return `Este é um lembrete do seu próximo agendamento em <strong>${establishmentName}</strong>.`;
    case 'cancellation': return `Seu agendamento em <strong>${establishmentName}</strong> foi cancelado.`;
    case 'reschedule': return `Seu agendamento em <strong>${establishmentName}</strong> foi reagendado para uma nova data.`;
    default: return `Houve uma atualização no seu agendamento em <strong>${establishmentName}</strong>.`;
  }
}

function getEmailHtml(type: EmailRequest['type'], data: AppointmentData): string {
  const { customer, professional, service, establishment, start_at } = data;
  const baseUrl = `https://www.agendali.online/${establishment.slug}`;
  const logoUrl = 'https://www.agendali.online/logo-192.png';
  const { accent, bg } = getStatusColor(type);
  const icon = getStatusIcon(type);
  const title = getStatusTitle(type);
  const message = getStatusMessage(type, establishment.name);

  const showCTA = type === 'cancellation';
  const showWarning = type === 'reminder';
  const showFooterNote = type === 'confirmation' || type === 'reschedule';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;">
    <tr><td align="center" style="padding:40px 20px 0;">
      <table width="100%" style="max-width:560px;">
        <!-- Header -->
        <tr><td style="text-align:center;padding-bottom:32px;">
          <img src="${logoUrl}" alt="Agendali" width="48" height="48" style="display:inline-block;border-radius:10px;" />
          <p style="margin:12px 0 0;font-size:13px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:#9ca3af;">AGENDALI</p>
        </td></tr>

        <!-- Status badge -->
        <tr><td align="center" style="padding-bottom:24px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background-color:${bg};border:1px solid ${accent}22;border-radius:100px;padding:8px 20px;">
              <span style="font-size:14px;font-weight:600;color:${accent};">${icon} ${title}</span>
            </td>
          </tr></table>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding-bottom:8px;">
          <p style="margin:0 0 6px;font-size:16px;color:#374151;">Olá, <strong style="color:#111827;">${customer.name}</strong>!</p>
          <p style="margin:0;font-size:16px;line-height:1.6;color:#374151;">${message}</p>
        </td></tr>

        <!-- Details card -->
        <tr><td style="padding:24px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;">
            <tr><td style="padding:24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:6px 0;font-size:14px;color:#6b7280;width:120px;">📅 Data</td>
                  <td style="padding:6px 0;font-size:14px;font-weight:600;color:#111827;">${formatDate(start_at)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:14px;color:#6b7280;">🕐 Horário</td>
                  <td style="padding:6px 0;font-size:14px;font-weight:600;color:#111827;">${formatTime(start_at)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:14px;color:#6b7280;">💇 Serviço</td>
                  <td style="padding:6px 0;font-size:14px;font-weight:600;color:#111827;">${service.name} <span style="font-weight:400;color:#6b7280;">(${service.duration_minutes} min)</span></td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:14px;color:#6b7280;">👤 Profissional</td>
                  <td style="padding:6px 0;font-size:14px;font-weight:600;color:#111827;">${professional.name}</td>
                </tr>
                ${establishment.address ? `<tr>
                  <td style="padding:6px 0;font-size:14px;color:#6b7280;">📍 Local</td>
                  <td style="padding:6px 0;font-size:14px;color:#111827;">${establishment.address}</td>
                </tr>` : ''}
                ${establishment.phone ? `<tr>
                  <td style="padding:6px 0;font-size:14px;color:#6b7280;">📞 Telefone</td>
                  <td style="padding:6px 0;font-size:14px;color:#111827;">${establishment.phone}</td>
                </tr>` : ''}
              </table>
            </td></tr>
          </table>
        </td></tr>

        ${showWarning ? `
        <!-- Warning -->
        <tr><td style="padding-bottom:24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fffbeb;border:1px solid #fde68a;border-radius:8px;">
            <tr><td style="padding:14px 18px;font-size:14px;color:#92400e;line-height:1.5;">
              <strong>⚠️ Importante:</strong> Caso não possa comparecer, por favor avise com antecedência.
            </td></tr>
          </table>
        </td></tr>` : ''}

        ${showCTA ? `
        <!-- CTA -->
        <tr><td align="center" style="padding-bottom:24px;">
          <a href="${baseUrl}" style="display:inline-block;padding:14px 32px;background-color:#111827;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">
            Agendar novo horário
          </a>
        </td></tr>` : ''}

        ${showFooterNote ? `
        <tr><td style="padding-bottom:16px;">
          <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.5;">Caso precise reagendar ou cancelar, acesse sua área de agendamentos.</p>
        </td></tr>` : ''}

        <!-- Divider + footer -->
        <tr><td style="padding-top:24px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;text-align:center;font-size:12px;color:#9ca3af;line-height:1.6;">
            Enviado por ${establishment.name} através do 
            <a href="https://www.agendali.online" style="color:#9ca3af;text-decoration:underline;">Agendali</a>
          </p>
          <p style="margin:8px 0 0;text-align:center;">
            <a href="${baseUrl}" style="font-size:12px;color:#6b7280;text-decoration:underline;">Agendar outro horário</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { type, appointmentId }: EmailRequest = await req.json();

    if (!type || !appointmentId) {
      return new Response(
        JSON.stringify({ error: "Missing type or appointmentId" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch appointment with related data
    const { data: appointment, error: fetchError } = await supabase
      .from("appointments")
      .select(`
        id,
        start_at,
        end_at,
        status,
        customer_notes,
        customer:customers(name, email, phone),
        professional:professionals(name),
        service:services(name, duration_minutes),
        establishment:establishments(name, phone, address, slug)
      `)
      .eq("id", appointmentId)
      .single();

    if (fetchError || !appointment) {
      console.error("Error fetching appointment:", fetchError);
      return new Response(
        JSON.stringify({ error: "Appointment not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Transform to expected format
    const appointmentData: AppointmentData = {
      id: appointment.id,
      start_at: appointment.start_at,
      end_at: appointment.end_at,
      status: appointment.status,
      customer_notes: appointment.customer_notes,
      customer: appointment.customer as unknown as AppointmentData['customer'],
      professional: appointment.professional as unknown as AppointmentData['professional'],
      service: appointment.service as unknown as AppointmentData['service'],
      establishment: appointment.establishment as unknown as AppointmentData['establishment'],
    };

    // Check if customer has email
    if (!appointmentData.customer?.email) {
      console.log("Customer has no email, skipping notification");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "No customer email" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Send email - sanitize establishment name to prevent Resend API rejection
    const sanitizedName = appointmentData.establishment.name
      .replace(/[<>()[\]\\,;:"/!@#$%^&*{}|`~]/g, '')
      .trim()
      .substring(0, 60) || 'Agendali';
    const fromAddress = `${sanitizedName} <${RESEND_FROM}>`;
    const emailResponse = await sendEmail(
      appointmentData.customer.email,
      getEmailSubject(type, appointmentData.establishment.name),
      getEmailHtml(type, appointmentData),
      fromAddress
    );

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, emailId: emailResponse.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    console.error("Error in send-appointment-email:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
