import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getEventIcebreaker(eventTitle: string): string {
  const lower = eventTitle.toLowerCase();
  if (lower.includes("music") || lower.includes("concert") || lower.includes("dj"))
    return `Welcome to the "${eventTitle}" room! 🎵 I'm here to help break the ice. What's a song that's been on repeat for you lately? Anyone been to a similar show before?`;
  if (lower.includes("food") || lower.includes("brunch") || lower.includes("dinner") || lower.includes("taco"))
    return `Hey foodies! Welcome to "${eventTitle}" 🍽️ What's your go-to comfort food? And does anyone have a favorite spot near the venue?`;
  if (lower.includes("tech") || lower.includes("hack") || lower.includes("startup") || lower.includes("pitch"))
    return `Welcome to "${eventTitle}"! 💻 What are you working on right now? Any cool side projects or ideas you're excited about?`;
  if (lower.includes("fitness") || lower.includes("run") || lower.includes("yoga") || lower.includes("hike"))
    return `Hey everyone! Welcome to "${eventTitle}" 💪 What's your fitness routine like? Anyone done an event like this before?`;
  if (lower.includes("comedy") || lower.includes("standup") || lower.includes("improv"))
    return `Welcome to "${eventTitle}"! 😂 Who's your favorite comedian right now? This is going to be a great time!`;
  if (lower.includes("art") || lower.includes("gallery") || lower.includes("museum"))
    return `Hey art lovers! Welcome to "${eventTitle}" 🎨 What kind of art are you into? Anyone been to this gallery before?`;
  if (lower.includes("game") || lower.includes("gaming") || lower.includes("board"))
    return `Welcome to "${eventTitle}"! 🎮 What games are you into right now? Let's get to know each other before we meet up!`;
  if (lower.includes("salsa") || lower.includes("dance"))
    return `Welcome to "${eventTitle}"! 💃 Who's ready to hit the dance floor? Any experienced dancers here or are we all beginners?`;
  if (lower.includes("movie") || lower.includes("film") || lower.includes("cinema"))
    return `Welcome to "${eventTitle}"! 🎬 What's the last movie that blew your mind? Let's get to know each other's taste!`;
  return `Welcome to the "${eventTitle}" room! 🔥 I'm Rekindled AI — here to help you all connect before the event. What are you most excited about for this one?`;
}

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

    // Use service role to bypass RLS for room + message + membership operations
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get the calling user's ID from their JWT (if authenticated)
    let callerId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user } } = await userClient.auth.getUser();
      callerId = user?.id ?? null;
    }

    const { data: existingRoom, error: lookupError } = await supabase
      .from("rooms")
      .select("id, event_id, event_title")
      .eq("event_id", event_id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (lookupError) throw lookupError;

    let room = existingRoom;

    if (room) {
      // Room exists — ensure it has an icebreaker message
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("room_id", room.id);

      if (!count || count === 0) {
        const title = room.event_title || `Event ${room.event_id}`;
        await supabase.from("messages").insert({
          room_id: room.id,
          user_id: null,
          sender_name: "Rekindled AI",
          content: getEventIcebreaker(title),
          is_ai: true,
        });
      }
    } else {
      // Create new room
      const { data: newRoom, error: createError } = await supabase
        .from("rooms")
        .insert({
          event_id,
          event_title: event_title || `Event ${event_id}`,
        })
        .select("id, event_id, event_title")
        .single();

      if (createError) throw createError;
      room = newRoom;

      // Seed icebreaker message via service role (bypasses RLS)
      const title = room.event_title || `Event ${room.event_id}`;
      await supabase.from("messages").insert({
        room_id: room.id,
        user_id: null,
        sender_name: "Rekindled AI",
        content: getEventIcebreaker(title),
        is_ai: true,
      });
    }

    // Add the calling user to room_users if they aren't already a member
    if (callerId) {
      await supabase
        .from("room_users")
        .upsert({ room_id: room.id, user_id: callerId }, { onConflict: "room_id,user_id", ignoreDuplicates: true });
    }

    // Also add all users who right-swiped this event but aren't members yet
    const { data: swipers } = await supabase
      .from("swipes")
      .select("user_id")
      .eq("event_id", event_id)
      .eq("direction", "right");

    if (swipers && swipers.length > 0) {
      const { data: currentMembers } = await supabase
        .from("room_users")
        .select("user_id")
        .eq("room_id", room.id);

      const memberSet = new Set((currentMembers || []).map((m: { user_id: string }) => m.user_id));
      const newMembers = swipers
        .filter((s: { user_id: string }) => !memberSet.has(s.user_id))
        .map((s: { user_id: string }) => ({ room_id: room.id, user_id: s.user_id }));

      if (newMembers.length > 0) {
        await supabase.from("room_users").insert(newMembers);
      }
    }

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
