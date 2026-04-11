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
    const { event_id, event_title } = await req.json();

    if (!event_id) {
      return new Response(
        JSON.stringify({ error: "event_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: existingRoom, error: lookupError } = await supabase
      .from("rooms")
      .select("id, event_id, event_title")
      .eq("event_id", event_id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (lookupError) throw lookupError;

    if (existingRoom) {
      return new Response(JSON.stringify({ room: existingRoom }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: room, error: createError } = await supabase
      .from("rooms")
      .insert({
        event_id,
        event_title: event_title || `Event ${event_id}`,
      })
      .select("id, event_id, event_title")
      .single();

    if (createError) throw createError;

    return new Response(JSON.stringify({ room }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
