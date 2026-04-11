import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ChatMode = "reply" | "revive";

interface ContextMessage {
  sender_name: string;
  content: string;
}

function buildSystemPrompt(mode: ChatMode, eventTitle: string): string {
  const sharedRules = `
You are Rekindled AI, the group chat bot for the event "${eventTitle}".

Rules:
- Keep it SHORT (1-2 sentences max)
- Sound warm, social, and specific to the event
- Reference the event or recent conversation when possible
- Ask engaging questions people can answer quickly
- Never be mean, creepy, or offensive
- Avoid repeating the same opener twice in a row`;

  if (mode === "revive") {
    return `${sharedRules}
- The room has gone quiet, so your job is to restart the conversation naturally
- Introduce a fresh, relevant topic or easy prompt people can jump into
- Make it feel like a thoughtful host, not a spammy bot`;
  }

  return `${sharedRules}
- Your job is to keep the conversation alive with a playful, lightly provocative take
- You can use fun "hot take" energy, but keep it light and friendly
- End with a question when it helps keep the thread moving`;
}

function buildUserPrompt(
  mode: ChatMode,
  eventTitle: string,
  convoContext: string,
  idleAfterMinutes: number,
): string {
  if (mode === "revive") {
    return `The "${eventTitle}" room has been quiet for at least ${idleAfterMinutes} minutes.

Recent conversation:
${convoContext || "No recent messages."}

Write one short, relevant message that re-opens the conversation with a fresh topic people would actually want to answer.`;
  }

  return `Here's the recent conversation:

${convoContext}

Generate a short, playful response that keeps the conversation moving.`;
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

    if (!roomId) throw new Error("room_id is required");

    const AI_GATEWAY_API_KEY = Deno.env.get("AI_GATEWAY_API_KEY");
    if (!AI_GATEWAY_API_KEY) throw new Error("AI_GATEWAY_API_KEY not configured");

    const AI_GATEWAY_URL = Deno.env.get("AI_GATEWAY_URL");
    if (!AI_GATEWAY_URL) throw new Error("AI_GATEWAY_URL not configured");

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

    if (requestedMode === "revive" || recentMessages.length === 0) {
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
          model: "gpt-5-mini",
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
                idleAfterMinutes,
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
    const aiContent =
      data.choices?.[0]?.message?.content ||
      "Quick question for the group: what's everyone most excited about for this event?";

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
