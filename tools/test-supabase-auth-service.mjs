import assert from "node:assert/strict";
import {
  AuthUnavailableError,
  getFriendlyAuthError,
  isInvalidAuthSessionError,
  signInWithPassword,
} from "../services/auth/authService.js";

assert.equal(getFriendlyAuthError(new Error("invalid login credentials"), { login: true }), "無法登入，請確認 Email 與密碼是否正確。");
assert.equal(getFriendlyAuthError(new Error("Password should be at least 8 characters")), "密碼至少需要 8 個字元。");
assert.equal(getFriendlyAuthError(new AuthUnavailableError()), "雲端帳號尚未設定。");
assert.equal(isInvalidAuthSessionError({ error_code: "invalid_refresh_token" }), true);
assert.equal(isInvalidAuthSessionError(new Error("Invalid Refresh Token: Refresh Token Not Found")), true);
assert.equal(isInvalidAuthSessionError(new Error("invalid login credentials")), false);
assert.equal(getFriendlyAuthError({ error_code: "refresh_token_not_found" }), "登入狀態已失效，請重新登入。");
assert.throws(() => signInWithPassword("person@example.com", "not-used"), AuthUnavailableError);
console.log("supabase auth service: OK");
