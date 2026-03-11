import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RAW_RESEND_FROM = Deno.env.get("RESEND_FROM") || "noreply@agendali.online";
const RESEND_FROM = RAW_RESEND_FROM.includes("<")
  ? RAW_RESEND_FROM.match(/<([^>]+)>/)?.[1] || RAW_RESEND_FROM
  : RAW_RESEND_FROM;

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
  appointment_completed: {
    icon: "🎉", title: "Atendimento Concluído",
    accent: "#7c3aed", bg: "#f5f3ff",
    message: (n) => `Seu atendimento em <strong>${n}</strong> foi concluído com sucesso. Obrigado pela preferência!`,
    subject: (n) => `🎉 Atendimento concluído - ${n}`,
    showCTA: true, showWarning: false, showFooterNote: false,
  },
  appointment_no_show: {
    icon: "📋", title: "Registro de Ausência",
    accent: "#6b7280", bg: "#f9fafb",
    message: (n) => `Identificamos que você não compareceu ao seu agendamento em <strong>${n}</strong>. Caso tenha tido algum imprevisto, entre em contato conosco. Estamos à disposição para reagendar.`,
    subject: (n) => `📋 Registro de ausência - ${n}`,
    showCTA: true, showWarning: false, showFooterNote: false,
  },
  appointment_pending_approval: {
    icon: "⏳", title: "Agendamento Enviado",
    accent: "#d97706", bg: "#fffbeb",
    message: (n) => `Seu pedido de agendamento em <strong>${n}</strong> foi recebido e aguarda aprovação do estabelecimento. Você será notificado assim que houver uma resposta.`,
    subject: (n) => `⏳ Agendamento enviado - ${n}`,
    showCTA: false, showWarning: false, showFooterNote: true,
  },
  appointment_rejected: {
    icon: "🚫", title: "Agendamento Não Aprovado",
    accent: "#dc2626", bg: "#fef2f2",
    message: (n) => `Infelizmente, seu pedido de agendamento em <strong>${n}</strong> não foi aprovado. Entre em contato com o estabelecimento para mais informações ou tente agendar outro horário.`,
    subject: (n) => `🚫 Agendamento não aprovado - ${n}`,
    showCTA: true, showWarning: false, showFooterNote: false,
  },
};

function isReminderType(t: string): boolean {
  return t.startsWith("appointment_reminder");
}

function getReminderConfig(_estName: string): TypeConfig {
  return {
    icon: "⏰", title: "Lembrete de Agendamento",
    accent: "#d97706", bg: "#fffbeb",
    message: (n) => `Seu agendamento em <strong>${n}</strong> está chegando. Não esqueça!`,
    subject: (n) => `⏰ Lembrete de agendamento - ${n}`,
    showCTA: false, showWarning: true, showFooterNote: false,
  };
}

// ─── Email payload ───────────────────────────────────────────
interface EmailPayload {
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

// ─── Build payload from job data + optional DB enrichment ────
async function buildEmailPayload(
  job: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>
): Promise<{ payload: EmailPayload; shouldSkip: boolean; skipReason?: string }> {
  const jobPayload = (job.payload && typeof job.payload === "object") ? job.payload as Record<string, unknown> : {};
  const emailType = job.email_type as string;

  // Try to enrich from DB with separate simple queries (no relationship joins)
  let dbStartAt: string | null = null;
  let dbStatus: string | null = null;
  let dbCustomerId: string | null = null;
  let dbServiceId: string | null = null;
  let dbProfessionalId: string | null = null;
  let dbEstablishmentId: string | null = null;

  // 1. Fetch appointment basics (no joins)
  const { data: apt } = await supabase
    .from("appointments")
    .select("id, start_at, status, customer_id, professional_id, service_id, establishment_id")
    .eq("id", job.appointment_id)
    .maybeSingle();

  if (apt) {
    dbStartAt = apt.start_at;
    dbStatus = apt.status;
    dbCustomerId = apt.customer_id;
    dbServiceId = apt.service_id;
    dbProfessionalId = apt.professional_id;
    dbEstablishmentId = apt.establishment_id;

    // For reminders, skip if appointment was cancelled/completed
    if (isReminderType(emailType) && !["booked", "confirmed"].includes(apt.status)) {
      return { payload: {} as EmailPayload, shouldSkip: true, skipReason: `appointment status: ${apt.status}` };
    }
  } else {
    console.log(`⚠️ Appointment ${job.appointment_id} not found in DB, using payload fallback`);
    // For reminders without appointment, skip entirely
    if (isReminderType(emailType)) {
      return { payload: {} as EmailPayload, shouldSkip: true, skipReason: "appointment not found" };
    }
  }

  // 2. Fetch related data with simple individual queries (only if payload is missing data)
  let customerName = (jobPayload.customer_name as string) || (job.customer_name as string) || null;
  let professionalName = (jobPayload.professional_name as string) || null;
  let serviceName = (jobPayload.service_name as string) || null;
  let serviceDuration = (jobPayload.service_duration as number) || null;
  let estName = (jobPayload.establishment_name as string) || null;
  let estSlug = (jobPayload.establishment_slug as string) || null;
  let estPhone = (jobPayload.establishment_phone as string) || null;
  let estAddress = (jobPayload.establishment_address as string) || null;
  const startAt = (jobPayload.start_at as string) || dbStartAt || new Date().toISOString();

  // Only query DB for missing fields
  if (dbCustomerId && !customerName) {
    const { data: cust } = await supabase.from("customers").select("name").eq("id", dbCustomerId).maybeSingle();
    if (cust) customerName = cust.name;
  }

  if (dbProfessionalId && !professionalName) {
    const { data: prof } = await supabase.from("professionals").select("name").eq("id", dbProfessionalId).maybeSingle();
    if (prof) professionalName = prof.name;
  }

  if (dbServiceId && (!serviceName || !serviceDuration)) {
    const { data: svc } = await supabase.from("services").select("name, duration_minutes").eq("id", dbServiceId).maybeSingle();
    if (svc) {
      serviceName = serviceName || svc.name;
      serviceDuration = serviceDuration || svc.duration_minutes;
    }
  }

  if (dbEstablishmentId && (!estName || !estSlug)) {
    const { data: est } = await supabase.from("establishments").select("name, slug, phone, address").eq("id", dbEstablishmentId).maybeSingle();
    if (est) {
      estName = estName || est.name;
      estSlug = estSlug || est.slug;
      estPhone = estPhone || est.phone;
      estAddress = estAddress || est.address;
    }
  }

  return {
    payload: {
      customer_name: customerName || "Cliente",
      professional_name: professionalName || "Profissional",
      service_name: serviceName || "Serviço",
      service_duration: serviceDuration || 30,
      establishment_name: estName || "Agendali",
      establishment_slug: estSlug || "agendali",
      establishment_phone: estPhone,
      establishment_address: estAddress,
      start_at: startAt,
    },
    shouldSkip: false,
  };
}

// ─── Build HTML ──────────────────────────────────────────────
function buildHtml(cfg: TypeConfig, p: EmailPayload): string {
  const baseUrl = `https://www.agendali.online/${p.establishment_slug}`;
  const logoUrl = "https://www.agendali.online/logo-512.png";
  const { accent, bg } = cfg;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;">
    <tr><td align="center" style="padding:40px 20px 0;">
      <table width="100%" style="max-width:560px;">
        <tr><td style="text-align:center;padding-bottom:32px;">
          <img src="${logoUrl}" alt="Agendali" width="48" height="48" style="display:inline-block;border-radius:10px;" />
          <p style="margin:12px 0 0;font-size:20px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;"><span style="color:#000000;">Agenda</span><span style="color:#9CA3AF;">li</span></p>
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
      if (job.attempts >= job.max_attempts) {
        await supabase
          .from("appointment_email_jobs")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", job.id);
        results.skipped++;
        continue;
      }

      // Lock job
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
        // Build payload using job data + simple DB lookups (no PostgREST joins)
        const { payload: emailPayload, shouldSkip, skipReason } = await buildEmailPayload(job, supabase);

        if (shouldSkip) {
          await supabase
            .from("appointment_email_jobs")
            .update({ status: "cancelled", cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq("id", job.id);
          console.log(`Skipped job ${job.id} — ${skipReason}`);
          results.skipped++;
          continue;
        }

        const emailType = job.email_type as string;
        const cfg = isReminderType(emailType)
          ? getReminderConfig(emailPayload.establishment_name)
          : TYPE_MAP[emailType];

        if (!cfg) {
          throw new Error(`Unknown email type: ${emailType}`);
        }

        const html = buildHtml(cfg, emailPayload);
        const subject = job.subject || cfg.subject(emailPayload.establishment_name);
        const fromAddress = `${sanitizeName(emailPayload.establishment_name)} <${RESEND_FROM}>`;

        console.log(`📧 Sending ${emailType} to ${job.customer_email} for appointment ${job.appointment_id}`);
        const resendResult = await sendViaResend(job.customer_email, subject, html, fromAddress);

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
