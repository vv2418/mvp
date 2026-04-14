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
    // Parse optional event_titles from request body
    let eventTitles: Record<string, string> = {};
    try {
      const body = await req.json();
      eventTitles = body?.event_titles || {};
    } catch (_e) { /* no body is fine */ }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: swipeGroups, error: swipeErr } = await supabase
      .from("swipes")
      .select("event_id")
      .eq("direction", "right");

    if (swipeErr) throw swipeErr;

    const eventSwipes: Record<string, boolean> = {};
    for (const s of swipeGroups || []) {
      eventSwipes[s.event_id] = true;
    }
    const eventIds = Object.keys(eventSwipes);

    const { data: existingRooms, error: roomErr } = await supabase
      .from("rooms")
      .select("event_id")
      .in("event_id", eventIds.length > 0 ? eventIds : ["__none__"]);

    if (roomErr) throw roomErr;

    const existingEventIds = new Set((existingRooms || []).map((r: { event_id: string }) => r.event_id));
    const newEventIds = eventIds.filter((id) => !existingEventIds.has(id));

    let roomsCreated = 0;
    let usersAdded = 0;

    for (const eventId of newEventIds) {
      const { data: swipes, error: sErr } = await supabase
        .from("swipes")
        .select("user_id")
        .eq("event_id", eventId)
        .eq("direction", "right");

      if (sErr) throw sErr;
      if (!swipes || swipes.length < 2) continue;

      const uniqueUserIds = [...new Set((swipes || []).map((s: { user_id: string }) => s.user_id))];
      if (uniqueUserIds.length < 2) continue;

      let room: { id: string } | null = null;
      const ins = await supabase
        .from("rooms")
        .insert({ event_id: eventId, event_title: eventTitles[eventId] || `Event ${eventId}` })
        .select("id")
        .single();

      if (ins.error?.code === "23505") {
        const { data: existing } = await supabase.from("rooms").select("id").eq("event_id", eventId).maybeSingle();
        room = existing;
      } else if (ins.error) {
        throw ins.error;
      } else {
        room = ins.data;
      }

      if (!room) continue;

      const { data: currentMembers } = await supabase
        .from("room_users")
        .select("user_id")
        .eq("room_id", room.id);
      const alreadyIn = new Set((currentMembers || []).map((m: { user_id: string }) => m.user_id));
      const members = uniqueUserIds
        .filter((user_id) => !alreadyIn.has(user_id))
        .map((user_id) => ({ room_id: room.id, user_id }));

      if (members.length === 0) continue;

      const { error: mErr } = await supabase.from("room_users").insert(members);
      if (mErr) throw mErr;

      if (!ins.error) roomsCreated++;
      usersAdded += members.length;

      const eventTitle = eventTitles[eventId] || `Event ${eventId}`;

      // Seed AI icebreaker so the unread badge lights up immediately
      supabase.functions.invoke("chat-ai", {
        body: { room_id: room.id, event_title: eventTitle, mode: "icebreaker" },
      }).catch(() => {});

      // Notify all matched members (push / email)
      for (const member of members) {
        supabase.functions.invoke("send-notification", {
          body: {
            type: "matched",
            recipient_user_id: member.user_id,
            data: { event_title: eventTitle, room_id: room.id },
          },
        }).catch(() => {});
      }
    }

    // Add new swipers to existing rooms
    for (const eventId of Array.from(existingEventIds)) {
      const { data: room } = await supabase
        .from("rooms")
        .select("id, event_title")
        .eq("event_id", eventId)
        .maybeSingle();

      if (!room) continue;

      const { data: currentMembers } = await supabase
        .from("room_users")
        .select("user_id")
        .eq("room_id", room.id);

      const memberIds = new Set<string>((currentMembers || []).map((m: { user_id: string }) => m.user_id));

      const { data: swipes } = await supabase
        .from("swipes")
        .select("user_id")
        .eq("event_id", eventId)
        .eq("direction", "right");

      const uniqueIds = [...new Set((swipes || []).map((s: { user_id: string }) => s.user_id))];
      const newMembers = uniqueIds
        .filter((user_id) => !memberIds.has(user_id))
        .map((user_id) => ({ room_id: room.id, user_id }));

      if (newMembers.length > 0) {
        await supabase.from("room_users").insert(newMembers);
        usersAdded += newMembers.length;

        const eventTitle = eventTitles[eventId] || room.event_title || `Event ${eventId}`;

        // Seed a "someone new joined" AI nudge so existing members see the unread dot
        supabase.functions.invoke("chat-ai", {
          body: { room_id: room.id, event_title: eventTitle, mode: "revive" },
        }).catch(() => {});

        for (const newMember of newMembers) {
          // Tell existing members someone joined
          for (const existingId of Array.from(memberIds)) {
            supabase.functions.invoke("send-notification", {
              body: {
                type: "new_member",
                recipient_user_id: existingId,
                data: { event_title: eventTitle, room_id: room.id, new_member_name: "Someone new" },
              },
            }).catch(() => {});
          }
          // Tell the new member they were matched
          supabase.functions.invoke("send-notification", {
            body: {
              type: "matched",
              recipient_user_id: newMember.user_id,
              data: { event_title: eventTitle, room_id: room.id },
            },
          }).catch(() => {});
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, roomsCreated, usersAdded }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
