import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Local fallback only — used when ensure-room has to seed a chat without
 * going through the chat-ai edge function. Kept intentionally short and
 * casual so it reads like a real group-chat opener instead of an AI welcome.
 */
function getEventIcebreaker(eventTitle: string): string {
  return `new chat for "${eventTitle}" — say hi 👋`;
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
      // Do not create a room until at least two people have liked this event
      const { data: likers, error: likersErr } = await supabase
        .from("swipes")
        .select("user_id")
        .eq("event_id", event_id)
        .eq("direction", "right");

      if (likersErr) throw likersErr;
      const uniqueLikers = new Set((likers || []).map((s: { user_id: string }) => s.user_id));
      if (uniqueLikers.size < 2) {
        return new Response(JSON.stringify({ room: null, need_more_likers: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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
      const uniqueSwipers = [...new Set((swipers || []).map((s: { user_id: string }) => s.user_id))];
      const newMembers = uniqueSwipers
        .filter((user_id) => !memberSet.has(user_id))
        .map((user_id) => ({ room_id: room.id, user_id }));

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
