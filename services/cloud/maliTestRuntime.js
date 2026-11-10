// The hosted-test access token must never be persisted with apiConfig or app backups.
// Keep the current Supabase session in memory only, so normal AI calls can opt in
// to the server-managed test pool without ever receiving the personal API key.
let runtime = { session: null, environment: undefined };
const usageSubscribers = new Set();

export function setMaliTestRuntime(next = {}) {
  runtime = {
    session: next?.session || null,
    environment: next?.environment,
  };
}

export function getMaliTestRuntime() {
  return runtime;
}

// A hosted generation happens outside the settings screen. Keep the session
// private, but notify any visible balance UI as soon as the Worker confirms a
// successful charge so it does not wait for the player to press Refresh.
export function publishMaliTestUsage(update = {}) {
  for (const subscriber of usageSubscribers) {
    try { subscriber(update); } catch { /* A display listener must never affect generation. */ }
  }
}

export function subscribeMaliTestUsage(subscriber) {
  if (typeof subscriber !== "function") return () => {};
  usageSubscribers.add(subscriber);
  return () => usageSubscribers.delete(subscriber);
}

export function isMaliTestRuntimeReady() {
  return Boolean(runtime.session?.access_token);
}
