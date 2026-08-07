import { createClient } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";

export const NATIVE_AUTH_REDIRECT_URL = "maliphone://auth/callback";

const getEnvironment = () => import.meta.env || {};

export function getSupabaseConfig(environment = getEnvironment()) {
  const url = String(environment.VITE_SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const publishableKey = String(environment.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim();
  return { url, publishableKey, configured: Boolean(url && publishableKey) };
}

let client = null;

export function getSupabaseClient() {
  const config = getSupabaseConfig();
  if (!config.configured) return null;
  if (!client) {
    client = createClient(config.url, config.publishableKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}

export function getAuthRedirectUrl({ native = Capacitor.isNativePlatform(), base, origin } = {}) {
  if (native) return NATIVE_AUTH_REDIRECT_URL;
  const resolvedOrigin = origin || (typeof window !== "undefined" ? window.location.origin : "");
  if (!resolvedOrigin) return undefined;
  const resolvedBase = base || import.meta.env?.BASE_URL || "/";
  return new URL(resolvedBase, resolvedOrigin).toString();
}
