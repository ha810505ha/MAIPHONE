import { getAuthRedirectUrl, getSupabaseClient } from "./supabaseClient.js";

export class AuthUnavailableError extends Error {
  constructor() {
    super("雲端帳號尚未設定");
    this.code = "auth_not_configured";
  }
}

const INVALID_SESSION_CODES = new Set([
  "invalid_refresh_token",
  "refresh_token_not_found",
  "session_not_found",
  "session_expired",
]);

export function isInvalidAuthSessionError(error) {
  const code = String(error?.code || error?.error_code || error?.details?.code || "").trim().toLowerCase();
  if (INVALID_SESSION_CODES.has(code)) return true;
  const message = String(error?.message || error || "");
  return /invalid\s+refresh\s+token|refresh\s+token.*(?:not\s+found|expired|invalid)|session.*(?:not\s+found|expired|invalid)/i.test(message);
}

const requireClient = () => {
  const client = getSupabaseClient();
  if (!client) throw new AuthUnavailableError();
  return client;
};

const unwrap = async (request) => {
  const { data, error } = await request;
  if (error) throw error;
  return data;
};

export const signInWithGoogle = () => unwrap(requireClient().auth.signInWithOAuth({
  provider: "google",
  options: { redirectTo: getAuthRedirectUrl() },
}));

export const signUpWithPassword = (email, password) => unwrap(requireClient().auth.signUp({
  email: String(email || "").trim(),
  password,
  options: { emailRedirectTo: getAuthRedirectUrl() },
}));

export const signInWithPassword = (email, password) => unwrap(requireClient().auth.signInWithPassword({
  email: String(email || "").trim(),
  password,
}));

export const signOut = () => unwrap(requireClient().auth.signOut());

export const resendVerificationEmail = (email) => unwrap(requireClient().auth.resend({
  type: "signup",
  email: String(email || "").trim(),
  options: { emailRedirectTo: getAuthRedirectUrl() },
}));

export const sendPasswordResetEmail = (email) => unwrap(requireClient().auth.resetPasswordForEmail(
  String(email || "").trim(),
  { redirectTo: getAuthRedirectUrl() },
));

export const updatePassword = (password) => unwrap(requireClient().auth.updateUser({ password }));

export function getFriendlyAuthError(error, { login = false } = {}) {
  if (error?.code === "auth_not_configured") return "雲端帳號尚未設定。";
  if (isInvalidAuthSessionError(error)) return "登入狀態已失效，請重新登入。";
  if (login) return "無法登入，請確認 Email 與密碼是否正確。";
  const message = String(error?.message || "");
  if (/password.*least|password.*short/i.test(message)) return "密碼至少需要 8 個字元。";
  if (/invalid email|email.*invalid/i.test(message)) return "請輸入有效的 Email。";
  if (/rate limit|too many/i.test(message)) return "操作太頻繁，請稍後再試。";
  return "操作暫時無法完成，請稍後再試。";
}
