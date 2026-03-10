import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "noreply@agendali.online";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Resend sender ────────────────────────────────────────────
async function sendViaResend(to: string, subject: string, html: string, from: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend ${res.status}: ${errText}`);
  }
  return (await res.json()) as { id: string };
}

// ─── Helpers ──────────────────────────────────────────────────
function sanitizeName(name: string): string {
  return name.replace(/[<>()[\]\\,;:"/!@#$%^&*{}|`~]/g, "").trim().substring(0, 60) || "Agendali";
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
}

function fmtTime(d: string): string {
  return new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// ─── Email type → visual config ──────────────────────────────
interface TypeConfig {
  icon: string;
  title: string;
  accent: string;
  bg: string;
  message: (estName: string) => string;
  subject: (estName: string) => string;
  showCTA: boolean;
  showWarning: boolean;
  showFooterNote: boolean;
}

const TYPE_MAP: Record<string, TypeConfig> = {
  appointment_confirmation: {
    icon: "✅", title: "Agendamento Confirmado",
    accent: "#16a34a", bg: "#f0fdf4",
    message: (n) => `Seu agendamento em <strong>${n}</strong> foi confirmado com sucesso.`,
    subject: (n) => `✅ Agendamento confirmado - ${n}`,
    showCTA: false, showWarning: false, showFooterNote: true,
  },
  appointment_cancelled: {
    icon: "❌", title: "Agendamento Cancelado",
    accent: "#dc2626", bg: "#fef2f2",
    message: (n) => `Seu agendamento em <strong>${n}</strong> foi cancelado.`,
    subject: (n) => `❌ Agendamento cancelado - ${n}`,
    showCTA: true, showWarning: false, showFooterNote: false,
  },
  appointment_rescheduled: {
    icon: "🔄", title: "Agendamento Reagendado",
    accent: "#2563eb", bg: "#eff6ff",
    message: (n) => `Seu agendamento em <strong>${n}</strong> foi reagendado para uma nova data.`,
    subject: (n) => `🔄 Agendamento reagendado - ${n}`,
    showCTA: false, showWarning: false, showFooterNote: true,
  },
};

// Any email_type starting with "appointment_reminder" is treated as a reminder
function isReminderType(t: string): boolean {
  return t.startsWith("appointment_reminder");
}

function getReminderConfig(estName: string): TypeConfig {
  return {
    icon: "⏰", title: "Lembrete de Agendamento",
    accent: "#d97706", bg: "#fffbeb",
    message: (n) => `Seu agendamento em <strong>${n}</strong> está chegando. Não esqueça!`,
    subject: (n) => `⏰ Lembrete de agendamento - ${n}`,
    showCTA: false, showWarning: true, showFooterNote: false,
  };
}

// ─── Build HTML ──────────────────────────────────────────────
interface AppointmentPayload {
  customer_name: string;
  professional_name: string;
  service_name: string;
  service_duration: number;
  establishment_name: string;
  establishment_slug: string;
  establishment_phone?: string | null;
  establishment_address?: string | null;
  start_at: string;
}

function buildHtml(cfg: TypeConfig, p: AppointmentPayload): string {
  const baseUrl = `https://www.agendali.online/${p.establishment_slug}`;
  const logoUrl = "https://www.agendali.online/logo-192.png";
  const { accent, bg } = cfg;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;">
    <tr><td align="center" style="padding:40px 20px 0;">
      <table width="100%" style="max-width:560px;">
        <tr><td style="text-align:center;padding-bottom:32px;">
          <img src="${logoUrl}" alt="Agendali" width="48" height="48" style="display:inline-block;border-radius:10px;" />
          <p style="margin:12px 0 0;font-size:13px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:#9ca3af;">AGENDALI</p>
        </td></tr>
        <tr><td align="center" style="padding-bottom:24px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background-color:${bg};border:1px solid ${accent}22;border-radius:100px;padding:8px 20px;">
              <span style="font-size:14px;font-weight:600;color:${accent};">${cfg.icon} ${cfg.title}</span>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding-bottom:8px;">
          <p style="margin:0 0 6px;font-size:16px;color:#374151;">Olá, <strong style="color:#111827;">${p.customer_name}</strong>!</p>
          <p style="margin:0;font-size:16px;line-height:1.6;color:#374151;">${cfg.message(p.establishment_name)}</p>
        </td></tr>
        <tr><td style="padding:24px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;">
            <tr><td style="padding:24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="padding:6px 0;font-size:14px;color:#6b7280;width:120px;">📅 Data</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#111827;">${fmtDate(p.start_at)}</td></tr>
                <tr><td style="padding:6px 0;font-size:14px;color:#6b7280;">🕐 Horário</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#111827;">${fmtTime(p.start_at)}</td></tr>
                <tr><td style="padding:6px 0;font-size:14px;color:#6b7280;">💇 Serviço</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#111827;">${p.service_name} <span style="font-weight:400;color:#6b7280;">(${p.service_duration} min)</span></td></tr>
                <tr><td style="padding:6px 0;font-size:14px;color:#6b7280;">👤 Profissional</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#111827;">${p.professional_name}</td></tr>
                ${p.establishment_address ? `<tr><td style="padding:6px 0;font-size:14px;color:#6b7280;">📍 Local</td><td style="padding:6px 0;font-size:14px;color:#111827;">${p.establishment_address}</td></tr>` : ""}
                ${p.establishment_phone ? `<tr><td style="padding:6px 0;font-size:14px;color:#6b7280;">📞 Telefone</td><td style="padding:6px 0;font-size:14px;color:#111827;">${p.establishment_phone}</td></tr>` : ""}
              </table>
            </td></tr>
          </table>
        </td></tr>
        ${cfg.showWarning ? `<tr><td style="padding-bottom:24px;"><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fffbeb;border:1px solid #fde68a;border-radius:8px;"><tr><td style="padding:14px 18px;font-size:14px;color:#92400e;line-height:1.5;"><strong>⚠️ Importante:</strong> Caso não possa comparecer, por favor avise com antecedência.</td></tr></table></td></tr>` : ""}
        ${cfg.showCTA ? `<tr><td align="center" style="padding-bottom:24px;"><a href="${baseUrl}" style="display:inline-block;padding:14px 32px;background-color:#111827;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">Agendar novo horário</a></td></tr>` : ""}
        ${cfg.showFooterNote ? `<tr><td style="padding-bottom:16px;"><p style="margin:0;font-size:14px;color:#6b7280;line-height:1.5;">Caso precise reagendar ou cancelar, acesse sua área de agendamentos.</p></td></tr>` : ""}
        <tr><td style="padding-top:24px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;text-align:center;font-size:12px;color:#9ca3af;line-height:1.6;">Enviado por ${p.establishment_name} através do <a href="https://www.agendali.online" style="color:#9ca3af;text-decoration:underline;">Agendali</a></p>
          <p style="margin:8px 0 0;text-align:center;"><a href="${baseUrl}" style="font-size:12px;color:#6b7280;text-decoration:underline;">Agendar outro horário</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ─── Main handler ─────────────────────────────────────────────
const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch pending jobs
    const { data: jobs, error: fetchErr } = await supabase
      .from("appointment_email_jobs")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(50);

    if (fetchErr) throw fetchErr;
    if (!jobs || jobs.length === 0) {
      console.log("No pending email jobs");
      return new Response(
        JSON.stringify({ success: true, processed: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Processing ${jobs.length} email jobs`);

    const results = { sent: 0, failed: 0, skipped: 0 };

    for (const job of jobs) {
      // Skip if max attempts exceeded
      if (job.attempts >= job.max_attempts) {
        await supabase
          .from("appointment_email_jobs")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", job.id);
        results.skipped++;
        continue;
      }

      // Mark as processing to prevent duplicates
      const { error: lockErr } = await supabase
        .from("appointment_email_jobs")
        .update({ status: "processing", updated_at: new Date().toISOString() })
        .eq("id", job.id)
        .eq("status", "pending");

      if (lockErr) {
        console.warn(`Could not lock job ${job.id}:`, lockErr.message);
        results.skipped++;
        continue;
      }

      try {
        // Try to fetch appointment data from DB
        const { data: apt, error: aptErr } = await supabase
          .from("appointments")
          .select(`
            id, start_at, end_at, status, customer_notes,
            customer:customers(name, email, phone),
            professional:professionals(name),
            service:services(name, duration_minutes),
            establishment:establishments(name, phone, address, slug)
          `)
          .eq("id", job.appointment_id)
          .maybeSingle();

        // Build payload from DB data or fallback to job fields + payload JSON
        const jobPayload = (job.payload && typeof job.payload === "object") ? job.payload as Record<string, unknown> : {};
        let emailPayload: AppointmentPayload;
        let establishmentName: string;

        if (apt && !aptErr) {
          const customer = apt.customer as unknown as { name: string; email: string | null; phone: string };
          const professional = apt.professional as unknown as { name: string };
          const service = apt.service as unknown as { name: string; duration_minutes: number };
          const establishment = apt.establishment as unknown as { name: string; phone: string | null; address: string | null; slug: string };

          // For reminder jobs, skip if appointment was cancelled/completed
          if (isReminderType(job.email_type) && !["booked", "confirmed"].includes(apt.status)) {
            await supabase
              .from("appointment_email_jobs")
              .update({ status: "cancelled", cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
              .eq("id", job.id);
            console.log(`Skipped reminder for ${job.id} — appointment status: ${apt.status}`);
            results.skipped++;
            continue;
          }

          establishmentName = establishment.name;
          emailPayload = {
            customer_name: customer.name,
            professional_name: professional.name,
            service_name: service.name,
            service_duration: service.duration_minutes,
            establishment_name: establishment.name,
            establishment_slug: establishment.slug,
            establishment_phone: establishment.phone,
            establishment_address: establishment.address,
            start_at: apt.start_at,
          };
        } else {
          // Fallback: use data from job columns + payload JSON
          console.log(`⚠️ Appointment ${job.appointment_id} not found in DB, using payload fallback for job ${job.id}`);
          establishmentName = (jobPayload.establishment_name as string) || "Agendali";
          emailPayload = {
            customer_name: job.customer_name || (jobPayload.customer_name as string) || "Cliente",
            professional_name: (jobPayload.professional_name as string) || "Profissional",
            service_name: (jobPayload.service_name as string) || "Serviço",
            service_duration: (jobPayload.service_duration as number) || 30,
            establishment_name: establishmentName,
            establishment_slug: (jobPayload.establishment_slug as string) || "agendali",
            establishment_phone: (jobPayload.establishment_phone as string) || null,
            establishment_address: (jobPayload.establishment_address as string) || null,
            start_at: (jobPayload.start_at as string) || new Date().toISOString(),
          };
        }

        // Determine email config
        const emailType = job.email_type as string;
        const cfg = isReminderType(emailType)
          ? getReminderConfig(establishmentName)
          : TYPE_MAP[emailType];

        if (!cfg) {
          throw new Error(`Unknown email type: ${emailType}`);
        }

        const html = buildHtml(cfg, payload);
        const subject = job.subject || cfg.subject(establishment.name);
        const fromAddress = `${sanitizeName(establishment.name)} <${RESEND_FROM}>`;

        const resendResult = await sendViaResend(job.customer_email, subject, html, fromAddress);

        // Mark sent
        await supabase
          .from("appointment_email_jobs")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            provider_message_id: resendResult.id,
            provider: "resend",
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        console.log(`✅ Sent ${emailType} to ${job.customer_email} (job ${job.id})`);
        results.sent++;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`❌ Failed job ${job.id}:`, errorMsg);

        await supabase
          .from("appointment_email_jobs")
          .update({
            status: job.attempts + 1 >= job.max_attempts ? "failed" : "pending",
            attempts: job.attempts + 1,
            last_error: errorMsg,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        results.failed++;
      }
    }

    console.log(`Queue processed: ${results.sent} sent, ${results.failed} failed, ${results.skipped} skipped`);

    return new Response(
      JSON.stringify({ success: true, ...results, total: jobs.length }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    console.error("process-email-queue error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
