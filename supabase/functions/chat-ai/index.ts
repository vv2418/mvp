import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { room_id, event_title, recent_messages, user_id } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build conversation context from recent messages
    const convoContext = recent_messages
      .map((m: { sender_name: string; content: string }) => `${m.sender_name}: ${m.content}`)
      .join("\n");

    const systemPrompt = `You are Rekindled AI, the mischievous group chat bot for the event "${event_title}". 

Your job is to keep the conversation alive and entertaining by dropping a SHORT, spicy "rage bait" or hot-take style message after each user message. 

Rules:
- Keep it SHORT (1-2 sentences max)
- Be playful and provocative, NOT mean or offensive
- Reference the specific event or what people just said
- Use controversial-but-fun opinions (e.g. "pineapple on pizza is elite", "morning people are unhinged")
- Throw in relevant emojis
- Sometimes ask a polarizing question to spark debate
- Never be racist, sexist, or truly hurtful — keep it lighthearted banter
- Make it relevant to the conversation topic and the event "${event_title}"`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Here's the recent conversation:\n\n${convoContext}\n\nGenerate a short, spicy rage-bait response to keep the conversation going.`,
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited, try again later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const aiContent =
      data.choices?.[0]?.message?.content || "Okay that's a hot take… anyone disagree? 🔥";

    // Insert AI message into the DB using service role (bypasses RLS)
    const { error: insertError } = await supabase.from("messages").insert({
      room_id,
      user_id,
      sender_name: "Rekindled AI",
      content: aiContent,
      is_ai: true,
    });

    if (insertError) {
      console.error("Insert error:", insertError);
      throw insertError;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chat-ai error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
