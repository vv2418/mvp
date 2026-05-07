import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ChatMode = "icebreaker" | "welcome_member" | "reply" | "revive";

interface ContextMessage {
  sender_name: string;
  content: string;
}

/**
 * Shared persona — talks like a regular person already in the chat, not a
 * cheerful host or assistant. The goal is for the message to feel
 * indistinguishable from any of the other group members.
 */
const PERSONA = `
You are "Rekindled" — you write group-chat messages on behalf of the app, but
you should sound like a chill regular person who is also going to the event,
not like an AI, host, MC, or customer-support bot.

How a real person texts in a group:
- Lowercase by default. capitalize only for emphasis.
- Use natural contractions ("we're", "y'all", "gonna", "kinda", "tbh").
- It's okay to start mid-thought ("ok so...", "wait...", "yo").
- Sometimes just a reaction or a vibe. you do NOT have to ask a question.
- Keep it ONE short sentence. occasionally two if the second is just a fragment.
- AT MOST one emoji per message, and only when it actually fits. usually zero.
- Never use em-dashes (—). use "..." or ", " or split into two short sentences instead.
- Never use forced wordplay, alliteration, or "cute" coined phrases
  (no "bubble-splashers", "soggy glory", "towel-duty", etc.).
- Never sound like a brand voice ("legendary energy!", "let's gooo team!", "love that for you").
- Never narrate your own role ("as your host...", "I'm here to help...", "let me know!").
- Don't ask "quick one:" / "real quick" / "quick question" framings.
- Don't end every message with a question. Most messages should not.

Hard safety rules:
- Never insult anyone's appearance, identity, intelligence, race, ethnicity,
  religion, gender, sexuality, disability, body, money, or background.
- Never use slurs, harassment, or threats.
- Keep it kind. tease about preferences (seats, arrival time, food order)
  only if it actually fits, and only lightly.
`.trim();

function buildSystemPrompt(mode: ChatMode, eventTitle: string): string {
  if (mode === "icebreaker") {
    return `${PERSONA}

You are writing the FIRST message in a brand-new group chat for the event:
"${eventTitle}".

A few people just got matched into this chat because they all said they're going.
Write one short, casual opener that fits a real group chat — like a friend who
just got added and is breaking the ice. Examples of the *style* (do NOT copy):
  • "ok matched chat for ${eventTitle} 👀"
  • "yo who else is going to this"
  • "didn't expect a chat for this lol. excited tho"
  • "first time here for me, anyone been before?"

Pick ONE message. Do not list options. Do not greet "everyone". Do not say
"welcome to the chat". Do not introduce yourself. Do not mention the app.`;
  }

  if (mode === "welcome_member") {
    return `${PERSONA}

You are writing a SHORT message acknowledging that someone new just joined
the existing group chat for the event "${eventTitle}".

Write it like a regular member of the group casually noticing the new person.
Examples of the *style* (do NOT copy):
  • "yo {name} 👋"
  • "ayy {name} welcome"
  • "{name} joined, sick"
  • "we got {name} now, that's 4 of us going"

Pick ONE message. It MUST mention the new person by their first name.
Do not greet the whole group. Do not ask the new person a question.
Do not introduce yourself or the app.`;
  }

  // Legacy modes — kept for back-compat. Same human persona.
  if (mode === "revive") {
    return `${PERSONA}

The "${eventTitle}" group chat has gone quiet. Drop ONE casual line that fits
a real friend trying to restart a thread without making a big deal of the
silence. Don't say "the chat has been quiet". Don't apologize.`;
  }

  return `${PERSONA}

Reply naturally to the most recent messages in the "${eventTitle}" group chat.
One short line. Don't sound like you're moderating.`;
}

function buildUserPrompt(
  mode: ChatMode,
  eventTitle: string,
  convoContext: string,
  newMemberNames: string[],
  memberNames: string[],
): string {
  if (mode === "icebreaker") {
    const who = memberNames.length > 0
      ? `People in the chat (don't list them by name, just for your awareness): ${memberNames.join(", ")}.`
      : "";
    return `Event: "${eventTitle}".
${who}

Write the first message in this brand-new group chat. One short casual line.`;
  }

  if (mode === "welcome_member") {
    const namesLine = newMemberNames.length > 0
      ? `New person who just joined: ${newMemberNames[0]}${
          newMemberNames.length > 1 ? ` (and ${newMemberNames.length - 1} other(s): ${newMemberNames.slice(1).join(", ")})` : ""
        }.`
      : "Someone new just joined the chat.";
    const total = memberNames.length > 0 ? `Total members now: ${memberNames.length}.` : "";
    return `Event: "${eventTitle}".
${namesLine}
${total}

Write one short casual line acknowledging ${newMemberNames[0] || "them"} by first name.`;
  }

  if (mode === "revive") {
    return `Event: "${eventTitle}".

Recent messages:
${convoContext || "(no recent messages)"}

Write one short casual line to nudge the conversation back. Do not mention silence.`;
  }

  return `Event: "${eventTitle}".

Recent messages:
${convoContext}

Reply with one short, natural line.`;
}

function firstNameOf(full: string): string {
  return full.trim().split(/\s+/)[0] || full;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const roomId = body?.room_id as string | undefined;
    const providedEventTitle = body?.event_title as string | undefined;
    const providedRecentMessages = (body?.recent_messages ?? []) as ContextMessage[];
    const requestedMode = (body?.mode ?? "reply") as ChatMode;
    const idleAfterMinutes = Math.max(1, Number(body?.idle_after_minutes ?? 10));
    const providedMemberNames = (body?.member_names ?? []) as string[];
    const providedNewMemberNames = (body?.new_member_names ?? []) as string[];

    if (!roomId) throw new Error("room_id is required");

    const AI_GATEWAY_API_KEY = Deno.env.get("AI_GATEWAY_API_KEY");
    if (!AI_GATEWAY_API_KEY) throw new Error("AI_GATEWAY_API_KEY not configured");

    const AI_GATEWAY_URL = Deno.env.get("AI_GATEWAY_URL");
    if (!AI_GATEWAY_URL) throw new Error("AI_GATEWAY_URL not configured");

    // Keep the model configurable so gateway/provider swaps don't require code edits.
    const AI_MODEL = Deno.env.get("AI_MODEL") || "gpt-5-mini";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("event_title")
      .eq("id", roomId)
      .maybeSingle();

    if (roomError) throw roomError;

    const eventTitle = providedEventTitle || room?.event_title || "this event";

    let recentMessages = providedRecentMessages;
    let latestMessage:
      | {
          created_at: string;
          is_ai: boolean;
        }
      | undefined;
    let latestHumanMessage:
      | {
          created_at: string;
          is_ai: boolean;
        }
      | undefined;

    // Only the legacy modes need conversation context.
    if (requestedMode === "revive" || (requestedMode === "reply" && recentMessages.length === 0)) {
      const { data: messageRows, error: messageError } = await supabase
        .from("messages")
        .select("created_at, is_ai, sender_name, content")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(12);

      if (messageError) throw messageError;

      latestMessage = messageRows?.[0];
      latestHumanMessage = messageRows?.find((message) => !message.is_ai);
      recentMessages = (messageRows ?? [])
        .slice()
        .reverse()
        .map((message) => ({
          sender_name: message.sender_name,
          content: message.content,
        }));
    }

    if (requestedMode === "revive") {
      if (!latestMessage) {
        return new Response(
          JSON.stringify({ success: true, skipped: "no_messages" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const latestTimestamp = new Date(latestMessage.created_at).getTime();
      const idleForMs = Date.now() - latestTimestamp;
      const idleThresholdMs = idleAfterMinutes * 60 * 1000;

      if (!Number.isFinite(latestTimestamp) || idleForMs < idleThresholdMs) {
        return new Response(
          JSON.stringify({ success: true, skipped: "not_idle" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (!latestHumanMessage) {
        return new Response(
          JSON.stringify({ success: true, skipped: "no_human_messages" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const memberNames = providedMemberNames.map(firstNameOf).filter(Boolean);
    const newMemberNames = providedNewMemberNames.map(firstNameOf).filter(Boolean);

    const convoContext = recentMessages
      .map((message) => `${message.sender_name}: ${message.content}`)
      .join("\n");

    const response = await fetch(
      `${AI_GATEWAY_URL.replace(/\/$/, "")}/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AI_GATEWAY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: AI_MODEL,
          temperature: 0.95,
          messages: [
            {
              role: "system",
              content: buildSystemPrompt(requestedMode, eventTitle),
            },
            {
              role: "user",
              content: buildUserPrompt(
                requestedMode,
                eventTitle,
                convoContext,
                newMemberNames,
                memberNames,
              ),
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited, try again later" }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted" }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      throw new Error("AI gateway error");
    }

    const data = await response.json();

    let aiContent: string = data.choices?.[0]?.message?.content ?? "";

    // Sanitise: strip surrounding quotes the model often adds, kill em-dashes,
    // collapse whitespace, and clamp length so a runaway response never blows
    // up the chat UI.
    aiContent = aiContent
      .trim()
      .replace(/^["'`]+|["'`]+$/g, "")
      .replace(/[—–]/g, "...")
      .replace(/\s+/g, " ")
      .slice(0, 240);

    if (!aiContent) {
      // Fallback if the model returned nothing — pick something safe per mode.
      if (requestedMode === "welcome_member" && newMemberNames[0]) {
        aiContent = `yo ${newMemberNames[0]} 👋`;
      } else if (requestedMode === "icebreaker") {
        aiContent = `ok new chat for ${eventTitle} 👀 who else is going`;
      } else {
        aiContent = `anyone here?`;
      }
    }

    const { error: insertError } = await supabase.from("messages").insert({
      room_id: roomId,
      user_id: null,
      sender_name: "Rekindled AI",
      content: aiContent,
      is_ai: true,
    });

    if (insertError) {
      console.error("Insert error:", insertError);
      throw insertError;
    }

    // Push notify all room members about AI message (fire-and-forget)
    const { data: roomUsers } = await supabase
      .from("room_users")
      .select("user_id")
      .eq("room_id", roomId);

    const notifyUrl = `${supabaseUrl}/functions/v1/send-notification`;
    const notifyKey = supabaseKey;

    for (const { user_id } of roomUsers ?? []) {
      fetch(notifyUrl, {
        method: "POST",
        headers: { "Authorization": `Bearer ${notifyKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "new_message",
          recipient_user_id: user_id,
          data: {
            event_title: eventTitle,
            room_id: roomId,
            sender_name: "Rekindled AI",
            message_count: 1,
          },
        }),
      }).catch(() => {});
    }

    return new Response(
      JSON.stringify({ success: true, mode: requestedMode }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("chat-ai error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
