import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    console.log("mercadopago-create-payment: received", {
      establishment_id,
      appointment_id,
      amount_cents,
      payment_type,
    });

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
    const { data: account, error: accountError } = await supabase
      .from("payment_accounts")
      .select("access_token, mp_public_key")
      .eq("establishment_id", establishment_id)
      .eq("provider", "mercadopago")
      .eq("status", "active")
      .maybeSingle();

    if (accountError) {
      console.error("Error fetching payment account:", accountError);
    }

    if (!account?.access_token) {
      console.error("No active payment account for establishment", establishment_id);
      return new Response(
        JSON.stringify({ error: "Conta de pagamento não configurada. O estabelecimento precisa conectar o Mercado Pago." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const appUrl = Deno.env.get("APP_URL") || "https://agendali.lovable.app";
    const webhookUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`;

    // Build back URLs
    const backSlug = slug || "";
    const backUrls = {
      success: `${appUrl}/${backSlug}?payment=success&apt=${appointment_id}`,
      failure: `${appUrl}/${backSlug}?payment=failure&apt=${appointment_id}`,
      pending: `${appUrl}/${backSlug}?payment=pending&apt=${appointment_id}`,
    };

    console.log("mercadopago-create-payment: back_urls", backUrls);

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
      back_urls: backUrls,
      auto_return: "approved",
      notification_url: webhookUrl,
      external_reference: appointment_id,
      statement_descriptor: "AGENDALI",
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
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
        JSON.stringify({ error: "Falha ao criar pagamento no Mercado Pago" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log("mercadopago-create-payment: preference created", mpData.id);

    // Save payment record
    const { error: insertError } = await supabase.from("appointment_payments").insert({
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

    if (insertError) {
      console.error("Error saving appointment_payment:", insertError);
    }

    // Ensure appointment is in pending_payment status
    await supabase
      .from("appointments")
      .update({ status: "pending_payment" })
      .eq("id", appointment_id);

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
    return new Response(JSON.stringify({ error: "Erro interno ao processar pagamento" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
