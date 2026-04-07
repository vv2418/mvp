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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const [signupsRes, swipeUsersRes, chatUsersRes] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase
        .from("swipes")
        .select("user_id")
        .gte("created_at", sevenDaysAgo),
      supabase
        .from("messages")
        .select("user_id")
        .eq("is_ai", false)
        .gte("created_at", sevenDaysAgo),
    ]);

    const signups = signupsRes.count ?? 0;

    const uniqueActiveUsers = new Set<string>();
    for (const row of swipeUsersRes.data ?? []) {
      if (row.user_id) uniqueActiveUsers.add(row.user_id);
    }
    for (const row of chatUsersRes.data ?? []) {
      if (row.user_id) uniqueActiveUsers.add(row.user_id);
    }

    const metrics = {
      signups,
      active_users: uniqueActiveUsers.size,
      waitlist: 0,
      page_views: 0,
    };

    return new Response(JSON.stringify(metrics, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("api-metrics error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
