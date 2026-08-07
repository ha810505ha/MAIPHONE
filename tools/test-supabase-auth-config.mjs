import assert from "node:assert/strict";
import { getSupabaseConfig } from "../services/auth/supabaseClient.js";

assert.deepEqual(getSupabaseConfig({}), { url: "", publishableKey: "", configured: false });
assert.deepEqual(
  getSupabaseConfig({ VITE_SUPABASE_URL: "https://example.supabase.co/", VITE_SUPABASE_PUBLISHABLE_KEY: "pk_test" }),
  { url: "https://example.supabase.co", publishableKey: "pk_test", configured: true },
);
console.log("supabase auth config: OK");
