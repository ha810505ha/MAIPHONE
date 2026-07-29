const abortError = (reason = "Dating reply cancelled") => {
  if (typeof DOMException === "function") return new DOMException(reason, "AbortError");
  const error = new Error(reason);
  error.name = "AbortError";
  return error;
};

export function createDatingReplyLifecycle() {
  const active = new Map();
  let sequence = 0;

  return {
    start(profileId) {
      if (!profileId || active.has(profileId)) return null;
      const token = {
        id: ++sequence,
        profileId,
        controller: new AbortController(),
      };
      active.set(profileId, token);
      return token;
    },
    isActive(token) {
      return !!token
        && active.get(token.profileId) === token
        && token.controller.signal.aborted !== true;
    },
    finish(token) {
      if (!token || active.get(token.profileId) !== token) return false;
      active.delete(token.profileId);
      return true;
    },
    cancel(profileId, reason) {
      const token = active.get(profileId);
      if (!token) return false;
      active.delete(profileId);
      token.controller.abort(abortError(reason));
      return true;
    },
    cancelAll(reason) {
      const tokens = [...active.values()];
      active.clear();
      tokens.forEach((token) => token.controller.abort(abortError(reason)));
      return tokens.length;
    },
    has(profileId) {
      return active.has(profileId);
    },
    activeProfileIds() {
      return new Set(active.keys());
    },
  };
}

export function waitForDatingReplyDelay(milliseconds, signal) {
  const delay = Math.max(0, Number(milliseconds) || 0);
  if (!delay) return signal?.aborted ? Promise.reject(abortError()) : Promise.resolve();
  if (signal?.aborted) return Promise.reject(abortError());

  return new Promise((resolve, reject) => {
    const finish = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      finish();
      reject(signal?.reason instanceof Error ? signal.reason : abortError());
    };
    const timer = setTimeout(() => {
      finish();
      resolve();
    }, delay);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
