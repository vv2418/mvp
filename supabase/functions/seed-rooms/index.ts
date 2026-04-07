import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TM_API_KEY = Deno.env.get("TICKETMASTER_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CITIES = ["New York", "Chicago", "San Francisco"];

const SEED_USERS = [
  { name: "Alex Rivera",      email: "alex.rivera@rekindle.app" },
  { name: "Jordan Kim",       email: "jordan.kim@rekindle.app" },
  { name: "Morgan Chen",      email: "morgan.chen@rekindle.app" },
  { name: "Taylor Brooks",    email: "taylor.brooks@rekindle.app" },
  { name: "Casey Nguyen",     email: "casey.nguyen@rekindle.app" },
  { name: "Riley Patel",      email: "riley.patel@rekindle.app" },
  { name: "Avery Johnson",    email: "avery.johnson@rekindle.app" },
  { name: "Quinn Martinez",   email: "quinn.martinez@rekindle.app" },
  { name: "Drew Thompson",    email: "drew.thompson@rekindle.app" },
  { name: "Sage Williams",    email: "sage.williams@rekindle.app" },
  { name: "Blake Anderson",   email: "blake.anderson@rekindle.app" },
  { name: "Skylar Lee",       email: "skylar.lee@rekindle.app" },
  { name: "Parker Davis",     email: "parker.davis@rekindle.app" },
  { name: "Reese Garcia",     email: "reese.garcia@rekindle.app" },
  { name: "Finley Wilson",    email: "finley.wilson@rekindle.app" },
  { name: "Emerson Taylor",   email: "emerson.taylor@rekindle.app" },
  { name: "Rowan Moore",      email: "rowan.moore@rekindle.app" },
  { name: "Harley Jackson",   email: "harley.jackson@rekindle.app" },
  { name: "Peyton White",     email: "peyton.white@rekindle.app" },
  { name: "Dakota Harris",    email: "dakota.harris@rekindle.app" },
  { name: "Lennon Clark",     email: "lennon.clark@rekindle.app" },
  { name: "Shiloh Lewis",     email: "shiloh.lewis@rekindle.app" },
  { name: "Remy Robinson",    email: "remy.robinson@rekindle.app" },
  { name: "Phoenix Walker",   email: "phoenix.walker@rekindle.app" },
  { name: "Indigo Hall",      email: "indigo.hall@rekindle.app" },
  { name: "Zion Allen",       email: "zion.allen@rekindle.app" },
  { name: "River Young",      email: "river.young@rekindle.app" },
  { name: "Marlowe King",     email: "marlowe.king@rekindle.app" },
  { name: "Sable Wright",     email: "sable.wright@rekindle.app" },
  { name: "Nico Scott",       email: "nico.scott@rekindle.app" },
];

interface TMEvent {
  id: string;
  name: string;
}

async function fetchCityEvents(city: string): Promise<TMEvent[]> {
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TM_API_KEY}&city=${encodeURIComponent(city)}&size=5&sort=date,asc&startDateTime=${now}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  return json._embedded?.events ?? [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const log: string[] = [];

  try {
    // 1. Ensure all 30 users exist
    const { data: existingUsers } = await supabase.auth.admin.listUsers({ perPage: 200 });
    const existingEmails = new Set(existingUsers?.users?.map((u) => u.email) ?? []);

    const userIds: string[] = [];

    for (const u of SEED_USERS) {
      const existing = existingUsers?.users?.find((x) => x.email === u.email);
      if (existing) {
        userIds.push(existing.id);
        continue;
      }

      const { data: created, error } = await supabase.auth.admin.createUser({
        email: u.email,
        password: "Rekindle2026!",
        email_confirm: true,
        user_metadata: { name: u.name },
      });

      if (error || !created?.user) {
        log.push(`Skip ${u.name}: ${error?.message}`);
        continue;
      }

      userIds.push(created.user.id);

      await supabase.from("profiles").upsert({
        id: created.user.id,
        name: u.name,
        email: u.email,
      });
    }

    log.push(`Total users ready: ${userIds.length}`);

    // 2. Fetch events per city and swipe
    const eventTitles: Record<string, string> = {};
    let swipesInserted = 0;

    for (const city of CITIES) {
      const events = await fetchCityEvents(city);
      log.push(`${city}: ${events.length} events found`);

      for (const event of events.slice(0, 4)) {
        eventTitles[event.id] = event.name;

        // Distribute users across cities — all 30 swipe every event
        const swipeRows = userIds.map((uid) => ({
          user_id: uid,
          event_id: event.id,
          direction: "right",
        }));

        const { error } = await supabase
          .from("swipes")
          .upsert(swipeRows, { onConflict: "user_id,event_id" });

        if (!error) swipesInserted += swipeRows.length;
        log.push(`  "${event.name}" — ${swipeRows.length} swipes`);
      }
    }

    log.push(`Total swipes inserted: ${swipesInserted}`);

    // 3. Trigger matchmaking to create rooms
    const matchRes = await fetch(`${SUPABASE_URL}/functions/v1/matchmaking`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "apikey": SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({ event_titles: eventTitles }),
    });
    const matchJson = await matchRes.json();
    log.push(`Matchmaking result: ${JSON.stringify(matchJson)}`);

    return new Response(
      JSON.stringify({ success: true, usersReady: userIds.length, log }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message, log }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
