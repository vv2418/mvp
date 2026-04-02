import { createClient } from "@supabase/supabase-js";

/**
 * GET /.netlify/functions/user-count
 * Proxied as GET /api/user-count (see netlify.toml)
 *
 * Counts `public.profiles` rows (one row per signed-up user when profiles are synced).
 * Requires Netlify env:
 *   - VITE_SUPABASE_URL or SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY (never expose to the client)
 */
export const handler = async () => {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY on Netlify",
      }),
    };
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { count, error } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });

  if (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error.message }),
    };
  }

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify({ user_count: count ?? 0 }),
  };
};
