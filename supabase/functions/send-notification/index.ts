import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") || "https://rekindled.netlify.app";
const FROM = "Rekindled <onboarding@resend.dev>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Email HTML builder (kept but disabled) ───────────────────────────────────

function buildHtml({
  preheader,
  headline,
  bodyLines,
  ctaText,
  ctaUrl,
  eventTitle,
  eventDate,
  eventLocation,
  eventImage,
  signoff,
}: {
  preheader: string;
  headline: string;
  bodyLines: string[];
  ctaText: string;
  ctaUrl: string;
  eventTitle: string;
  eventDate?: string;
  eventLocation?: string;
  eventImage?: string;
  signoff?: string;
}): string {
  const eventIconHtml = eventImage
    ? `<img src="${eventImage}" alt="${eventTitle}" width="40" height="40"
          style="width:40px;height:40px;border-radius:10px;object-fit:cover;display:block;" />`
    : `<div style="width:40px;height:40px;border-radius:10px;background:#E8470A;display:flex;align-items:center;justify-content:center;font-size:20px;line-height:40px;text-align:center;">🔥</div>`;

  const metaLine = [eventDate, eventLocation].filter(Boolean).join(" · ");

  const bodyParagraphs = bodyLines
    .map((line) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151;">${line}</p>`)
    .join("");

  const signoffBlock = signoff
    ? `<p style="margin:24px 0 0;font-size:15px;line-height:1.7;color:#374151;">
        Cheers,<br/>
        <strong>${signoff}</strong>
       </p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width" />
  <title>${headline}</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
    style="background:#ffffff;padding:40px 20px 48px;max-width:640px;margin:0 auto;">
    <tr><td>
      <table role="presentation" cellpadding="0" cellspacing="0"
        style="width:100%;border:1px solid #E5E7EB;border-radius:14px;margin-bottom:36px;">
        <tr><td style="padding:16px 20px;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:top;padding-right:14px;">${eventIconHtml}</td>
              <td style="vertical-align:middle;">
                <p style="margin:0 0 2px;font-size:15px;font-weight:700;color:#111827;">${eventTitle}</p>
                ${metaLine ? `<p style="margin:0;font-size:13px;color:#6B7280;">${metaLine}</p>` : ""}
              </td>
              <td style="vertical-align:middle;text-align:right;padding-left:12px;">
                <a href="${ctaUrl}" style="font-size:18px;color:#9CA3AF;text-decoration:none;">↗</a>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
      <h1 style="margin:0 0 24px;font-size:24px;font-weight:800;line-height:1.3;color:#111827;">${headline}</h1>
      ${bodyParagraphs}
      ${signoffBlock}
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:32px;">
        <tr><td style="border-radius:10px;background:#E8470A;">
          <a href="${ctaUrl}" style="display:block;padding:13px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${ctaText}</a>
        </td></tr>
      </table>
      <div style="height:1px;background:#F3F4F6;margin:40px 0;"></div>
      <p style="margin:0 0 6px;font-size:16px;font-weight:800;color:#9CA3AF;">🔥 rekindled</p>
      <p style="margin:0;font-size:12px;color:#9CA3AF;">
        You received this because you have email notifications on.
        &nbsp;<a href="${APP_URL}/profile" style="color:#9CA3AF;text-decoration:underline;">Unsubscribe</a>
      </p>
    </td></tr>
  </table>
</body>
</html>`;
}

type NotificationType = "matched" | "new_member" | "new_message";

interface NotificationData {
  event_title: string;
  event_image?: string;
  event_date?: string;
  event_location?: string;
  room_id: string;
  sender_name?: string;
  new_member_name?: string;
  message_count?: number;
  recipient_name?: string;
}

function buildEmail(type: NotificationType, data: NotificationData) {
  const chatUrl = `${APP_URL}/chat/${data.room_id}`;
  const name = data.recipient_name ? `, ${data.recipient_name.split(" ")[0]}` : "";

  if (type === "matched") {
    return {
      subject: `You've got people for ${data.event_title} 🔥`,
      html: buildHtml({
        preheader: `Someone else just liked ${data.event_title} — meet them before the night.`,
        headline: `Your people found you${name}.`,
        bodyLines: [
          `Someone else just liked <strong>${data.event_title}</strong> — which means you're both going.`,
          `We put you in a group chat so you can connect before the event.`,
          `Go say hi. 👋`,
        ],
        ctaText: "Open the chat →", ctaUrl: chatUrl,
        eventTitle: data.event_title, eventDate: data.event_date,
        eventLocation: data.event_location, eventImage: data.event_image,
        signoff: "The Rekindled team",
      }),
    };
  }

  if (type === "new_member") {
    return {
      subject: `${data.new_member_name} joined your ${data.event_title} group`,
      html: buildHtml({
        preheader: `${data.new_member_name} is going to ${data.event_title} too.`,
        headline: `${data.new_member_name} just joined your group.`,
        bodyLines: [
          `<strong>${data.new_member_name}</strong> liked <strong>${data.event_title}</strong> and was added to your group chat.`,
          `Your crew is growing. Go introduce yourself.`,
        ],
        ctaText: "Meet them →", ctaUrl: chatUrl,
        eventTitle: data.event_title, eventDate: data.event_date,
        eventLocation: data.event_location, eventImage: data.event_image,
        signoff: "The Rekindled team",
      }),
    };
  }

  const count = data.message_count || 1;
  return {
    subject: `Your ${data.event_title} group is talking`,
    html: buildHtml({
      preheader: `${data.sender_name} sent ${count > 1 ? `${count} messages` : "a message"} in your group.`,
      headline: `Don't leave them on read${name}.`,
      bodyLines: [
        `<strong>${data.sender_name}</strong> and others in your <strong>${data.event_title}</strong> group have been chatting.`,
        `You've got ${count > 1 ? `${count} new messages` : "a new message"} waiting.`,
      ],
      ctaText: "Jump in →", ctaUrl: chatUrl,
      eventTitle: data.event_title, eventDate: data.event_date,
      eventLocation: data.event_location, eventImage: data.event_image,
      signoff: "The Rekindled team",
    }),
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { type, recipient_user_id, data } = await req.json() as {
      type: NotificationType;
      recipient_user_id: string;
      data: NotificationData;
    };

    if (!type || !recipient_user_id || !data) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: { user }, error: userErr } = await adminClient.auth.admin.getUserById(recipient_user_id);
    if (userErr || !user?.email) {
      return new Response(JSON.stringify({ skipped: "no email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await adminClient
      .from("profiles")
      .select("email_notifications, name")
      .eq("id", recipient_user_id)
      .maybeSingle();

    const recipientName = profile?.name || user.user_metadata?.name || "";

    // ── Email (disabled for now) ───────────────────────────────────────────────
    // const { subject, html } = buildEmail(type, { ...data, recipient_name: recipientName });
    // await fetch("https://api.resend.com/emails", { ... });

    // ── Push notifications ─────────────────────────────────────────────────────
    let pushResult: { sent: number; errors: string[] } = { sent: 0, errors: [] };

    if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
      webpush.setVapidDetails(
        "mailto:support@rekindled.app",
        VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY,
      );

      const { data: subs } = await adminClient
        .from("push_subscriptions")
        .select("subscription")
        .eq("user_id", recipient_user_id);

      const { subject } = buildEmail(type, { ...data, recipient_name: recipientName });

      const pushPayload = JSON.stringify({
        title: subject,
        body: recipientName
          ? `Hey ${recipientName.split(" ")[0]}! Tap to open your group chat.`
          : "You have a new notification",
        url: `${APP_URL}/chat/${data.room_id}`,
        tag: `rekindled-${data.room_id}`,
      });

      const results = await Promise.allSettled(
        (subs || []).map((row) =>
          webpush.sendNotification(
            row.subscription as webpush.PushSubscription,
            pushPayload,
          )
        )
      );

      pushResult.sent = results.filter((r) => r.status === "fulfilled").length;
      pushResult.errors = results
        .filter((r) => r.status === "rejected")
        .map((r) => {
          const err = (r as PromiseRejectedResult).reason;
          return `${err?.message} (status=${err?.statusCode}, body=${JSON.stringify(err?.body)})`;
        });
    }

    return new Response(JSON.stringify({ push: pushResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-notification error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
