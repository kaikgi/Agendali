import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "noreply@agendali.online";

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

function getReminderEmailHtml(appointment: {
  customer_name: string;
  customer_email: string;
  professional_name: string;
  service_name: string;
  service_duration: number;
  establishment_name: string;
  establishment_phone: string | null;
  establishment_address: string | null;
  establishment_slug: string;
  start_at: string;
  reminder_hours: number;
}): string {
  const baseUrl = `https://www.agendali.online/${appointment.establishment_slug}`;
  const logoUrl = 'https://www.agendali.online/logo-512.png';
  const hoursText = appointment.reminder_hours === 1 ? '1 hora' : `${appointment.reminder_hours} horas`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;">
    <tr><td align="center" style="padding:40px 20px 0;">
      <table width="100%" style="max-width:560px;">
        <tr><td style="text-align:center;padding-bottom:32px;">
          <img src="${logoUrl}" alt="Agendali" width="48" height="48" style="display:inline-block;border-radius:10px;" />
          <p style="margin:12px 0 0;font-size:20px;font-weight:700;"><span style="color:#000000;">Agenda</span><span style="color:#9CA3AF;">li</span></p>
        </td></tr>
        <tr><td align="center" style="padding-bottom:24px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background-color:#fffbeb;border:1px solid #fde68a;border-radius:100px;padding:8px 20px;">
              <span style="font-size:14px;font-weight:600;color:#d97706;">⏰ Lembrete de Agendamento</span>
            </td>
          </tr></table>
        </td></tr>
        <tr><td>
          <p style="margin:0 0 6px;font-size:16px;color:#374151;">Olá, <strong style="color:#111827;">${appointment.customer_name}</strong>!</p>
          <p style="margin:0;font-size:16px;line-height:1.6;color:#374151;">Seu agendamento em <strong>${appointment.establishment_name}</strong> é <strong>em ${hoursText}</strong>.</p>
        </td></tr>
        <tr><td style="padding:24px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;">
            <tr><td style="padding:24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="padding:6px 0;font-size:14px;color:#6b7280;width:120px;">📅 Data</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#111827;">${formatDate(appointment.start_at)}</td></tr>
                <tr><td style="padding:6px 0;font-size:14px;color:#6b7280;">🕐 Horário</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#111827;">${formatTime(appointment.start_at)}</td></tr>
                <tr><td style="padding:6px 0;font-size:14px;color:#6b7280;">💇 Serviço</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#111827;">${appointment.service_name} <span style="font-weight:400;color:#6b7280;">(${appointment.service_duration} min)</span></td></tr>
                <tr><td style="padding:6px 0;font-size:14px;color:#6b7280;">👤 Profissional</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#111827;">${appointment.professional_name}</td></tr>
                ${appointment.establishment_address ? `<tr><td style="padding:6px 0;font-size:14px;color:#6b7280;">📍 Local</td><td style="padding:6px 0;font-size:14px;color:#111827;">${appointment.establishment_address}</td></tr>` : ''}
                ${appointment.establishment_phone ? `<tr><td style="padding:6px 0;font-size:14px;color:#6b7280;">📞 Telefone</td><td style="padding:6px 0;font-size:14px;color:#111827;">${appointment.establishment_phone}</td></tr>` : ''}
              </table>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding-bottom:24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fffbeb;border:1px solid #fde68a;border-radius:8px;">
            <tr><td style="padding:14px 18px;font-size:14px;color:#92400e;line-height:1.5;">
              <strong>⚠️ Importante:</strong> Caso não possa comparecer, por favor avise com antecedência.
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding-top:24px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;text-align:center;font-size:12px;color:#9ca3af;line-height:1.6;">
            Enviado por ${appointment.establishment_name} através do <a href="https://www.agendali.online" style="color:#9ca3af;text-decoration:underline;">Agendali</a>
          </p>
          <p style="margin:8px 0 0;text-align:center;"><a href="${baseUrl}" style="font-size:12px;color:#6b7280;text-decoration:underline;">Agendar outro horário</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();

    // ============================================================
    // Strategy: Use per-appointment customer_reminder_hours.
    // This is the value the client chose during booking.
    // We look for appointments where:
    //   - customer_reminder_hours > 0
    //   - reminder_sent_at IS NULL
    //   - status is active (booked, confirmed, paid_confirmed)
    //   - start_at is within the reminder window
    // ============================================================

    // Get distinct reminder hours that appointments use
    const distinctHours = [1, 2, 3, 6, 12, 24];

    const allAppointments: Array<{
      id: string;
      start_at: string;
      customer_reminder_hours: number;
      customer_email: string | null;
      customer: { name: string; email: string | null; phone: string };
      professional: { name: string };
      service: { name: string; duration_minutes: number };
      establishment: { name: string; phone: string | null; address: string | null; slug: string };
    }> = [];

    for (const hours of distinctHours) {
      // Window: appointments starting between (now + hours - 0.5h) and (now + hours + 0.5h)
      const startWindow = new Date(now.getTime() + (hours - 0.5) * 60 * 60 * 1000);
      const endWindow = new Date(now.getTime() + (hours + 0.5) * 60 * 60 * 1000);

      const { data: appointments, error: fetchError } = await supabase
        .from("appointments")
        .select(`
          id,
          start_at,
          customer_reminder_hours,
          customer_email,
          customer:customers(name, email, phone),
          professional:professionals(name),
          service:services(name, duration_minutes),
          establishment:establishments(name, phone, address, slug)
        `)
        .eq("customer_reminder_hours", hours)
        .gte("start_at", startWindow.toISOString())
        .lte("start_at", endWindow.toISOString())
        .in("status", ["booked", "confirmed", "paid_confirmed"])
        .is("reminder_sent_at", null);

      if (fetchError) {
        console.error(`Error fetching appointments for ${hours}h window:`, fetchError);
        continue;
      }

      for (const apt of appointments || []) {
        allAppointments.push({
          ...apt,
          customer_reminder_hours: hours,
          customer: apt.customer as unknown as { name: string; email: string | null; phone: string },
          professional: apt.professional as unknown as { name: string },
          service: apt.service as unknown as { name: string; duration_minutes: number },
          establishment: apt.establishment as unknown as { name: string; phone: string | null; address: string | null; slug: string },
        });
      }
    }

    console.log(`Found ${allAppointments.length} appointments to send reminders`);

    const results = {
      total: allAppointments.length,
      sent: 0,
      skipped: 0,
      failed: 0,
      details: [] as { appointmentId: string; status: string; reason?: string }[],
    };

    for (const appointment of allAppointments) {
      const { customer, professional, service, establishment, customer_reminder_hours } = appointment;

      // Use customer_email from appointment first, then customer record
      const email = appointment.customer_email || customer?.email;

      if (!email) {
        results.skipped++;
        results.details.push({ appointmentId: appointment.id, status: "skipped", reason: "No email" });
        continue;
      }

      try {
        const sanitizedName = establishment.name
          .replace(/[<>()[\]\\,;:"/!@#$%^&*{}|`~]/g, '')
          .trim()
          .substring(0, 60) || 'Agendali';
        const fromAddress = `${sanitizedName} <${RESEND_FROM}>`;
        const hoursText = customer_reminder_hours === 1 ? 'em 1 hora' : `em ${customer_reminder_hours} horas`;
        const emailHtml = getReminderEmailHtml({
          customer_name: customer.name,
          customer_email: email,
          professional_name: professional.name,
          service_name: service.name,
          service_duration: service.duration_minutes,
          establishment_name: establishment.name,
          establishment_phone: establishment.phone,
          establishment_address: establishment.address,
          establishment_slug: establishment.slug,
          start_at: appointment.start_at,
          reminder_hours: customer_reminder_hours,
        });

        await sendEmail(
          email,
          `⏰ Lembrete: Agendamento ${hoursText} - ${establishment.name}`,
          emailHtml,
          fromAddress
        );

        results.sent++;
        results.details.push({ appointmentId: appointment.id, status: "sent" });

        // Mark reminder as sent
        await supabase
          .from("appointments")
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq("id", appointment.id);

        console.log(`Reminder sent for appointment ${appointment.id} to ${email}`);
      } catch (emailError) {
        console.error(`Failed to send reminder for ${appointment.id}:`, emailError);
        results.failed++;
        results.details.push({
          appointmentId: appointment.id,
          status: "failed",
          reason: emailError instanceof Error ? emailError.message : "Unknown error",
        });
      }
    }

    console.log(`Reminder job completed: ${results.sent} sent, ${results.skipped} skipped, ${results.failed} failed`);

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    console.error("Error in send-reminders:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
