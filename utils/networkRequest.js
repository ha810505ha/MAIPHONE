export const NETWORK_TIMEOUTS = Object.freeze({
  DEFAULT: 30_000,
  METADATA: 12_000,
  SYNC: 20_000,
  AI: 120_000,
  MEDIA: 180_000,
});

export class NetworkTimeoutError extends Error {
  constructor(timeoutMs) {
    const seconds = Math.max(1, Math.round(timeoutMs / 1000));
    super(`網路請求逾時（${seconds} 秒），請檢查連線後重試`);
    this.name = "NetworkTimeoutError";
    this.code = "NETWORK_TIMEOUT";
    this.timeoutMs = timeoutMs;
  }
}

const normalizeTimeout = (value) => {
  const timeoutMs = Number(value);
  return Number.isFinite(timeoutMs) && timeoutMs > 0
    ? Math.max(1, Math.round(timeoutMs))
    : NETWORK_TIMEOUTS.DEFAULT;
};

const createAbortError = (reason) => {
  if (reason instanceof Error) return reason;
  const message = typeof reason === "string" && reason ? reason : "網路請求已取消";
  if (typeof DOMException === "function") return new DOMException(message, "AbortError");
  const error = new Error(message);
  error.name = "AbortError";
  return error;
};

export const isNetworkTimeout = (error) => (
  error?.name === "NetworkTimeoutError" || error?.code === "NETWORK_TIMEOUT"
);

export const isRequestCancelled = (error) => (
  !isNetworkTimeout(error) && (error?.name === "AbortError" || error?.code === "ABORT_ERR")
);

const wrapResponseBody = (body, finish, normalizeError) => {
  const reader = body.getReader();
  return new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          finish();
          controller.close();
        } else {
          controller.enqueue(value);
        }
      } catch (error) {
        finish();
        controller.error(normalizeError(error));
      }
    },
    async cancel(reason) {
      finish();
      await reader.cancel(reason);
    },
  });
};

const wrapResponse = (response, finish, normalizeError) => {
  if (!response?.body || typeof Proxy !== "function") {
    finish();
    return response;
  }

  let wrappedBody = null;
  const bodyReaders = new Set(["arrayBuffer", "blob", "bytes", "formData", "json", "text"]);
  return new Proxy(response, {
    get(target, property) {
      if (property === "body") {
        if (!wrappedBody) wrappedBody = wrapResponseBody(target.body, finish, normalizeError);
        return wrappedBody;
      }
      const value = Reflect.get(target, property, target);
      if (bodyReaders.has(property) && typeof value === "function") {
        return async (...args) => {
          try {
            return await value.apply(target, args);
          } catch (error) {
            throw normalizeError(error);
          } finally {
            finish();
          }
        };
      }
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
};

/**
 * fetch wrapper with a mandatory deadline and optional caller cancellation.
 *
 * Keep raw fetch calls inside this module. App services must use this wrapper so
 * new endpoints cannot accidentally wait forever or leak abort listeners.
 */
export async function fetchWithTimeout(input, init = {}, options = {}) {
  const timeoutMs = normalizeTimeout(options.timeoutMs);
  const externalSignal = options.signal || init.signal || null;
  if (externalSignal?.aborted) throw createAbortError(externalSignal.reason);

  const controller = new AbortController();
  let timeoutError = null;
  let timer = null;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    if (timer) clearTimeout(timer);
    externalSignal?.removeEventListener("abort", abortFromCaller);
  };
  const abortFromCaller = () => {
    if (!controller.signal.aborted) controller.abort(createAbortError(externalSignal?.reason));
    finish();
  };

  if (externalSignal) {
    externalSignal.addEventListener("abort", abortFromCaller, { once: true });
    // Avoid the small race between the initial check and listener registration.
    if (externalSignal.aborted) abortFromCaller();
  }

  timer = setTimeout(() => {
    timeoutError = new NetworkTimeoutError(timeoutMs);
    if (!controller.signal.aborted) controller.abort(timeoutError);
    finish();
  }, timeoutMs);

  const { signal: _ignoredSignal, ...fetchInit } = init;
  const normalizeError = (error) => {
    if (timeoutError) return timeoutError;
    if (externalSignal?.aborted) return createAbortError(externalSignal.reason);
    return error;
  };
  try {
    const response = await fetch(input, { ...fetchInit, signal: controller.signal });
    return wrapResponse(response, finish, normalizeError);
  } catch (error) {
    finish();
    throw normalizeError(error);
  }
}
