import { useState, useEffect } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../src/services/supabaseClient";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const loadSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error("Error loading session:", error);
        return;
      }

      setSession(data.session);
    };

    loadSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        console.log("Auth state changed:", newSession?.user?.id);
        setSession(newSession);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return {
    session,
    userId: session?.user?.id ?? null,
  };
}
