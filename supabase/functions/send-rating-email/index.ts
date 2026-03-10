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

interface RatingEmailRequest {
  ratingId: string;
}

interface RatingData {
  id: string;
  stars: number;
  comment: string | null;
  created_at: string;
  customer: {
    name: string;
  };
  appointment: {
    start_at: string;
    service: {
      name: string;
    };
    professional: {
      name: string;
    };
  };
  establishment: {
    id: string;
    name: string;
    slug: string;
  };
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function getStarsHtml(stars: number): string {
  const fullStar = '⭐';
  const emptyStar = '☆';
  let html = '';
  for (let i = 0; i < 5; i++) {
    html += i < stars ? fullStar : emptyStar;
  }
  return html;
}

function getStarsColor(stars: number): string {
  if (stars >= 4) return '#16a34a'; // green
  if (stars >= 3) return '#f59e0b'; // yellow
  return '#dc2626'; // red
}

function getRatingEmailHtml(data: RatingData, _ownerEmail: string): string {
  const { customer, appointment, establishment, stars, comment, created_at } = data;
  const starsColor = getStarsColor(stars);
  const logoUrl = 'https://www.agendali.online/logo-512.png';
  const feedbackMsg = stars >= 4 ? '🎉 Ótimo trabalho! Continue assim!' : stars >= 3 ? '💪 Bom trabalho! Há espaço para melhorar.' : '⚠️ Esta avaliação precisa de atenção.';

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

        <!-- Title -->
        <tr><td style="text-align:center;padding-bottom:24px;">
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#111827;">Nova Avaliação Recebida</h1>
          <p style="margin:8px 0 0;font-size:15px;color:#6b7280;">Um cliente avaliou <strong style="color:#111827;">${establishment.name}</strong></p>
        </td></tr>

        <!-- Stars card -->
        <tr><td style="padding-bottom:24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;border-left:4px solid ${starsColor};">
            <tr><td style="padding:24px;">
              <div style="font-size:28px;letter-spacing:4px;margin-bottom:8px;">${getStarsHtml(stars)}</div>
              <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:${starsColor};">${stars}/5 estrelas</p>
              <p style="margin:0;font-size:13px;color:#6b7280;">Por <strong>${customer.name}</strong> em ${formatDate(created_at)}</p>
            </td></tr>
          </table>
        </td></tr>

        ${comment ? `
        <!-- Comment -->
        <tr><td style="padding-bottom:24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;">
            <tr><td style="padding:20px;">
              <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;">Comentário do cliente</p>
              <p style="margin:0;font-size:15px;font-style:italic;color:#374151;line-height:1.6;">"${comment}"</p>
            </td></tr>
          </table>
        </td></tr>` : ''}

        <!-- Service details -->
        <tr><td style="padding-bottom:24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
            <tr><td style="padding:16px 20px;">
              <p style="margin:0 0 2px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;">Atendimento avaliado</p>
              <p style="margin:8px 0 2px;font-size:14px;color:#374151;"><strong>Serviço:</strong> ${appointment.service.name}</p>
              <p style="margin:2px 0;font-size:14px;color:#374151;"><strong>Profissional:</strong> ${appointment.professional.name}</p>
              <p style="margin:2px 0;font-size:14px;color:#374151;"><strong>Data:</strong> ${formatDate(appointment.start_at)}</p>
            </td></tr>
          </table>
        </td></tr>

        <!-- Feedback + CTA -->
        <tr><td style="padding-bottom:24px;text-align:center;">
          <p style="margin:0 0 16px;font-size:14px;font-weight:600;color:${starsColor};">${feedbackMsg}</p>
          <a href="https://www.agendali.online/dashboard/avaliacoes" style="display:inline-block;padding:14px 32px;background-color:#111827;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">
            Ver no Painel
          </a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding-top:24px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;text-align:center;font-size:12px;color:#9ca3af;line-height:1.6;">
            Enviado pelo <a href="https://www.agendali.online" style="color:#9ca3af;text-decoration:underline;">Agendali</a> — Sistema de Agendamento Online
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

    const { ratingId }: RatingEmailRequest = await req.json();

    if (!ratingId) {
      return new Response(
        JSON.stringify({ error: "Missing ratingId" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch rating with related data
    const { data: rating, error: fetchError } = await supabase
      .from("ratings")
      .select(`
        id,
        stars,
        comment,
        created_at,
        customer:customers(name),
        appointment:appointments(
          start_at,
          service:services(name),
          professional:professionals(name)
        ),
        establishment:establishments(id, name, slug, owner_user_id)
      `)
      .eq("id", ratingId)
      .single();

    if (fetchError || !rating) {
      console.error("Error fetching rating:", fetchError);
      return new Response(
        JSON.stringify({ error: "Rating not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get establishment owner's email
    const establishment = rating.establishment as unknown as { id: string; name: string; slug: string; owner_user_id: string };
    
    const { data: ownerProfile, error: ownerError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", establishment.owner_user_id)
      .single();

    if (ownerError) {
      console.log("Could not fetch owner profile:", ownerError);
    }

    // Get owner's email from auth.users via service role
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(
      establishment.owner_user_id
    );

    if (authError || !authUser?.user?.email) {
      console.log("Owner has no email or error fetching:", authError);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "No owner email" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const ownerEmail = authUser.user.email;

    // Transform rating data
    const ratingData: RatingData = {
      id: rating.id,
      stars: rating.stars,
      comment: rating.comment,
      created_at: rating.created_at,
      customer: rating.customer as unknown as RatingData['customer'],
      appointment: rating.appointment as unknown as RatingData['appointment'],
      establishment: {
        id: establishment.id,
        name: establishment.name,
        slug: establishment.slug,
      },
    };

    // Send email to establishment owner
    const fromAddress = `Agendali <${RESEND_FROM}>`;
    const subject = `⭐ Nova avaliação (${ratingData.stars}/5) - ${ratingData.establishment.name}`;
    
    const emailResponse = await sendEmail(
      ownerEmail,
      subject,
      getRatingEmailHtml(ratingData, ownerEmail),
      fromAddress
    );

    console.log("Rating notification email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, emailId: emailResponse.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    console.error("Error in send-rating-email:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
