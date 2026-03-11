import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const {
      establishment_id,
      appointment_id,
      amount_cents,
      payment_type,
      payer_email,
      service_name,
      customer_name,
      slug,
    } = body;

    if (!establishment_id || !appointment_id || !amount_cents) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Get merchant access token
    const { data: account } = await supabase
      .from("payment_accounts")
      .select("access_token")
      .eq("establishment_id", establishment_id)
      .eq("provider", "mercadopago")
      .eq("status", "active")
      .single();

    if (!account?.access_token) {
      return new Response(
        JSON.stringify({ error: "Payment account not configured" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const appUrl = Deno.env.get("APP_URL") || "https://agendali.lovable.app";
    const webhookUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`;

    // Create MP preference
    const preference = {
      items: [
        {
          title: service_name || "Agendamento",
          description: `Pagamento para ${customer_name || "cliente"}`,
          quantity: 1,
          unit_price: amount_cents / 100,
          currency_id: "BRL",
        },
      ],
      payer: payer_email ? { email: payer_email } : undefined,
      back_urls: {
        success: `${appUrl}/${slug || ""}?payment=success&apt=${appointment_id}`,
        failure: `${appUrl}/${slug || ""}?payment=failure&apt=${appointment_id}`,
        pending: `${appUrl}/${slug || ""}?payment=pending&apt=${appointment_id}`,
      },
      auto_return: "approved",
      notification_url: webhookUrl,
      external_reference: appointment_id,
      statement_descriptor: "AGENDALI",
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30min
    };

    const mpRes = await fetch(
      "https://api.mercadopago.com/checkout/preferences",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${account.access_token}`,
        },
        body: JSON.stringify(preference),
      },
    );

    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      console.error("MP create preference error:", mpData);
      return new Response(
        JSON.stringify({ error: "Failed to create payment" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Save payment record
    await supabase.from("appointment_payments").insert({
      establishment_id,
      appointment_id,
      provider: "mercadopago",
      provider_preference_id: mpData.id,
      payment_type: payment_type || "deposit",
      amount_cents,
      status: "pending",
      payment_url: mpData.init_point,
      payer_email: payer_email || null,
    });

    return new Response(
      JSON.stringify({
        payment_url: mpData.init_point,
        preference_id: mpData.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("mercadopago-create-payment error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
