import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export async function ensureProfile(user: User | null): Promise<void> {
  if (!user) return;

  const name =
    typeof user.user_metadata?.name === "string" ? user.user_metadata.name : null;
  const phone =
    typeof user.user_metadata?.phone === "string" ? user.user_metadata.phone : null;

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    email: user.email ?? null,
    name,
    phone,
  });

  if (error) {
    throw error;
  }
}
