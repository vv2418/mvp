import { createClient } from "@supabase/supabase-js";

/**
 * GET /.netlify/functions/api-metrics
 * Proxied as GET /api/metrics (see netlify.toml)
 *
 * Returns: { signups, active_users, waitlist, page_views }
 *
 * Required Netlify env vars:
 *   - VITE_SUPABASE_URL (or SUPABASE_URL)
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional (for GA4 page_views):
 *   - GA_PROPERTY_ID
 *   - GA_CLIENT_EMAIL
 *   - GA_PRIVATE_KEY
 */

// --- GA4 helpers ---

function base64url(input) {
  const str =
    typeof input === "string"
      ? Buffer.from(input).toString("base64")
      : Buffer.from(input).toString("base64");
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function getGoogleAccessToken(clientEmail, privateKeyPem) {
  const crypto = await import("node:crypto");
  const now = Math.floor(Date.now() / 1000);

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/analytics.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );

  const signingInput = `${header}.${payload}`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(signingInput);
  const signature = sign.sign(privateKeyPem, "base64url");

  const jwt = `${signingInput}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

async function fetchGA4PageViews(accessToken, propertyId) {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: "2020-01-01", endDate: "today" }],
        metrics: [{ name: "screenPageViews" }],
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GA4 API error: ${res.status} ${text}`);
  }

  const data = await res.json();
  return parseInt(data.rows?.[0]?.metricValues?.[0]?.value ?? "0", 10);
}

// --- Main handler ---

export const handler = async () => {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error:
          "Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      }),
    };
  }

  try {
    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    // DB metrics + GA4 page views in parallel
    const gaPropertyId = process.env.GA_PROPERTY_ID;
    const gaClientEmail = process.env.GA_CLIENT_EMAIL;
    const gaPrivateKey = process.env.GA_PRIVATE_KEY?.replace(/\\n/g, "\n");
    const gaConfigured = gaPropertyId && gaClientEmail && gaPrivateKey;

    const dbPromise = Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("swipes").select("user_id").gte("created_at", sevenDaysAgo),
      supabase
        .from("messages")
        .select("user_id")
        .eq("is_ai", false)
        .gte("created_at", sevenDaysAgo),
    ]);

    const gaPromise = gaConfigured
      ? getGoogleAccessToken(gaClientEmail, gaPrivateKey).then((token) =>
          fetchGA4PageViews(token, gaPropertyId),
        )
      : Promise.resolve(0);

    const [[signupsRes, swipeUsersRes, chatUsersRes], pageViews] =
      await Promise.all([dbPromise, gaPromise.catch((err) => {
        console.error("GA4 fetch failed (returning 0):", err);
        return 0;
      })]);

    const signups = signupsRes.count ?? 0;

    const uniqueActiveUsers = new Set();
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
      page_views: pageViews,
    };

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(metrics, null, 2),
    };
  } catch (err) {
    console.error("api-metrics error:", err);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
