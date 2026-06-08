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

    console.log("mercadopago-webhook: received", { eventType, dataId, eventId });

    // Idempotency check
    const { data: existing } = await supabase
      .from("payment_webhook_events")
      .select("id")
      .eq("provider", "mercadopago")
      .eq("event_id", eventId)
      .maybeSingle();

    if (existing) {
      console.log("mercadopago-webhook: already processed", eventId);
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
      console.log("mercadopago-webhook: ignoring non-payment event", eventType);
      await supabase
        .from("payment_webhook_events")
        .update({ processed_at: new Date().toISOString() })
        .eq("event_id", eventId)
        .eq("provider", "mercadopago");
      return new Response("OK", { status: 200 });
    }

    if (!dataId) {
      console.log("mercadopago-webhook: no payment ID");
      return new Response("No payment ID", { status: 200 });
    }

    // Find the appointment payment
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
        .maybeSingle();
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
        } else {
          await checkRes.text(); // consume body
        }
      }
    }

    if (!accessToken) {
      console.error("mercadopago-webhook: no valid access token for payment", dataId);
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
      console.error("mercadopago-webhook: failed to fetch payment from MP:", await paymentRes.text());
      return new Response("OK", { status: 200 });
    }

    const payment = await paymentRes.json();
    const appointmentId = payment.external_reference;
    const mpStatus = payment.status;

    // ── Fee calculation ──
    // Sum ALL fee_details entries (MP may have multiple: mercadopago_fee, financing_fee, etc.)
    const totalFeeCents = Math.round(
      (payment.fee_details || []).reduce((sum: number, f: any) => sum + (f.amount || 0), 0) * 100
    );
    // Use transaction_details.net_received_amount as source of truth for net, fallback to calculation
    const grossCents = Math.round((payment.transaction_amount || 0) * 100);
    const netFromMP = payment.transaction_details?.net_received_amount;
    const netCents = netFromMP != null
      ? Math.round(netFromMP * 100)
      : grossCents - totalFeeCents;

    // Payment method (pix, credit_card, debit_card, etc.)
    const paymentMethod = payment.payment_method_id || payment.payment_type_id || null;

    console.log("mercadopago-webhook: payment details", {
      appointmentId,
      mpStatus,
      statusDetail: payment.status_detail,
      paymentMethod,
      grossCents,
      totalFeeCents,
      netCents,
      feeDetails: payment.fee_details,
      netReceivedAmount: netFromMP,
    });

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
          fee_cents: totalFeeCents,
          net_amount_cents: netCents,
          payment_method: paymentMethod,
          paid_at: mpStatus === "approved" ? new Date().toISOString() : null,
          refunded_at: mpStatus === "refunded" ? new Date().toISOString() : null,
          metadata: { mp_status: mpStatus, mp_status_detail: payment.status_detail, payment_method: paymentMethod },
          provider_raw_payload: payment,
        })
        .eq("id", existingPayment.id);
    } else if (appointmentId) {
      await supabase.from("appointment_payments").insert({
        establishment_id: establishmentId,
        appointment_id: appointmentId,
        provider: "mercadopago",
        provider_payment_id: String(dataId),
        payment_type: "deposit",
        amount_cents: grossCents,
        fee_cents: totalFeeCents,
        net_amount_cents: netCents,
        payment_method: paymentMethod,
        status: ourStatus,
        payer_email: payment.payer?.email || null,
        paid_at: mpStatus === "approved" ? new Date().toISOString() : null,
        metadata: { mp_status: mpStatus, mp_status_detail: payment.status_detail, payment_method: paymentMethod },
        provider_raw_payload: payment,
      });
    }

    // ── If payment approved → ALWAYS confirm appointment immediately ──
    if (ourStatus === "approved" && appointmentId) {
      const { data: apt } = await supabase
        .from("appointments")
        .select("status, establishment_id, customer_email, customer_id")
        .eq("id", appointmentId)
        .single();

      if (apt && (apt.status === "pending_payment" || apt.status === "booked" || apt.status === "pending_approval")) {
        // Always confirm immediately when payment is approved (no more paid_pending_confirmation)
        const newStatus = "confirmed";

        console.log("mercadopago-webhook: auto-confirming appointment", {
          appointmentId,
          from: apt.status,
          to: newStatus,
        });

        await supabase
          .from("appointments")
          .update({ status: newStatus })
          .eq("id", appointmentId);

        // Create email notification
        const estId = apt.establishment_id;
        let customerEmail = apt.customer_email;
        if (!customerEmail) {
          const { data: customer } = await supabase
            .from("customers")
            .select("email, name")
            .eq("id", apt.customer_id)
            .single();
          customerEmail = customer?.email;
        }

        if (customerEmail && customerEmail.length >= 4) {
          const { data: aptFull } = await supabase
            .from("appointments")
            .select(`
              *,
              services:service_id(name, duration_minutes),
              professionals:professional_id(name),
              customers:customer_id(name),
              establishments:establishment_id(name, slug, phone, address)
            `)
            .eq("id", appointmentId)
            .single();

          if (aptFull) {
            const payload = {
              customer_name: (aptFull as any).customers?.name || "Cliente",
              professional_name: (aptFull as any).professionals?.name || "Profissional",
              service_name: (aptFull as any).services?.name || "Serviço",
              service_duration: (aptFull as any).services?.duration_minutes || 30,
              establishment_name: (aptFull as any).establishments?.name || "Agendali",
              establishment_slug: (aptFull as any).establishments?.slug || "",
              establishment_phone: (aptFull as any).establishments?.phone,
              establishment_address: (aptFull as any).establishments?.address,
              start_at: aptFull.start_at,
              payment_status: "paid_confirmed",
              payment_method: paymentMethod,
            };

            // Send payment+confirmation email
            const dedupeKey = `appointment_payment_confirmed:${appointmentId}`;
            await supabase.from("appointment_email_jobs").insert({
              appointment_id: appointmentId,
              establishment_id: estId,
              customer_email: customerEmail.toLowerCase().trim(),
              customer_name: (aptFull as any).customers?.name || "Cliente",
              email_type: "appointment_payment_confirmed_auto",
              status: "pending",
              payload,
              scheduled_for: new Date().toISOString(),
              dedupe_key: dedupeKey,
            }).then(({ error }: any) => {
              if (error && !error.message.includes("duplicate")) {
                console.error("Error creating confirmation email job:", error);
              }
            });

            // Schedule reminder if applicable
            const reminderHours = aptFull.customer_reminder_hours;
            if (reminderHours && reminderHours > 0) {
              const reminderTime = new Date(new Date(aptFull.start_at).getTime() - reminderHours * 60 * 60 * 1000);
              if (reminderTime > new Date()) {
                await supabase.from("appointment_email_jobs").insert({
                  appointment_id: appointmentId,
                  establishment_id: estId,
                  customer_email: customerEmail.toLowerCase().trim(),
                  customer_name: (aptFull as any).customers?.name || "Cliente",
                  email_type: `appointment_reminder_${reminderHours}h`,
                  status: "pending",
                  payload,
                  scheduled_for: reminderTime.toISOString(),
                  dedupe_key: `appointment_reminder:${appointmentId}`,
                }).then(({ error }: any) => {
                  if (error && !error.message.includes("duplicate")) {
                    console.error("Error creating reminder email job:", error);
                  }
                });
              }
            }
          }
        }
      }
    }

    // Handle payment failure
    if ((ourStatus === "rejected" || ourStatus === "cancelled") && appointmentId) {
      const { data: apt } = await supabase
        .from("appointments")
        .select("*, services:service_id(name, duration_minutes), professionals:professional_id(name), customers:customer_id(name, email), establishments:establishment_id(name, slug, phone, address)")
        .eq("id", appointmentId)
        .maybeSingle();

      if (apt) {
        const custEmail = apt.customer_email || (apt as any).customers?.email;
        if (custEmail && custEmail.length >= 4) {
          const failPayload = {
            customer_name: (apt as any).customers?.name || "Cliente",
            professional_name: (apt as any).professionals?.name || "Profissional",
            service_name: (apt as any).services?.name || "Serviço",
            service_duration: (apt as any).services?.duration_minutes || 30,
            establishment_name: (apt as any).establishments?.name || "Agendali",
            establishment_slug: (apt as any).establishments?.slug || "",
            establishment_phone: (apt as any).establishments?.phone,
            establishment_address: (apt as any).establishments?.address,
            start_at: apt.start_at,
          };

          await supabase.from("appointment_email_jobs").insert({
            appointment_id: appointmentId,
            establishment_id: apt.establishment_id,
            customer_email: custEmail.toLowerCase().trim(),
            customer_name: (apt as any).customers?.name || "Cliente",
            email_type: "appointment_payment_failed",
            status: "pending",
            payload: failPayload,
            scheduled_for: new Date().toISOString(),
            dedupe_key: `appointment_payment_failed:${appointmentId}:${Date.now()}`,
          }).then(({ error }: any) => {
            if (error) console.error("Error creating payment failed email:", error);
          });
        }
      }
    }

    // Mark event as processed
    await supabase
      .from("payment_webhook_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("event_id", eventId)
      .eq("provider", "mercadopago");

    console.log("mercadopago-webhook: processed successfully", eventId);
    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("mercadopago-webhook error:", err);
    return new Response("Internal error", { status: 500 });
  }
});
