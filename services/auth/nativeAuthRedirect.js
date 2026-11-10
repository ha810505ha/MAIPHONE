import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { getSupabaseClient, NATIVE_AUTH_REDIRECT_URL } from "./supabaseClient.js";

const callbackOrigin = new URL(NATIVE_AUTH_REDIRECT_URL);

export function parseNativeAuthRedirect(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== callbackOrigin.protocol || url.host !== callbackOrigin.host || url.pathname !== callbackOrigin.pathname) return null;
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    const get = (key) => url.searchParams.get(key) || hash.get(key) || "";
    return {
      code: get("code"),
      accessToken: get("access_token"),
      refreshToken: get("refresh_token"),
      error: get("error_description") || get("error"),
    };
  } catch {
    return null;
  }
}

export async function acceptNativeAuthRedirect(url, client = getSupabaseClient()) {
  const redirect = parseNativeAuthRedirect(url);
  if (!redirect) return { handled: false, session: null };
  if (redirect.error) throw new Error(redirect.error);
  if (!client) throw new Error("Supabase Auth is not configured");

  if (redirect.code) {
    const { data, error } = await client.auth.exchangeCodeForSession(redirect.code);
    if (error) throw error;
    return { handled: true, session: data?.session || null };
  }
  if (redirect.accessToken && redirect.refreshToken) {
    const { data, error } = await client.auth.setSession({
      access_token: redirect.accessToken,
      refresh_token: redirect.refreshToken,
    });
    if (error) throw error;
    return { handled: true, session: data?.session || null };
  }
  return { handled: true, session: null };
}

export async function installNativeAuthRedirectHandler() {
  if (!Capacitor.isNativePlatform()) return () => {};
  const handle = (url) => acceptNativeAuthRedirect(url).catch((error) => {
    console.warn("[auth] native redirect failed:", error?.message || error);
  });
  const listener = await App.addListener("appUrlOpen", ({ url }) => handle(url));
  const launch = await App.getLaunchUrl();
  if (launch?.url) await handle(launch.url);
  return () => listener.remove();
}
