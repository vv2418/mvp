import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = "BKwRDWSgVmNTfByjv2k1cJ0dtmlKcoi4hUcXC0f905Bn930LbJoKn3yevOgjfHoQuwoQ71D-zeW3ga2yacy3vTE";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function usePushNotifications() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    const init = async () => {
      const isSupported = "serviceWorker" in navigator && "PushManager" in window;
      setSupported(isSupported);
      if (!isSupported) return;

      if ("Notification" in window) setPermission(Notification.permission);

      // Check if there's already an active subscription
      try {
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        const sub = await reg?.pushManager.getSubscription();
        setSubscribed(!!sub);
      } catch {
        setSubscribed(false);
      }
    };
    init();
  }, []);

  const subscribe = async (): Promise<boolean> => {
    if (!supported) return false;

    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return false;

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      await supabase.from("push_subscriptions").upsert(
        { user_id: user.id, subscription: subscription.toJSON() },
        { onConflict: "user_id,subscription" }
      );

      setSubscribed(true);
      return true;
    } catch (err) {
      console.error("Push subscription error:", err);
      return false;
    }
  };

  const unsubscribe = async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("push_subscriptions").delete().eq("user_id", user.id);
        }
      }
      setSubscribed(false);
    } catch (err) {
      console.error("Push unsubscribe error:", err);
    }
  };

  return { supported, permission, subscribed, subscribe, unsubscribe };
}
