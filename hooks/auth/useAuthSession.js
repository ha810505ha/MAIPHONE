import { useCallback, useEffect, useState } from "react";
import {
  getFriendlyAuthError,
  isInvalidAuthSessionError,
  resendVerificationEmail,
  sendPasswordResetEmail,
  signInWithGoogle,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  updatePassword,
} from "../../services/auth/authService.js";
import { getSupabaseClient, getSupabaseConfig } from "../../services/auth/supabaseClient.js";

const INITIAL_STATE = {
  session: null,
  user: null,
  loading: true,
  busy: false,
  error: "",
  isPasswordRecovery: false,
};

export default function useAuthSession() {
  const configured = getSupabaseConfig().configured;
  const [state, setState] = useState(INITIAL_STATE);

  useEffect(() => {
    if (!configured) {
      setState({ ...INITIAL_STATE, loading: false });
      return undefined;
    }
    const client = getSupabaseClient();
    let active = true;
    const clearInvalidSession = async () => {
      try {
        // Local scope prevents an expired refresh token from affecting other devices.
        await client.auth.signOut({ scope: "local" });
      } catch {
        // Supabase may reject the sign-out request as well; auth-js still clears local storage.
      }
    };
    client.auth.getSession().then(async ({ data, error }) => {
      if (!active) return;
      if (isInvalidAuthSessionError(error)) {
        await clearInvalidSession();
        if (!active) return;
        setState({ ...INITIAL_STATE, loading: false, error: getFriendlyAuthError(error) });
        return;
      }
      setState((current) => ({ ...current, session: data?.session || null, user: data?.session?.user || null, loading: false, error: error ? getFriendlyAuthError(error) : "" }));
    }).catch(async (error) => {
      if (!active) return;
      if (isInvalidAuthSessionError(error)) {
        await clearInvalidSession();
        if (!active) return;
        setState({ ...INITIAL_STATE, loading: false, error: getFriendlyAuthError(error) });
        return;
      }
      setState((current) => ({ ...current, loading: false, error: getFriendlyAuthError(error) }));
    });
    const { data: subscription } = client.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      setState((current) => ({
        ...current,
        session: session || null,
        user: session?.user || null,
        loading: false,
        isPasswordRecovery: event === "PASSWORD_RECOVERY" || (current.isPasswordRecovery && event !== "SIGNED_OUT"),
      }));
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [configured]);

  const run = useCallback(async (action, options = {}) => {
    setState((current) => ({ ...current, busy: true, error: "" }));
    try {
      const data = await action();
      setState((current) => ({ ...current, busy: false, isPasswordRecovery: options.clearRecovery ? false : current.isPasswordRecovery }));
      return { data, error: null };
    } catch (error) {
      const message = getFriendlyAuthError(error, options);
      setState((current) => ({ ...current, busy: false, error: message }));
      return { data: null, error: message };
    }
  }, []);

  return {
    ...state,
    configured,
    signInWithGoogle: () => run(signInWithGoogle),
    signUpWithPassword: (email, password) => run(() => signUpWithPassword(email, password)),
    signInWithPassword: (email, password) => run(() => signInWithPassword(email, password), { login: true }),
    resendVerificationEmail: (email) => run(() => resendVerificationEmail(email)),
    sendPasswordResetEmail: (email) => run(() => sendPasswordResetEmail(email)),
    updatePassword: (password) => run(() => updatePassword(password), { clearRecovery: true }),
    signOut: () => run(signOut),
    clearError: () => setState((current) => ({ ...current, error: "" })),
  };
}
