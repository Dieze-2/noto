import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[EXPIRE-TRIALS] ${step}${d}`);
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const now = new Date().toISOString();

    // 1. Find expired trials (trial_end in the past, no cancel_at yet — meaning still active trial)
    const { data: expired, error: fetchErr } = await supabase
      .from("coach_subscriptions")
      .select("coach_id, plan, trial_end")
      .not("trial_end", "is", null)
      .lt("trial_end", now);

    if (fetchErr) {
      logStep("ERROR fetching expired trials", { message: fetchErr.message });
      throw fetchErr;
    }

    logStep("Expired trials found", { count: expired?.length ?? 0 });

    if (!expired || expired.length === 0) {
      return new Response(JSON.stringify({ expired: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let revokedCount = 0;

    for (const sub of expired) {
      logStep("Processing expired trial", { coach_id: sub.coach_id, trial_end: sub.trial_end });

      // Check if the coach now has a paid Stripe subscription
      // If they have no cancel_at and trial is expired, revoke access
      // We delete the subscription row and remove the coach role

      // Delete coach_subscription
      const { error: delSubErr } = await supabase
        .from("coach_subscriptions")
        .delete()
        .eq("coach_id", sub.coach_id);

      if (delSubErr) {
        logStep("ERROR deleting subscription", { coach_id: sub.coach_id, message: delSubErr.message });
        continue;
      }

      // Remove coach role
      const { error: delRoleErr } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", sub.coach_id)
        .eq("role", "coach");

      if (delRoleErr) {
        logStep("ERROR removing coach role", { coach_id: sub.coach_id, message: delRoleErr.message });
      } else {
        revokedCount++;
        logStep("Revoked coach access", { coach_id: sub.coach_id });
      }
    }

    logStep("Function completed", { total: expired.length, revoked: revokedCount });

    return new Response(
      JSON.stringify({ expired: expired.length, revoked: revokedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
