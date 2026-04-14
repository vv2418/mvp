import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * Redirects to "/" if no valid session exists.
 * Call at the top of every protected page.
 */
export function useRequireAuth() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (!user || error) {
        navigate("/", { replace: true });
      }
    });
  }, [navigate]);
}
