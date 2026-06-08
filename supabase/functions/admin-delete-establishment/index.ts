import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const respond = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return respond({ error: "Missing auth" }, 401);

    // Verify caller
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return respond({ error: "Unauthorized" }, 401);

    // Check admin
    const adminClient = createClient(url, serviceKey);
    const { data: adminRow } = await adminClient
      .from("admin_users")
      .select("id, level")
      .eq("user_id", user.id)
      .single();

    if (!adminRow || adminRow.level !== "master") {
      return respond({ error: "Forbidden: master admin required" }, 403);
    }

    // Parse body
    const {
      establishment_id,
      delete_auth_user = false,
      delete_storage_files = false,
    } = await req.json();

    if (!establishment_id) {
      return respond({ error: "establishment_id required" }, 400);
    }

    // Fetch establishment
    const { data: est, error: estErr } = await adminClient
      .from("establishments")
      .select("id, name, slug, owner_user_id")
      .eq("id", establishment_id)
      .single();

    if (estErr || !est) {
      return respond({ error: "Establishment not found" }, 404);
    }

    // Create a deletion job record
    const { data: job } = await adminClient
      .from("establishment_deletion_jobs")
      .insert({
        establishment_id: est.id,
        owner_user_id: est.owner_user_id,
        requested_by_admin_user_id: user.id,
        status: "running",
      })
      .select("id")
      .single();

    const steps: string[] = [];

    try {
      // 1. Delete ratings
      const { count: ratingsCount } = await adminClient
        .from("ratings")
        .delete({ count: "exact" })
        .eq("establishment_id", est.id);
      steps.push(`ratings: ${ratingsCount ?? 0}`);

      // 2. Delete appointments
      const { count: aptsCount } = await adminClient
        .from("appointments")
        .delete({ count: "exact" })
        .eq("establishment_id", est.id);
      steps.push(`appointments: ${aptsCount ?? 0}`);

      // 3. Delete professional_services (via professionals)
      const { data: profs } = await adminClient
        .from("professionals")
        .select("id")
        .eq("establishment_id", est.id);
      const profIds = (profs || []).map((p) => p.id);
      if (profIds.length > 0) {
        await adminClient
          .from("professional_services")
          .delete()
          .in("professional_id", profIds);
        await adminClient
          .from("professional_hours")
          .delete()
          .in("professional_id", profIds);
      }

      // 4. Delete professionals
      const { count: profsCount } = await adminClient
        .from("professionals")
        .delete({ count: "exact" })
        .eq("establishment_id", est.id);
      steps.push(`professionals: ${profsCount ?? 0}`);

      // 5. Delete customers
      const { count: custCount } = await adminClient
        .from("customers")
        .delete({ count: "exact" })
        .eq("establishment_id", est.id);
      steps.push(`customers: ${custCount ?? 0}`);

      // 6. Delete services
      const { count: svcCount } = await adminClient
        .from("services")
        .delete({ count: "exact" })
        .eq("establishment_id", est.id);
      steps.push(`services: ${svcCount ?? 0}`);

      // 7. Delete business_hours
      await adminClient
        .from("business_hours")
        .delete()
        .eq("establishment_id", est.id);

      // 8. Delete time_blocks
      await adminClient
        .from("time_blocks")
        .delete()
        .eq("establishment_id", est.id);

      // 9. Delete recurring_time_blocks
      await adminClient
        .from("recurring_time_blocks")
        .delete()
        .eq("establishment_id", est.id);

      // 10. Delete establishment_members
      await adminClient
        .from("establishment_members")
        .delete()
        .eq("establishment_id", est.id);

      // 11. Delete subscriptions for owner
      await adminClient
        .from("subscriptions")
        .delete()
        .eq("owner_user_id", est.owner_user_id);

      // 12. Delete the establishment itself
      const { error: delEstErr } = await adminClient
        .from("establishments")
        .delete()
        .eq("id", est.id);
      if (delEstErr) throw new Error(`Failed to delete establishment: ${delEstErr.message}`);
      steps.push("establishment: deleted");

      // 13. Optionally delete storage files
      if (delete_storage_files) {
        try {
          const { data: files } = await adminClient.storage
            .from("uploads")
            .list(est.id);
          if (files && files.length > 0) {
            const paths = files.map((f) => `${est.id}/${f.name}`);
            await adminClient.storage.from("uploads").remove(paths);
            steps.push(`storage: ${paths.length} files removed`);
          } else {
            steps.push("storage: no files");
          }
        } catch (e) {
          steps.push(`storage: error - ${e.message}`);
        }
      }

      // 14. Optionally delete auth user
      if (delete_auth_user) {
        try {
          // Delete profile first
          await adminClient.from("profiles").delete().eq("id", est.owner_user_id);
          const { error: authErr } = await adminClient.auth.admin.deleteUser(est.owner_user_id);
          if (authErr) {
            steps.push(`auth_user: error - ${authErr.message}`);
          } else {
            steps.push("auth_user: deleted");
          }
        } catch (e) {
          steps.push(`auth_user: error - ${e.message}`);
        }
      }

      // Update job status
      if (job) {
        await adminClient
          .from("establishment_deletion_jobs")
          .update({ status: "done", completed_at: new Date().toISOString() })
          .eq("id", job.id);
      }

      // Audit log
      await adminClient.from("admin_audit_logs").insert({
        admin_user_id: user.id,
        action: "hard_delete_establishment",
        target_establishment_id: est.id,
        target_owner_user_id: est.owner_user_id,
        metadata: { name: est.name, slug: est.slug, steps, delete_auth_user, delete_storage_files },
      });

      return respond({ success: true, steps });
    } catch (err) {
      // Update job with error
      if (job) {
        await adminClient
          .from("establishment_deletion_jobs")
          .update({
            status: "failed",
            error: err.message,
            completed_at: new Date().toISOString(),
          })
          .eq("id", job.id);
      }
      throw err;
    }
  } catch (err) {
    console.error("admin-delete-establishment error:", err);
    return respond({ error: err.message || "Internal error" }, 500);
  }
});
