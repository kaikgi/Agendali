import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://emkcaalgfutbukindxvy.supabase.co";
const secret = Deno.env.get("KIWIFY_WEBHOOK_SECRET") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

async function sendWebhook(payload: Record<string, unknown>) {
  const res = await fetch(`${supabaseUrl}/functions/v1/kiwify-webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-kiwify-secret": secret,
    },
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function checkAuthorization(email: string) {
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/check_signup_authorization`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": serviceKey,
      "Authorization": `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ p_email: email }),
  });
  return res.json();
}

Deno.test("pix_created should NOT authorize email", async () => {
  const testEmail = `test-pix-${Date.now()}@example.com`;
  const body = await sendWebhook({
    order_id: `test-pix-${Date.now()}`,
    webhook_event_type: "pix_created",
    Customer: { email: testEmail, full_name: "Teste PIX" },
    Product: { product_id: "8b362f00-efd2-11f0-bd88-6ba832508a8b", product_name: "Agendali" },
  });

  console.log("pix_created response:", JSON.stringify(body));
  assertEquals(body.ok, true);
  assertEquals(body.ignored, true, "pix_created should be ignored");

  const auth = await checkAuthorization(testEmail);
  console.log("Auth check:", JSON.stringify(auth));
  assertEquals(auth.authorized, false, "pix_created must NOT authorize email");
  console.log("✅ PASS: pix_created did NOT authorize");
});

Deno.test("order_approved should authorize email", async () => {
  const testEmail = `test-approved-${Date.now()}@example.com`;
  const body = await sendWebhook({
    order_id: `test-approved-${Date.now()}`,
    webhook_event_type: "order_approved",
    Customer: { email: testEmail, full_name: "Teste Approved" },
    Product: { product_id: "8b362f00-efd2-11f0-bd88-6ba832508a8b", product_name: "Agendali" },
  });

  console.log("order_approved response:", JSON.stringify(body));
  assertEquals(body.ok, true);
  assertEquals(body.processed, true, "order_approved should be processed");

  const auth = await checkAuthorization(testEmail);
  console.log("Auth check:", JSON.stringify(auth));
  assertEquals(auth.authorized, true, "order_approved MUST authorize email");
  console.log("✅ PASS: order_approved authorized email");
});
