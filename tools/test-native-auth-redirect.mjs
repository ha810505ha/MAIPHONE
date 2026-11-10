import assert from "node:assert/strict";
import { parseNativeAuthRedirect } from "../services/auth/nativeAuthRedirect.js";
import { getAuthRedirectUrl, NATIVE_AUTH_REDIRECT_URL } from "../services/auth/supabaseClient.js";

assert.equal(NATIVE_AUTH_REDIRECT_URL, "maliphone://auth/callback");
assert.equal(getAuthRedirectUrl({ native: true }), NATIVE_AUTH_REDIRECT_URL);
assert.equal(
  getAuthRedirectUrl({ native: false, origin: "https://example.com", base: "/MAIPHONE/" }),
  "https://example.com/MAIPHONE/",
);
assert.deepEqual(
  parseNativeAuthRedirect("maliphone://auth/callback?code=verification-code"),
  { code: "verification-code", accessToken: "", refreshToken: "", error: "" },
);
assert.deepEqual(
  parseNativeAuthRedirect("maliphone://auth/callback#access_token=access&refresh_token=refresh"),
  { code: "", accessToken: "access", refreshToken: "refresh", error: "" },
);
assert.equal(parseNativeAuthRedirect("https://example.com/auth/callback?code=nope"), null);
assert.equal(parseNativeAuthRedirect("maliphone://auth/other?code=nope"), null);
assert.equal(parseNativeAuthRedirect("not a url"), null);

console.log("ok: native Supabase auth redirects use the MaliPhone callback scheme");
