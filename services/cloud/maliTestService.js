import { fetchWithTimeout, NETWORK_TIMEOUTS } from "../../utils/networkRequest.js";
import { publishMaliTestUsage } from "./maliTestRuntime.js";

const getEnvironment = () => import.meta.env || {};

export function getMaliTestConfig(environment = getEnvironment()) {
  const url = String(environment.VITE_CLOUDFLARE_DATA_API_URL || "").trim().replace(/\/+$/, "");
  return { url, configured: Boolean(url) };
}

export class MaliTestUnavailableError extends Error {
  constructor(message = "Mali hosted test mode is not configured") {
    super(message);
    this.name = "MaliTestUnavailableError";
  }
}

// The Worker deliberately keeps the precise response in `error.message` for
// diagnostics.  UI surfaces should use this helper instead of exposing that
// implementation wording to players.
export function getMaliTestPlayerError(error, tr) {
  const message = String(error?.message || "");
  if (/daily mali allowance/i.test(message)) {
    return tr(
      "今日測試額度已用完，請明天再試或改用我的 API。",
      "Today's test allowance is used up. Try again tomorrow or switch to your own API.",
      "本日のテスト利用枠を使い切りました。明日もう一度試すか、自分の API に切り替えてください。",
      "오늘의 테스트 이용 한도를 모두 사용했어요. 내일 다시 시도하거나 내 API로 전환해 주세요."
    );
  }
  if (/test points exhausted/i.test(message)) {
    return tr(
      "測試點數已用完，請改用我的 API 或聯絡管理員。",
      "Test points are used up. Switch to your own API or contact the administrator.",
      "テストポイントを使い切りました。自分の API に切り替えるか、管理者に連絡してください。",
      "테스트 포인트를 모두 사용했어요. 내 API로 전환하거나 관리자에게 문의해 주세요."
    );
  }
  return "";
}

async function requestMaliTest(path, { session, method = "GET", body, environment, signal } = {}) {
  const { url, configured } = getMaliTestConfig(environment);
  if (!configured) throw new MaliTestUnavailableError();
  if (!session?.access_token) throw new MaliTestUnavailableError("請先登入才能使用測試模型");
  const response = await fetchWithTimeout(`${url}${path}`, {
    method,
    signal,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }, { signal, timeoutMs: NETWORK_TIMEOUTS.AI });
  const contentType = response.headers.get("Content-Type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text();
  if (!response.ok) {
    const detail = typeof payload === "object" ? payload?.error : payload;
    const error = new Error(detail || `Mali test request failed (${response.status})`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  if (path === "/v1/mali/generate" && payload && typeof payload === "object") {
    publishMaliTestUsage({
      pointsCharged: Number(payload.pointsCharged || 0),
      balance: payload.balance || null,
      requestId: payload.requestId || "",
      createdAt: payload.createdAt || "",
      app: payload.app || "",
      action: payload.action || "",
    });
  }
  return payload;
}

export function fetchMaliTestQuota(session, environment) {
  return requestMaliTest("/v1/mali/quota", { session, environment });
}

export function fetchMaliTestUsage(session, environment, limit = 20) {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  return requestMaliTest(`/v1/mali/usage?limit=${safeLimit}`, { session, environment });
}

export function runMaliConnectionTest(session, environment, provider = "", model = "") {
  return requestMaliTest("/v1/mali/generate", {
    session,
    environment,
    method: "POST",
    body: {
      feature: "connection_test",
      mode: "online",
      app: "settings",
      action: "connection_test",
      requestType: "connection_test",
      ...(provider ? { provider } : {}),
      ...(model ? { model } : {}),
      maxOutputTokens: 16,
      systemInstruction: { parts: [{ text: "你是連線測試助手，只能回覆 OK。" }] },
      contents: [{ role: "user", parts: [{ text: "請只回覆 OK" }] }],
    },
  });
}

export function runMaliTextGeneration(session, environment, {
  provider = "",
  model = "",
  feature = "other",
  mode = "app",
  app = "other",
  action = "generate",
  maxOutputTokens = 512,
  systemPrompt = "",
  contents = [],
  signal,
} = {}) {
  return requestMaliTest("/v1/mali/generate", {
    session,
    environment,
    signal,
    method: "POST",
    body: {
      feature,
      mode,
      app,
      action,
      requestType: "generation",
      ...(provider ? { provider } : {}),
      ...(model ? { model } : {}),
      maxOutputTokens,
      ...(systemPrompt ? { systemInstruction: { parts: [{ text: String(systemPrompt) }] } } : {}),
      contents,
    },
  });
}
