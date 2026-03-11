import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const url = new URL(req.url);
    const topic = url.searchParams.get("topic") || url.searchParams.get("type");
    const id = url.searchParams.get("id") || url.searchParams.get("data.id");

    // MP also sends JSON body notifications
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // query param notification
    }

    const eventType = body.type || body.action || topic || "unknown";
    const dataId = body.data?.id || id;
    const eventId = body.id || `${eventType}-${dataId}-${Date.now()}`;

    // Idempotency check
    const { data: existing } = await supabase
      .from("payment_webhook_events")
      .select("id")
      .eq("provider", "mercadopago")
      .eq("event_id", eventId)
      .maybeSingle();

    if (existing) {
      return new Response("Already processed", { status: 200 });
    }

    // Log event
    await supabase.from("payment_webhook_events").insert({
      provider: "mercadopago",
      event_id: eventId,
      event_type: eventType,
      payload: body || {},
    });

    // Only process payment events
    if (eventType !== "payment" && !eventType.includes("payment")) {
      await supabase
        .from("payment_webhook_events")
        .update({ processed_at: new Date().toISOString() })
        .eq("event_id", eventId)
        .eq("provider", "mercadopago");
      return new Response("OK", { status: 200 });
    }

    if (!dataId) {
      return new Response("No payment ID", { status: 200 });
    }

    // Find the appointment payment by external_reference or provider_payment_id
    // First, we need to fetch the payment from MP to get details
    // We need the merchant's access token - find via appointment_payment
    const { data: existingPayment } = await supabase
      .from("appointment_payments")
      .select("*, establishment_id")
      .or(`provider_payment_id.eq.${dataId},provider_preference_id.eq.${dataId}`)
      .limit(1)
      .maybeSingle();

    let accessToken: string | null = null;
    let establishmentId: string | null = existingPayment?.establishment_id || null;

    if (establishmentId) {
      const { data: account } = await supabase
        .from("payment_accounts")
        .select("access_token")
        .eq("establishment_id", establishmentId)
        .eq("provider", "mercadopago")
        .eq("status", "active")
        .single();
      accessToken = account?.access_token || null;
    }

    if (!accessToken) {
      // Try all active accounts (fallback)
      const { data: accounts } = await supabase
        .from("payment_accounts")
        .select("access_token, establishment_id")
        .eq("provider", "mercadopago")
        .eq("status", "active");

      for (const acc of accounts || []) {
        const checkRes = await fetch(
          `https://api.mercadopago.com/v1/payments/${dataId}`,
          { headers: { Authorization: `Bearer ${acc.access_token}` } },
        );
        if (checkRes.ok) {
          accessToken = acc.access_token;
          establishmentId = acc.establishment_id;
          break;
        }
      }
    }

    if (!accessToken) {
      console.error("No valid access token found for payment", dataId);
      await supabase
        .from("payment_webhook_events")
        .update({
          processed_at: new Date().toISOString(),
          processing_error: "no_access_token",
        })
        .eq("event_id", eventId)
        .eq("provider", "mercadopago");
      return new Response("OK", { status: 200 });
    }

    // Fetch payment details from MP
    const paymentRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${dataId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!paymentRes.ok) {
      console.error("Failed to fetch payment from MP:", await paymentRes.text());
      return new Response("OK", { status: 200 });
    }

    const payment = await paymentRes.json();
    const appointmentId = payment.external_reference;
    const mpStatus = payment.status; // approved, rejected, pending, in_process, cancelled, refunded

    // Map MP status to our status
    const statusMap: Record<string, string> = {
      approved: "approved",
      authorized: "approved",
      pending: "pending",
      in_process: "in_process",
      rejected: "rejected",
      cancelled: "cancelled",
      refunded: "refunded",
      charged_back: "refunded",
    };

    const ourStatus = statusMap[mpStatus] || "pending";

    // Update or create appointment_payment
    if (existingPayment) {
      await supabase
        .from("appointment_payments")
        .update({
          provider_payment_id: String(dataId),
          status: ourStatus,
          payer_email: payment.payer?.email || existingPayment.payer_email,
          fee_cents: Math.round((payment.fee_details?.[0]?.amount || 0) * 100),
          net_amount_cents: Math.round(
            (payment.transaction_amount - (payment.fee_details?.[0]?.amount || 0)) * 100,
          ),
          paid_at: mpStatus === "approved" ? new Date().toISOString() : null,
          refunded_at: mpStatus === "refunded" ? new Date().toISOString() : null,
          metadata: { mp_status: mpStatus, mp_status_detail: payment.status_detail },
        })
        .eq("id", existingPayment.id);
    } else if (appointmentId) {
      await supabase.from("appointment_payments").insert({
        establishment_id: establishmentId,
        appointment_id: appointmentId,
        provider: "mercadopago",
        provider_payment_id: String(dataId),
        payment_type: "deposit",
        amount_cents: Math.round((payment.transaction_amount || 0) * 100),
        fee_cents: Math.round((payment.fee_details?.[0]?.amount || 0) * 100),
        net_amount_cents: Math.round(
          ((payment.transaction_amount || 0) - (payment.fee_details?.[0]?.amount || 0)) * 100,
        ),
        status: ourStatus,
        payer_email: payment.payer?.email || null,
        paid_at: mpStatus === "approved" ? new Date().toISOString() : null,
        metadata: { mp_status: mpStatus, mp_status_detail: payment.status_detail },
      });
    }

    // If payment approved and appointment exists, update appointment status
    if (ourStatus === "approved" && appointmentId) {
      const { data: apt } = await supabase
        .from("appointments")
        .select("status, establishment_id")
        .eq("id", appointmentId)
        .single();

      if (apt && (apt.status === "pending_payment" || apt.status === "booked")) {
        // Check if manual confirmation is required
        const { data: settings } = await supabase
          .from("payment_settings")
          .select("require_manual_confirmation")
          .eq("establishment_id", apt.establishment_id)
          .single();

        const newStatus = settings?.require_manual_confirmation
          ? "paid_pending_confirmation"
          : "confirmed";

        await supabase
          .from("appointments")
          .update({ status: newStatus })
          .eq("id", appointmentId);
      }
    }

    // Mark event as processed
    await supabase
      .from("payment_webhook_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("event_id", eventId)
      .eq("provider", "mercadopago");

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("mercadopago-webhook error:", err);
    return new Response("Internal error", { status: 500 });
  }
});
