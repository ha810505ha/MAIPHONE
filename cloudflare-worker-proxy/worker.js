const PROVIDERS = {
  claude: {
    baseUrl: "https://api.anthropic.com/v1",
    allowedPaths: [/^\/messages$/, /^\/models$/],
  },
  ollama: {
    baseUrl: "https://ollama.com/v1",
    allowedPaths: [/^\/chat\/completions$/, /^\/models$/],
  },
  nvidia: {
    baseUrl: "https://integrate.api.nvidia.com/v1",
    allowedPaths: [/^\/chat\/completions$/, /^\/models$/],
  },
};

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost",
  "https://localhost",
  "https://ha810505ha.github.io",
];
const MAX_DOCUMENT_BYTES = 512 * 1024;
const MAX_MEDIA_BYTES = 10 * 1024 * 1024;
const MAX_MALI_REQUEST_BYTES = 256 * 1024;
const MAX_MALI_TEXT_CHARS = 120000;
const CONNECTION_TEST_FREE_COUNT = 5;
const CONNECTION_TEST_BLOCK_SIZE = 5;
const CONNECTION_TEST_POINTS_PER_BLOCK = 1;
const DEFAULT_MALI_CONNECTION_TEST_COOLDOWN_SECONDS = 60;
const DEFAULT_MALI_CONNECTION_TEST_DAILY_LIMIT = 20;
const DEFAULT_MALI_OPENROUTER_MODEL = "openai/gpt-4o-mini";
const DEFAULT_MALI_OPENROUTER_MODELS = [DEFAULT_MALI_OPENROUTER_MODEL];
const DEFAULT_MALI_OPENROUTER_DAILY_LIMIT = 1100;
const MALI_OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export const getConnectionTestPointCharge = (nextCount) => {
  const count = Math.max(0, Math.floor(Number(nextCount) || 0));
  if (count <= CONNECTION_TEST_FREE_COUNT) return 0;
  return (count - CONNECTION_TEST_FREE_COUNT) % CONNECTION_TEST_BLOCK_SIZE === 1
    ? CONNECTION_TEST_POINTS_PER_BLOCK
    : 0;
};

export const getMaliPointCost = ({ feature = "", mode = "" } = {}) => {
  if (String(feature).toLowerCase() === "chat" && String(mode).toLowerCase() === "reality") return 3;
  if (String(feature).toLowerCase() === "chat" && ["online", "group"].includes(String(mode).toLowerCase())) return 2;
  return 1;
};

const isMaliTestModeEnabled = (env) => /^(1|true|yes|on)$/i.test(String(env.MALI_TEST_MODE_ENABLED || ""));

const getTextCharCount = (value) => Array.from(String(value || "")).length;

// Usage labels are metadata only. Keep them short and allowlisted so a client
// cannot put prompt text (or other arbitrary data) into the usage ledger.
const normalizeMaliUsageLabel = (value, fallback) => {
  const label = String(value || "").trim().toLowerCase();
  return /^[a-z0-9][a-z0-9_-]{0,39}$/i.test(label) ? label : fallback;
};

const estimateMaliTextTokens = (value) => {
  let estimate = 0;
  for (const character of String(value || "")) {
    const codePoint = character.codePointAt(0) || 0;
    if (/\s/u.test(character) || codePoint <= 0x7f) estimate += 0.25;
    else estimate += 1.5;
  }
  return Math.ceil(estimate);
};

const getMaliPayloadText = (payload) => {
  const texts = [];
  for (const content of payload?.contents || []) {
    for (const part of content?.parts || []) {
      if (typeof part?.text === "string") texts.push(part.text);
    }
  }
  for (const part of payload?.systemInstruction?.parts || []) {
    if (typeof part?.text === "string") texts.push(part.text);
  }
  return texts.join("\n");
};

const extractGeminiText = (payload) => (
  (payload?.candidates || [])
    .flatMap((candidate) => candidate?.content?.parts || [])
    .map((part) => typeof part?.text === "string" ? part.text : "")
    .join("")
);

export const toOpenRouterMessages = (payload) => {
  const messages = [];
  const systemText = (payload?.systemInstruction?.parts || [])
    .map((part) => typeof part?.text === "string" ? part.text : "")
    .filter(Boolean)
    .join("\n");
  if (systemText) messages.push({ role: "system", content: systemText });
  for (const content of payload?.contents || []) {
    const text = (content?.parts || [])
      .map((part) => typeof part?.text === "string" ? part.text : "")
      .filter(Boolean)
      .join("\n");
    if (text) messages.push({ role: content?.role === "model" ? "assistant" : "user", content: text });
  }
  return messages;
};

export const extractOpenRouterText = (payload) => (
  (payload?.choices || [])
    .map((choice) => choice?.message?.content)
    .map((content) => {
      if (typeof content === "string") return content;
      if (!Array.isArray(content)) return "";
      return content.map((part) => typeof part === "string" ? part : part?.text || "").join("");
    })
    .join("")
);

const getProviderText = (provider, payload) => (
  provider.family === "openrouter" ? extractOpenRouterText(payload) : extractGeminiText(payload)
);

const getProviderUsage = (provider, payload) => {
  if (provider.family === "openrouter") {
    const usage = payload?.usage || {};
    return {
      inputTokens: Number(usage.prompt_tokens || 0),
      outputTokens: Number(usage.completion_tokens || 0),
      totalTokens: Number(usage.total_tokens || Number(usage.prompt_tokens || 0) + Number(usage.completion_tokens || 0)),
      reasoningTokens: Number(usage.completion_tokens_details?.reasoning_tokens || 0),
      cachedTokens: Number(usage.prompt_tokens_details?.cached_tokens || 0),
    };
  }
  const usage = payload?.usageMetadata || {};
  const inputTokens = Number(usage.promptTokenCount || 0);
  const outputTokens = Number(usage.candidatesTokenCount || 0);
  return {
    inputTokens,
    outputTokens,
    totalTokens: Number(usage.totalTokenCount || inputTokens + outputTokens),
    reasoningTokens: Number(usage.thoughtsTokenCount || 0),
    cachedTokens: Number(usage.cachedContentTokenCount || 0),
  };
};

const getProviderRequest = (provider, parsed, env) => {
  if (provider.family === "openrouter") {
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    };
    const referer = String(env.MALI_OPENROUTER_HTTP_REFERER || "https://ha810505ha.github.io").trim();
    const title = String(env.MALI_OPENROUTER_X_TITLE || "MaliPhone").trim();
    if (referer) headers["HTTP-Referer"] = referer;
    if (title) headers["X-Title"] = title;
    return {
      endpoint: MALI_OPENROUTER_ENDPOINT,
      headers,
      body: {
        model: provider.model,
        messages: toOpenRouterMessages(parsed.payload),
        max_tokens: parsed.payload.generationConfig.maxOutputTokens,
      },
    };
  }
  return {
    endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(provider.model)}:generateContent`,
    headers: { "Content-Type": "application/json", "x-goog-api-key": provider.apiKey },
    body: parsed.payload,
  };
};

const getPositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getQuotaDay = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

const normalizeMaliSecretName = (value) => {
  const name = String(value || "").trim().toUpperCase();
  return /^OPENROUTER_API_KEY(?:_[A-Z0-9_]{1,40})?$/.test(name) ? name : "";
};

const normalizeMaliModelId = (value) => {
  const model = String(value || "").trim();
  return /^[A-Za-z0-9._~+-]+\/[A-Za-z0-9._:~+-]+$/.test(model) ? model : "";
};

const getOpenRouterModels = (env) => {
  const configured = String(env.MALI_OPENROUTER_MODELS || "")
    .split(",")
    .map(normalizeMaliModelId)
    .filter(Boolean);
  const fallback = normalizeMaliModelId(env.MALI_OPENROUTER_MODEL) || DEFAULT_MALI_OPENROUTER_MODELS[0];
  return [...new Set(configured.length ? configured : [fallback])];
};

const getOpenRouterApiKey = (env, account) => {
  const secretName = normalizeMaliSecretName(account?.openrouter_secret_name) || "OPENROUTER_API_KEY";
  const legacySecretName = secretName === "OPENROUTER_API_KEY"
    ? "MALI_OPENROUTER_API_KEY"
    : `MALI_${secretName}`;
  return String(env[secretName] || env[legacySecretName] || "").trim();
};

const getMaliProviders = (env, preferredProvider = "", account = null, preferredModel = "", includeAllModels = false) => {
  const geminiProviders = [
    {
      id: "gemini-primary",
      family: "gemini",
      apiKey: String(env.GEMINI_PRIMARY_API_KEY || "").trim(),
      model: String(env.MALI_GEMINI_PRIMARY_MODEL || "gemma-4-31b-it").trim(),
      dailyLimit: getPositiveInteger(env.MALI_GEMINI_PRIMARY_DAILY_LIMIT, 1100),
    },
    {
      id: "gemini-backup",
      family: "gemini",
      apiKey: String(env.GEMINI_BACKUP_API_KEY || "").trim(),
      model: String(env.MALI_GEMINI_BACKUP_MODEL || "gemma-4-26b-a4b-it").trim(),
      dailyLimit: getPositiveInteger(env.MALI_GEMINI_BACKUP_DAILY_LIMIT, 0),
    },
  ].filter((provider) => provider.apiKey && provider.dailyLimit > 0 && provider.model);
  const openRouterKey = getOpenRouterApiKey(env, account);
  const openRouterProviders = getOpenRouterModels(env).map((model) => ({
    id: `openrouter:${model}`,
    family: "openrouter",
    apiKey: openRouterKey,
    model,
    dailyLimit: getPositiveInteger(env.MALI_OPENROUTER_DAILY_LIMIT, DEFAULT_MALI_OPENROUTER_DAILY_LIMIT),
  })).filter((provider) => provider.apiKey && provider.dailyLimit > 0 && provider.model);
  const groups = { gemini: geminiProviders, openrouter: openRouterProviders };
  const normalize = (value) => {
    const name = String(value || "").trim().toLowerCase();
    return name === "or" ? "openrouter" : name;
  };
  const requested = preferredProvider
    ? [normalize(preferredProvider)]
    : String(env.MALI_PROVIDER_ORDER || "gemini,openrouter")
      .split(",")
      .map(normalize)
      .filter(Boolean);
  const order = requested.length ? requested : ["gemini", "openrouter"];
  const providers = order.flatMap((name) => groups[name] || []);
  const selectedModel = normalizeMaliModelId(preferredModel);
  if (selectedModel) return providers.filter((provider) => provider.model === selectedModel);
  if (includeAllModels) return providers;
  const seenFamilies = new Set();
  return providers.filter((provider) => {
    if (provider.family !== "openrouter") return true;
    if (seenFamilies.has(provider.family)) return false;
    seenFamilies.add(provider.family);
    return true;
  });
};

// 原生 App（Capacitor / Ionic）的 WebView 來源不是固定字串：
//   Android 預設 https://localhost、iOS 預設 capacitor://localhost、
//   舊版可能是 ionic://localhost 或帶埠號。全部的 hostname 都是 localhost，
//   所以只要來源主機是 localhost / 127.0.0.1 就一律放行（仍需有效的 API 金鑰才打得到上游）。
const isLoopbackOrigin = (origin) => {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";
  } catch (_) {
    return false;
  }
};

const resolveAllowOrigin = (origin, env) => {
  if (!origin) return "";
  const configured = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  const allowedOrigins = [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured])];
  if (allowedOrigins.includes(origin)) return origin;
  if (isLoopbackOrigin(origin)) return origin;
  return "";
};

const corsHeaders = (request, env) => {
  const origin = request.headers.get("Origin") || "";
  const allowOrigin = resolveAllowOrigin(origin, env);
  return {
    ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin } : {}),
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,x-api-key,anthropic-version,anthropic-dangerous-direct-browser-access,HTTP-Referer,X-Title",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Expose-Headers": "Content-Type,ETag",
    "Vary": "Origin",
  };
};

const json = (request, env, body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(request, env),
    },
  });

const sanitizeHeaders = (request, providerKey) => {
  const headers = new Headers();
  const contentType = request.headers.get("Content-Type");
  const authorization = request.headers.get("Authorization");
  const apiKey = request.headers.get("x-api-key");
  const anthropicVersion = request.headers.get("anthropic-version");
  const referer = request.headers.get("HTTP-Referer");
  const title = request.headers.get("X-Title");

  if (contentType) headers.set("Content-Type", contentType);
  if (authorization) headers.set("Authorization", authorization);
  if (apiKey) headers.set("x-api-key", apiKey);
  if (anthropicVersion || providerKey === "claude") {
    headers.set("anthropic-version", anthropicVersion || "2023-06-01");
  }
  if (providerKey === "claude") {
    headers.set("anthropic-dangerous-direct-browser-access", "true");
  }
  if (referer) headers.set("HTTP-Referer", referer);
  if (title) headers.set("X-Title", title);

  return headers;
};

const stripProviderPrefix = (pathname) => {
  const parts = pathname.split("/").filter(Boolean);
  const providerKey = parts.shift();
  const providerPath = `/${parts.join("/")}`;
  return { providerKey, providerPath: providerPath === "/" ? "/" : providerPath };
};

const isAllowedPath = (provider, path) => provider.allowedPaths.some((pattern) => pattern.test(path));

const getBearerToken = (request) => {
  const authorization = request.headers.get("Authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
};

async function getMaliTestAccount(env, userId, email = "") {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!env.MALIPHONE_DB || !userId) return null;
  return env.MALIPHONE_DB
    .prepare(`SELECT user_id, email, granted_points, used_points, connection_test_count, enabled, expires_at, openrouter_secret_name
      FROM mali_test_accounts
      WHERE user_id = ? OR (email IS NOT NULL AND lower(email) = ?)
      ORDER BY CASE WHEN user_id = ? THEN 0 ELSE 1 END
      LIMIT 1`)
    .bind(userId, normalizedEmail, userId)
    .first();
}

const isMaliAccountActive = (account) => (
  !!account
  && Number(account.enabled) === 1
  && (!account.expires_at || new Date(account.expires_at).getTime() > Date.now())
);

const getRemainingMaliPoints = (account) => Math.max(
  0,
  Number(account?.granted_points || 0) - Number(account?.used_points || 0),
);

async function reserveMaliAccountPoints(env, userId, email, points) {
  const cost = Math.max(0, Math.floor(Number(points) || 0));
  if (!cost) return { pointsCharged: 0, account: await getMaliTestAccount(env, userId, email) };
  const result = await env.MALIPHONE_DB
    .prepare(`UPDATE mali_test_accounts
      SET used_points = used_points + ?, updated_at = datetime('now')
      WHERE (user_id = ? OR (email IS NOT NULL AND lower(email) = ?))
        AND enabled = 1
        AND (expires_at IS NULL OR expires_at > datetime('now'))
        AND granted_points - used_points >= ?`)
    .bind(cost, userId, String(email || "").trim().toLowerCase(), cost)
    .run();
  if (!Number(result?.meta?.changes || 0)) return null;
  return { pointsCharged: cost, account: await getMaliTestAccount(env, userId, email) };
}

async function reserveConnectionTestAllowance(env, userId, email) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const account = await getMaliTestAccount(env, userId, email);
    if (!isMaliAccountActive(account)) return null;
    const currentCount = Math.max(0, Number(account.connection_test_count || 0));
    const nextCount = currentCount + 1;
    const pointsCharged = getConnectionTestPointCharge(nextCount);
    if (getRemainingMaliPoints(account) < pointsCharged) return null;
    const result = await env.MALIPHONE_DB
      .prepare(`UPDATE mali_test_accounts
        SET connection_test_count = ?, used_points = used_points + ?, updated_at = datetime('now')
        WHERE (user_id = ? OR (email IS NOT NULL AND lower(email) = ?))
          AND connection_test_count = ?
          AND enabled = 1
          AND (expires_at IS NULL OR expires_at > datetime('now'))
          AND granted_points - used_points >= ?`)
      .bind(nextCount, pointsCharged, userId, String(email || "").trim().toLowerCase(), currentCount, pointsCharged)
      .run();
    if (Number(result?.meta?.changes || 0)) {
      return {
        pointsCharged,
        connectionTestCount: nextCount,
        account: await getMaliTestAccount(env, userId, email),
      };
    }
  }
  return null;
}

async function refundMaliAccountPoints(env, userId, email, points) {
  const refund = Math.max(0, Math.floor(Number(points) || 0));
  if (!refund) return;
  await env.MALIPHONE_DB
    .prepare(`UPDATE mali_test_accounts
      SET used_points = MAX(0, used_points - ?), updated_at = datetime('now')
      WHERE (user_id = ? OR (email IS NOT NULL AND lower(email) = ?))`)
    .bind(refund, userId, String(email || "").trim().toLowerCase())
    .run();
}

async function canRunConnectionTest(env, userId) {
  if (!env.MALIPHONE_DB) return false;
  const cooldownSeconds = getPositiveInteger(env.MALI_CONNECTION_TEST_COOLDOWN_SECONDS, DEFAULT_MALI_CONNECTION_TEST_COOLDOWN_SECONDS);
  const dailyLimit = getPositiveInteger(env.MALI_CONNECTION_TEST_DAILY_LIMIT, DEFAULT_MALI_CONNECTION_TEST_DAILY_LIMIT);
  const windowStart = new Date(Date.now() - cooldownSeconds * 1000).toISOString();
  const result = await env.MALIPHONE_DB
    .prepare(`SELECT COUNT(*) AS used, MAX(created_at) AS last_created_at
      FROM ai_usage_requests
      WHERE user_id = ?
        AND request_type = 'connection_test'
        AND quota_day = ?`)
    .bind(userId, getQuotaDay())
    .first();
  if (Number(result?.used || 0) >= dailyLimit) return false;
  if (!result?.last_created_at) return true;
  const lastCreatedAt = new Date(result.last_created_at).getTime();
  return !Number.isFinite(lastCreatedAt) || lastCreatedAt < new Date(windowStart).getTime();
}

async function getAuthenticatedUser(request, env) {
  const token = getBearerToken(request);
  const supabaseUrl = String(env.SUPABASE_URL || "").replace(/\/+$/, "");
  const publishableKey = String(env.SUPABASE_PUBLISHABLE_KEY || "").trim();
  if (!token || !supabaseUrl || !publishableKey) return null;

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: publishableKey,
    },
  });
  if (!response.ok) return null;

  const user = await response.json();
  return typeof user?.id === "string" && user.id ? user : null;
}

const getPathSegment = (pathname, prefix) => {
  const encoded = pathname.slice(prefix.length);
  if (!encoded || encoded.includes("/")) return "";
  try {
    const value = decodeURIComponent(encoded);
    return value && value.length <= 120 && /^[a-zA-Z0-9._-]+$/.test(value) ? value : "";
  } catch {
    return "";
  }
};

const getMediaObjectKey = (userId, objectName) => `${userId}/${objectName}`;

async function requireUser(request, env) {
  try {
    return await getAuthenticatedUser(request, env);
  } catch {
    return null;
  }
}

async function reserveMaliRequest(env, userId, {
  email,
  feature,
  mode,
  app,
  action,
  requestType,
  pointsCharged,
  inputChars,
  estimatedInputTokens,
}) {
  const requestId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const quotaDay = getQuotaDay();
  const playerLimit = getPositiveInteger(env.MALI_PLAYER_DAILY_LIMIT, 50);
  const cost = Math.max(0, Math.floor(Number(pointsCharged) || 0));
  const allowance = requestType === "connection_test"
    ? await reserveConnectionTestAllowance(env, userId, email)
    : await reserveMaliAccountPoints(env, userId, email, cost);
  if (!allowance) return null;
  try {
    await env.MALIPHONE_DB
      .prepare(`INSERT INTO ai_usage_requests
        (id, user_id, quota_day, feature, mode, app_id, action_id, request_type, player_limit, points_charged, input_chars, estimated_input_tokens, created_at, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'reserved')`)
      .bind(requestId, userId, quotaDay, feature, mode, app, action, requestType, playerLimit, allowance.pointsCharged, inputChars, estimatedInputTokens, createdAt)
      .run();
    return { requestId, quotaDay, playerLimit, createdAt, app, action, ...allowance };
  } catch (error) {
    await refundMaliAccountPoints(env, userId, email, allowance.pointsCharged);
    if (String(error?.message || "").includes("PLAYER_DAILY_LIMIT")) return null;
    throw error;
  }
}

async function reserveProviderAttempt(env, requestId, provider, quotaDay) {
  const attemptId = crypto.randomUUID();
  try {
    await env.MALIPHONE_DB
      .prepare("INSERT INTO ai_provider_attempts (id, request_id, provider_id, quota_day, provider_limit, status) VALUES (?, ?, ?, ?, ?, 'reserved')")
      .bind(attemptId, requestId, provider.id, quotaDay, provider.dailyLimit)
      .run();
    return attemptId;
  } catch (error) {
    if (String(error?.message || "").includes("PROVIDER_DAILY_LIMIT")) return null;
    throw error;
  }
}

async function getMaliQuota(env, user) {
  const userId = typeof user === "string" ? user : user?.id;
  const email = typeof user === "string" ? "" : user?.email;
  const quotaDay = getQuotaDay();
  const playerLimit = getPositiveInteger(env.MALI_PLAYER_DAILY_LIMIT, 50);
  const result = await env.MALIPHONE_DB
    .prepare("SELECT COUNT(*) AS used FROM ai_usage_requests WHERE user_id = ? AND quota_day = ? AND status IN ('reserved', 'succeeded')")
    .bind(userId, quotaDay)
    .first();
  const account = await getMaliTestAccount(env, userId, email);
  const used = Number(result?.used || 0);
  const active = isMaliAccountActive(account);
  return {
    enabled: isMaliTestModeEnabled(env) && active,
    accountAssigned: !!account,
    quotaDay,
    used,
    limit: playerLimit,
    remaining: Math.max(0, playerLimit - used),
    grantedPoints: Number(account?.granted_points || 0),
    usedPoints: Number(account?.used_points || 0),
    remainingPoints: active ? getRemainingMaliPoints(account) : 0,
    connectionTestCount: Number(account?.connection_test_count || 0),
    connectionTestFreeCount: CONNECTION_TEST_FREE_COUNT,
    connectionTestBlockSize: CONNECTION_TEST_BLOCK_SIZE,
    expiresAt: account?.expires_at || null,
    providers: getMaliProviders(env, "", account, "", true).map(({ id, family, model }) => ({ id, family, model })),
  };
}

async function getMaliUsage(env, user, url) {
  const requestedLimit = Number.parseInt(url.searchParams.get("limit") || "50", 10);
  const limit = Math.min(100, Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : 50));
  const result = await env.MALIPHONE_DB
    .prepare(`SELECT id AS request_id, quota_day, feature, mode,
        app_id AS app, action_id AS action, request_type, provider_id, model,
        input_chars, output_chars, estimated_input_tokens, input_tokens,
        output_tokens, total_tokens, reasoning_tokens, cached_tokens,
        points_charged, points_refunded, latency_ms, generation_id,
        status, error_code, created_at, completed_at
      FROM ai_usage_requests
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?`)
    .bind(user.id, limit)
    .all();
  return {
    limit,
    entries: Array.isArray(result?.results) ? result.results : [],
  };
}

async function parseMaliRequest(request, env) {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_MALI_REQUEST_BYTES) throw new Error("Mali request is too large");
  const input = JSON.parse(raw);
  if (!Array.isArray(input?.contents) || input.contents.length === 0) throw new Error("contents must be a non-empty array");
  const provider = ["gemini", "openrouter"].includes(String(input.provider || "").trim().toLowerCase())
    ? String(input.provider).trim().toLowerCase()
    : "";
  const requestedModel = String(input.model || "").trim();
  const model = normalizeMaliModelId(requestedModel);
  if (requestedModel && !model) throw new Error("model must be a valid provider/model id");
  const feature = /^[a-z0-9_-]{1,40}$/i.test(input.feature || "") ? String(input.feature).toLowerCase() : "chat";
  const mode = /^[a-z0-9_-]{1,24}$/i.test(input.mode || "") ? String(input.mode).toLowerCase() : "online";
  const requestType = input.requestType === "connection_test" ? "connection_test" : "generation";
  const app = normalizeMaliUsageLabel(input.app, feature || "other");
  const action = normalizeMaliUsageLabel(input.action, requestType === "connection_test" ? "connection_test" : "generate");
  const normalizeParts = (parts, label) => {
    if (!Array.isArray(parts) || !parts.length) throw new Error(`${label} must contain text parts`);
    return parts.map((part) => {
      if (!part || typeof part.text !== "string" || Object.keys(part).some((key) => key !== "text")) {
        throw new Error("Mali hosted test mode supports text only");
      }
      return { text: part.text };
    });
  };
  const contents = input.contents.map((content) => ({
    role: content?.role === "model" ? "model" : "user",
    parts: normalizeParts(content?.parts, "contents"),
  }));
  const systemInstruction = input.systemInstruction
    ? { parts: normalizeParts(input.systemInstruction.parts, "systemInstruction") }
    : null;
  const payloadText = getMaliPayloadText({ contents, systemInstruction });
  const inputChars = getTextCharCount(payloadText);
  if (!inputChars || inputChars > MAX_MALI_TEXT_CHARS) throw new Error("Mali hosted text request is empty or too long");
  const maxOutputTokens = Math.min(getPositiveInteger(input.maxOutputTokens, 512), getPositiveInteger(env.MALI_MAX_OUTPUT_TOKENS, 1024));
  return {
    provider,
    model,
    feature,
    mode,
    app,
    action,
    requestType,
    inputChars,
    estimatedInputTokens: estimateMaliTextTokens(payloadText),
    payload: {
      contents,
      ...(systemInstruction ? { systemInstruction } : {}),
      generationConfig: { maxOutputTokens },
    },
  };
}

async function generateWithMaliPool(request, env, user) {
  if (!isMaliTestModeEnabled(env)) return json(request, env, { error: "Mali test mode is disabled" }, 503);
  if (!env.MALIPHONE_DB) return json(request, env, { error: "D1 database is not configured" }, 503);

  let parsed;
  try {
    parsed = await parseMaliRequest(request, env);
  } catch (error) {
    return json(request, env, { error: error?.message || "Invalid Mali request" }, 400);
  }
  const account = await getMaliTestAccount(env, user.id, user.email);
  if (!isMaliAccountActive(account)) return json(request, env, { error: "This account is not enabled for Mali test models" }, 403);
  const providers = getMaliProviders(env, parsed.provider, account, parsed.model);
  if (!providers.length) return json(request, env, { error: "Mali model is not configured for this account" }, 503);
  if (parsed.requestType === "connection_test" && !(await canRunConnectionTest(env, user.id))) {
    return json(request, env, { error: "Connection test is rate limited" }, 429);
  }
  const requestedPoints = parsed.requestType === "connection_test"
    ? 0
    : getMaliPointCost({ feature: parsed.feature, mode: parsed.mode });
  if (parsed.requestType !== "connection_test" && getRemainingMaliPoints(account) < requestedPoints) {
    return json(request, env, { error: "Test points exhausted" }, 402);
  }
  const reservation = await reserveMaliRequest(env, user.id, {
    email: user.email,
    feature: parsed.feature,
    mode: parsed.mode,
    app: parsed.app,
    action: parsed.action,
    requestType: parsed.requestType,
    pointsCharged: requestedPoints,
    inputChars: parsed.inputChars,
    estimatedInputTokens: parsed.estimatedInputTokens,
  });
  if (!reservation) return json(request, env, { error: "Daily Mali allowance or test points exhausted" }, 429);

  let pointsRefunded = false;
  const refundReservation = async () => {
    if (pointsRefunded || !reservation.pointsCharged) return;
    pointsRefunded = true;
    await refundMaliAccountPoints(env, user.id, user.email, reservation.pointsCharged);
    await env.MALIPHONE_DB.prepare("UPDATE ai_usage_requests SET points_refunded = ? WHERE id = ?")
      .bind(reservation.pointsCharged, reservation.requestId).run();
  };

  for (const provider of providers) {
    const attemptId = await reserveProviderAttempt(env, reservation.requestId, provider, reservation.quotaDay);
    if (!attemptId) continue;
    const startedAt = Date.now();
    try {
      const providerRequest = getProviderRequest(provider, parsed, env);
      const upstream = await fetch(providerRequest.endpoint, {
        method: "POST",
        headers: providerRequest.headers,
        body: JSON.stringify(providerRequest.body),
      });
      const payload = await upstream.json().catch(() => null);
      if (upstream.ok) {
        const usage = getProviderUsage(provider, payload);
        const outputText = getProviderText(provider, payload);
        const latencyMs = Math.max(0, Date.now() - startedAt);
        const inputTokens = usage.inputTokens;
        const outputTokens = usage.outputTokens;
        const totalTokens = usage.totalTokens;
        const reasoningTokens = usage.reasoningTokens;
        const cachedTokens = usage.cachedTokens;
        const generationId = typeof payload?.id === "string" ? payload.id : null;
        await env.MALIPHONE_DB.batch([
          env.MALIPHONE_DB.prepare(`UPDATE ai_provider_attempts
            SET status = 'succeeded', model = ?, input_tokens = ?, output_tokens = ?, total_tokens = ?, input_chars = ?, output_chars = ?, latency_ms = ?, completed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
            WHERE id = ?`)
            .bind(provider.model, inputTokens, outputTokens, totalTokens, parsed.inputChars, getTextCharCount(outputText), latencyMs, attemptId),
          env.MALIPHONE_DB.prepare(`UPDATE ai_usage_requests
            SET status = 'succeeded', provider_id = ?, model = ?, input_tokens = ?, output_tokens = ?, total_tokens = ?,
              reasoning_tokens = ?, cached_tokens = ?, output_chars = ?, latency_ms = ?, generation_id = ?, completed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
            WHERE id = ?`)
            .bind(provider.id, provider.model, inputTokens, outputTokens, totalTokens, reasoningTokens, cachedTokens, getTextCharCount(outputText), latencyMs, generationId, reservation.requestId),
        ]);
        return json(request, env, {
          provider: provider.id,
          model: provider.model,
          requestId: reservation.requestId,
          createdAt: reservation.createdAt,
          app: reservation.app,
          action: reservation.action,
          pointsCharged: reservation.pointsCharged,
          connectionTestCount: reservation.connectionTestCount || null,
          balance: {
            grantedPoints: Number(reservation.account?.granted_points || 0),
            usedPoints: Number(reservation.account?.used_points || 0),
            remainingPoints: getRemainingMaliPoints(reservation.account),
            connectionTestCount: Number(reservation.account?.connection_test_count || 0),
          },
          usage: {
            inputTokens,
            outputTokens,
            totalTokens,
            reasoningTokens,
            cachedTokens,
            inputChars: parsed.inputChars,
            outputChars: getTextCharCount(outputText),
            latencyMs,
          },
          response: payload,
        });
      }
      const errorCode = String(upstream.status);
      await env.MALIPHONE_DB.prepare("UPDATE ai_provider_attempts SET status = 'failed', model = ?, error_code = ?, latency_ms = ?, completed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?")
        .bind(provider.model, errorCode, Math.max(0, Date.now() - startedAt), attemptId).run();
      if (![429, 500, 502, 503, 504].includes(upstream.status)) {
        await refundReservation();
        await env.MALIPHONE_DB.prepare("UPDATE ai_usage_requests SET status = 'failed', error_code = ?, latency_ms = ?, completed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?")
          .bind(errorCode, Math.max(0, Date.now() - startedAt), reservation.requestId).run();
        return json(request, env, { error: payload?.error?.message || "Mali model request failed" }, upstream.status);
      }
    } catch {
      await env.MALIPHONE_DB.prepare("UPDATE ai_provider_attempts SET status = 'failed', model = ?, error_code = 'NETWORK', latency_ms = ?, completed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?")
        .bind(provider.model, Math.max(0, Date.now() - startedAt), attemptId).run();
    }
  }
  await refundReservation();
  await env.MALIPHONE_DB.prepare("UPDATE ai_usage_requests SET status = 'failed', error_code = 'NO_PROVIDER_CAPACITY', completed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?")
    .bind(reservation.requestId).run();
  return json(request, env, { error: "Mali model capacity is temporarily unavailable" }, 503);
}

async function handleGitHubDeviceFlow(request, env, url) {
  const endpoint = url.pathname === "/v1/github/device/code"
    ? "https://github.com/login/device/code"
    : url.pathname === "/v1/github/device/token"
      ? "https://github.com/login/oauth/access_token"
      : "";
  if (!endpoint || request.method !== "POST") return json(request, env, { error: "Not found" }, 404);

  let input;
  try {
    input = await request.json();
  } catch {
    return json(request, env, { error: "Request body must be valid JSON" }, 400);
  }

  const clientId = String(input?.client_id || "").trim();
  if (!clientId || clientId.length > 200) return json(request, env, { error: "GitHub client_id is required" }, 400);
  const values = { client_id: clientId };
  if (url.pathname.endsWith("/code")) {
    values.scope = "repo";
  } else {
    const deviceCode = String(input?.device_code || "").trim();
    if (!deviceCode || deviceCode.length > 200) return json(request, env, { error: "GitHub device_code is required" }, 400);
    values.device_code = deviceCode;
    values.grant_type = "urn:ietf:params:oauth:grant-type:device_code";
  }

  try {
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(values).toString(),
    });
    const headers = new Headers(corsHeaders(request, env));
    headers.set("Content-Type", "application/json; charset=utf-8");
    return new Response(await upstream.text(), { status: upstream.status, headers });
  } catch (error) {
    return json(request, env, { error: "GitHub authorization proxy failed", message: error?.message || "Unknown error" }, 502);
  }
}

async function handleDataApi(request, env, url) {
  if (url.pathname === "/v1/health" && request.method === "GET") {
    let database = "not_bound";
    if (env.MALIPHONE_DB) {
      try {
        await env.MALIPHONE_DB.prepare("SELECT 1").first();
        database = "ready";
      } catch {
        database = "unavailable";
      }
    }
    return json(request, env, {
      ok: database === "ready",
      service: "MaliPhone data API",
      database,
      media: env.MALIPHONE_MEDIA ? "ready" : "not_bound",
    }, database === "unavailable" ? 503 : 200);
  }

  const user = await requireUser(request, env);
  if (!user) return json(request, env, { error: "Authentication required" }, 401);

  if (url.pathname === "/v1/me" && request.method === "GET") {
    return json(request, env, { id: user.id, email: user.email || null });
  }

  if (url.pathname === "/v1/mali/quota" && request.method === "GET") {
    if (!env.MALIPHONE_DB) return json(request, env, { error: "D1 database is not configured" }, 503);
    return json(request, env, await getMaliQuota(env, user));
  }

  if (url.pathname === "/v1/mali/usage" && request.method === "GET") {
    if (!env.MALIPHONE_DB) return json(request, env, { error: "D1 database is not configured" }, 503);
    return json(request, env, await getMaliUsage(env, user, url));
  }

  if (url.pathname === "/v1/mali/generate" && request.method === "POST") {
    return generateWithMaliPool(request, env, user);
  }

  const documentKey = getPathSegment(url.pathname, "/v1/documents/");
  if (documentKey) {
    if (!env.MALIPHONE_DB) return json(request, env, { error: "D1 database is not configured" }, 503);
    if (request.method === "GET") {
      const document = await env.MALIPHONE_DB
        .prepare("SELECT document_json, revision, updated_at FROM user_documents WHERE user_id = ? AND document_key = ?")
        .bind(user.id, documentKey)
        .first();
      if (!document) return json(request, env, { error: "Document not found" }, 404);
      return json(request, env, {
        key: documentKey,
        data: JSON.parse(document.document_json),
        revision: document.revision,
        updatedAt: document.updated_at,
      });
    }
    if (request.method === "PUT") {
      const body = await request.text();
      if (new TextEncoder().encode(body).byteLength > MAX_DOCUMENT_BYTES) {
        return json(request, env, { error: "Document is too large" }, 413);
      }
      let data;
      try {
        data = JSON.parse(body);
      } catch {
        return json(request, env, { error: "Request body must be valid JSON" }, 400);
      }
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        return json(request, env, { error: "Document must be a JSON object" }, 400);
      }
      await env.MALIPHONE_DB
        .prepare(`INSERT INTO user_documents (user_id, document_key, document_json, revision)
          VALUES (?, ?, ?, 1)
          ON CONFLICT(user_id, document_key) DO UPDATE SET
            document_json = excluded.document_json,
            revision = user_documents.revision + 1,
            updated_at = datetime('now')`)
        .bind(user.id, documentKey, JSON.stringify(data))
        .run();
      const saved = await env.MALIPHONE_DB
        .prepare("SELECT revision, updated_at FROM user_documents WHERE user_id = ? AND document_key = ?")
        .bind(user.id, documentKey)
        .first();
      return json(request, env, { key: documentKey, revision: saved?.revision || 1, updatedAt: saved?.updated_at || null });
    }
    return json(request, env, { error: "Method not allowed" }, 405);
  }

  const mediaName = getPathSegment(url.pathname, "/v1/media/");
  if (mediaName) {
    if (!env.MALIPHONE_MEDIA) return json(request, env, { error: "R2 bucket is not configured" }, 503);
    const objectKey = getMediaObjectKey(user.id, mediaName);
    if (request.method === "GET") {
      const object = await env.MALIPHONE_MEDIA.get(objectKey);
      if (!object) return json(request, env, { error: "Media not found" }, 404);
      const headers = new Headers(corsHeaders(request, env));
      headers.set("Content-Type", object.httpMetadata?.contentType || "application/octet-stream");
      if (object.httpEtag) headers.set("ETag", object.httpEtag);
      return new Response(object.body, { headers });
    }
    if (request.method === "PUT") {
      const contentLength = Number(request.headers.get("Content-Length") || 0);
      if (contentLength > MAX_MEDIA_BYTES) return json(request, env, { error: "Media is too large" }, 413);
      const bytes = await request.arrayBuffer();
      if (bytes.byteLength > MAX_MEDIA_BYTES) return json(request, env, { error: "Media is too large" }, 413);
      const contentType = request.headers.get("Content-Type") || "application/octet-stream";
      const uploaded = await env.MALIPHONE_MEDIA.put(objectKey, bytes, { httpMetadata: { contentType } });
      return json(request, env, { key: mediaName, etag: uploaded.httpEtag || null }, 201);
    }
    return json(request, env, { error: "Method not allowed" }, 405);
  }

  return json(request, env, { error: "Not found" }, 404);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    const url = new URL(request.url);
    if (url.pathname.startsWith("/v1/github/device/")) return handleGitHubDeviceFlow(request, env, url);
    if (url.pathname.startsWith("/v1/")) return handleDataApi(request, env, url);

    if (url.pathname === "/" || url.pathname === "/health") {
      return json(request, env, {
        ok: true,
        name: "MALIPHONE Cloudflare AI Proxy",
        usage: "/claude/messages, /claude/models, /ollama/chat/completions, /ollama/models, /nvidia/chat/completions, /nvidia/models",
      });
    }

    const { providerKey, providerPath } = stripProviderPrefix(url.pathname);
    const provider = PROVIDERS[providerKey];
    if (!provider) return json(request, env, { error: "Unsupported provider" }, 404);
    if (!["GET", "POST"].includes(request.method)) return json(request, env, { error: "Method not allowed" }, 405);
    if (!isAllowedPath(provider, providerPath)) return json(request, env, { error: "Path is not allowed for this provider" }, 403);

    const targetUrl = new URL(`${provider.baseUrl}${providerPath}`);
    url.searchParams.forEach((value, key) => targetUrl.searchParams.set(key, value));
    try {
      const upstream = await fetch(targetUrl.toString(), {
        method: request.method,
        headers: sanitizeHeaders(request, providerKey),
        body: request.method === "GET" ? undefined : request.body,
        redirect: "follow",
      });
      const headers = new Headers(upstream.headers);
      Object.entries(corsHeaders(request, env)).forEach(([key, value]) => headers.set(key, value));
      return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers });
    } catch (error) {
      return json(request, env, { error: "Proxy request failed", message: error?.message || "Unknown error" }, 502);
    }
  },
};
