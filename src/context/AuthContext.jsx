import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const user = session?.user ?? null;

  useEffect(() => {
    if (!supabase) return undefined;

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error("Could not restore the sign-in session:", error.message);
      setSession(data.session);
      setLoading(false);
    }).catch((error) => {
      console.error("Could not restore the sign-in session:", error.message);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  async function signInWithGoogle(redirectPath) {
    if (!supabase) {
      throw new Error("Google sign-in is not configured yet. Add the Supabase URL and public key to .env.local.");
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}${redirectPath ?? "/auth/callback"}`,
      },
    });
    if (error) throw new Error(`Google sign-in could not start: ${error.message}`);
  }

  async function signOut() {
    if (!supabase) throw new Error("Supabase authentication is not configured yet.");
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(`Could not sign out: ${error.message}`);
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
