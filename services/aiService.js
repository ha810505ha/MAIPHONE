import { fetchWithTimeout, NETWORK_TIMEOUTS } from "../utils/networkRequest.js";
import { recordRuntimeDiagnostic } from "./diagnostics/runtimeDiagnostics.js";
import { getMaliTestRuntime } from "./cloud/maliTestRuntime.js";
import { runMaliTextGeneration } from "./cloud/maliTestService.js";

const NVIDIA_PROXY_BASE_URL = "https://maliphone-ai-proxy.d778105.workers.dev/nvidia";

const resolveRequestBaseUrl = (provider, configuredBaseUrl) => (
  provider === "nvidia" ? NVIDIA_PROXY_BASE_URL : configuredBaseUrl
);

export const isHostedTestMode = (apiConfig) => apiConfig?.aiSource === "hosted_test";

export const isAiConfigReady = (apiConfig) => {
  if (isHostedTestMode(apiConfig)) return Boolean(apiConfig?.hostedTestProvider && apiConfig?.hostedTestModel);
  const provider = apiConfig?.provider;
  if (!provider) return false;
  const isOllamaLocal = provider === "ollama" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(apiConfig?.baseUrl || "");
  return isOllamaLocal || Boolean(apiConfig?.apiKey);
};

const extractHostedText = (payload) => (
  payload?.response?.candidates?.[0]?.content?.parts?.map((part) => part?.text || "").join("")
  || payload?.response?.choices?.[0]?.message?.content
  || ""
);

async function callHostedTestRequest(messages, apiConfig, sysPrompt, options = {}) {
  const runtime = getMaliTestRuntime();
  if (!runtime.session?.access_token) {
    throw new Error("測試 LLM 需要先登入可用的測試帳號");
  }
  if (!apiConfig?.hostedTestProvider || !apiConfig?.hostedTestModel) {
    throw new Error("請先在測試模型面板選擇可用模型");
  }
  if (messages.some((message) => message?.image)) {
    throw new Error("測試 LLM 目前只支援文字，不會傳送圖片內容");
  }
  const contents = messages
    .filter((message) => message?.role !== "system")
    .map((message) => ({
      role: message?.role === "assistant" ? "model" : "user",
      parts: [{ text: String(message?.content || "") }],
    }));
  if (!contents.length) contents.push({ role: "user", parts: [{ text: "請回覆。" }] });
  const maxOutputTokens = Number(apiConfig.maxTokens) > 0 ? Number(apiConfig.maxTokens) : 4000;
  const payload = await runMaliTextGeneration(runtime.session, runtime.environment, {
    provider: apiConfig.hostedTestProvider,
    model: apiConfig.hostedTestModel,
    feature: options.feature || "other",
    mode: options.mode || "app",
    app: options.app || options.feature || "other",
    action: options.action || "generate",
    maxOutputTokens,
    systemPrompt: sysPrompt || "",
    contents,
    signal: options.signal,
  });
  const text = extractHostedText(payload);
  if (!text.trim()) throw new Error("測試 LLM 沒有回傳文字內容");
  return text;
}

async function callAIRequest(messages, apiConfig, sysPrompt, options = {}) {
  if (isHostedTestMode(apiConfig)) return callHostedTestRequest(messages, apiConfig, sysPrompt, options);
  const { provider, baseUrl: configuredBaseUrl, apiKey, model } = apiConfig;
  const baseUrl = resolveRequestBaseUrl(provider, configuredBaseUrl);
  const request = (url, init) => fetchWithTimeout(url, init, {
    signal: options.signal,
    timeoutMs: options.timeoutMs || NETWORK_TIMEOUTS.AI,
  });
  const cleanBaseUrl = (baseUrl || "https://aiplatform.googleapis.com/v1").replace(/\/+$/, "");
  const isOllamaLocal = provider === "ollama" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(baseUrl || "");
  const providerNeedsApiKey = !(provider === "ollama" && isOllamaLocal);
  if (providerNeedsApiKey && !apiKey) throw new Error("請先設定 API Key");

  const sys = sysPrompt || "你是一位自然、友善、穩定的 AI 角色助理。";
  const maxTokens = Number(apiConfig.maxTokens) > 0 ? Number(apiConfig.maxTokens) : 4000;
  const hasImageInput = messages.some((m) => !!m.image);
  const temperature = apiConfig.temperatureEnabled && Number.isFinite(Number(apiConfig.temperature))
    ? Math.max(0, Math.min(2, Number(apiConfig.temperature))) : null;

  if (hasImageInput && provider === "openrouter" && String(model || "").toLowerCase() === "auto") {
    throw new Error("OpenRouter 的 auto 可能會選到不支援圖片的模型，請改成可視覺模型（例如 openai/gpt-4o-mini、anthropic/claude-3.5-sonnet）。");
  }

  if (provider === "claude") {
    const res = await request(`${baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        ...(temperature == null ? {} : { temperature }),
        system: sys,
        messages: messages
          .filter((m) => m.role !== "system")
          .map((m) => ({
            role: m.role,
            content: m.image
              ? [
                  { type: "image", source: { type: "base64", media_type: "image/png", data: m.image } },
                  { type: "text", text: m.content || "請描述這張圖" },
                ]
              : m.content,
          })),
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.content?.[0]?.text || "";
  }

  // Gemini/Vertex 共用：轉成原生多輪 contents 格式（user/model 交錯，圖片走 inlineData）
  const buildGeminiBody = () => {
    const contents = [];
    for (const m of messages) {
      if (m.role !== "user" && m.role !== "assistant" && m.role !== "system") continue;
      const role = m.role === "assistant" ? "model" : "user";
      const parts = [];
      if (m.image) parts.push({ inlineData: { mimeType: "image/png", data: m.image } });
      parts.push({ text: m.content || (m.image ? "請描述這張圖" : "") });
      // Gemini 要求 user/model 交錯，連續同角色訊息合併成同一輪的多個 parts
      const last = contents[contents.length - 1];
      if (last && last.role === role) last.parts.push(...parts);
      else contents.push({ role, parts });
    }
    if (!contents.length || contents[0].role !== "user") {
      contents.unshift({ role: "user", parts: [{ text: "（對話開始）" }] });
    }
    return {
      systemInstruction: { parts: [{ text: sys }] },
      contents,
      generationConfig: { maxOutputTokens: maxTokens, ...(temperature == null ? {} : { temperature }) },
    };
  };

  if (provider === "gemini") {
    const res = await request(`${baseUrl}/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildGeminiBody()),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.error) throw new Error(data?.error?.message || `HTTP ${res.status}`);
    const out = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
    return out || "";
  }

  if (provider === "vertex") {
    const endpoint = `${cleanBaseUrl}/publishers/google/models/${encodeURIComponent(model)}:streamGenerateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await request(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildGeminiBody()),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      const errMsg = data?.error?.message || `HTTP ${res.status}`;
      if (res.status === 404) {
        throw new Error(`Vertex 404：請確認模型名稱或快捷模式 region/設定是否正確（目前模型：${model || "-"}）`);
      }
      throw new Error(errMsg);
    }
    const text = await res.text();
    const tryExtractText = (obj) =>
      obj?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") ||
      obj?.candidates?.[0]?.content?.parts?.[0]?.text ||
      obj?.candidates?.[0]?.content?.text ||
      obj?.text ||
      "";

    let out = "";
    // Vertex streamGenerateContent commonly returns one complete JSON array.
    // Parse that first; line-by-line parsing of pretty-printed arrays can
    // accidentally accept only one chunk and leave the reply truncated.
    try {
      const parsed = JSON.parse(text);
      out = Array.isArray(parsed)
        ? parsed.map(tryExtractText).join("")
        : tryExtractText(parsed);
    } catch (_) {
      const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      for (const line of lines) {
        const payload = line.startsWith("data:") ? line.slice(5).trim() : line;
        if (!payload || payload === "[DONE]") continue;
        try {
          const chunk = JSON.parse(payload);
          out += tryExtractText(chunk);
        } catch (_) {}
      }
    }

    const finalText = out.trim();
    if (!finalText) throw new Error("Vertex 已連線但回覆空白，請先換成 `gemini-2.5-flash` 或 `gemini-2.5-pro` 測試");
    return finalText;
  }

  const headers = { "Content-Type": "application/json" };
  if (providerNeedsApiKey) headers.Authorization = `Bearer ${apiKey}`;
  if (provider === "openrouter") headers["HTTP-Referer"] = "https://maliphone.app";

  const apiMsgs = [
    { role: "system", content: sys },
    ...messages.map((m) =>
      m.image
        ? {
            role: m.role,
            content: [
              { type: "image_url", image_url: { url: `data:image/png;base64,${m.image}` } },
              { type: "text", text: m.content || "請描述這張圖" },
            ],
          }
        : { role: m.role, content: m.content || "" }
    ),
  ];
  const usesMaxCompletionTokens =
    provider === "openai" ||
    /^o\d/i.test(String(model || "")) ||
    /^gpt-5/i.test(String(model || ""));
  const completionLimit = usesMaxCompletionTokens
    ? { max_completion_tokens: maxTokens }
    : { max_tokens: maxTokens };

  const res = await request(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ model, messages: apiMsgs, ...completionLimit, ...(temperature == null ? {} : { temperature }) }),
  });

  let data = null;
  try {
    data = await res.json();
  } catch (_) {
    data = null;
  }
  if (!res.ok) {
    const errMsg = data?.error?.message || data?.message || `HTTP ${res.status}`;
    throw new Error(`[${provider}/${model}] ${errMsg}`);
  }
  if (data?.error) {
    const rawMsg = data.error.message || JSON.stringify(data.error);
    if (/support image input|image input|vision|multimodal/i.test(rawMsg)) {
      throw new Error("目前選用模型不支援圖片輸入，請改成支援視覺的模型後再試。");
    }
    throw new Error(`[${provider}/${model}] ${rawMsg}`);
  }
  return data?.choices?.[0]?.message?.content || "";
}

async function callAI(messages, apiConfig, sysPrompt, options = {}) {
  try {
    return await callAIRequest(messages, apiConfig, sysPrompt, options);
  } catch (error) {
    recordRuntimeDiagnostic({
      kind: "ai-error",
      error,
      source: `aiService:${isHostedTestMode(apiConfig) ? "hosted_test" : String(apiConfig?.provider || "unknown")}`,
    });
    throw error;
  }
}

async function fetchAvailableModels(apiConfig, options = {}) {
  const { provider, baseUrl: configuredBaseUrl, apiKey } = apiConfig;
  const baseUrl = resolveRequestBaseUrl(provider, configuredBaseUrl);
  const request = (url, init) => fetchWithTimeout(url, init, {
    signal: options.signal,
    timeoutMs: options.timeoutMs || NETWORK_TIMEOUTS.METADATA,
  });
  const cleanBaseUrl = (baseUrl || "https://aiplatform.googleapis.com/v1").replace(/\/+$/, "");
  const isOllamaLocal = provider === "ollama" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(baseUrl || "");
  const providerNeedsApiKey = !(provider === "ollama" && isOllamaLocal);
  if (providerNeedsApiKey && !apiKey) throw new Error("請先設定 API Key");

  if (provider === "ollama" && /ollama\.com/i.test(baseUrl || "")) {
    const cleanBase = (baseUrl || "").replace(/\/+$/, "");
    const candidates = [
      `${cleanBase}/models`,
      `${cleanBase.replace(/\/v1$/i, "")}/api/tags`,
    ];
    for (const url of candidates) {
      try {
        const res = await request(url, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message || data?.error || `HTTP ${res.status}`);
        if (Array.isArray(data?.data)) return data.data.map((m) => m.id).filter(Boolean);
        if (Array.isArray(data?.models)) return data.models.map((m) => m.name).filter(Boolean);
      } catch (_) {}
    }
    throw new Error(`Ollama 模型抓取失敗（已嘗試 v1/models 與 api/tags）`);
  }

  if (provider === "gemini") {
    const res = await request(`${baseUrl}/models?key=${apiKey}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
    return (data.models || []).map((m) => (m.name || "").replace(/^models\//, "")).filter(Boolean);
  }

  if (provider === "vertex") {
    const res = await request(`${cleanBaseUrl}/publishers/google/models?key=${encodeURIComponent(apiKey)}`);
    const data = await res.json();
    if (!res.ok) {
      const errMsg = data?.error?.message || `HTTP ${res.status}`;
      if (res.status === 404) {
        throw new Error("Vertex 模型列表 404：請先確認快捷模式、API key 與網址是否正確");
      }
      throw new Error(errMsg);
    }
    return (data?.models || []).map((m) => (m.name || "").replace(/^.*\/models\//, "")).filter(Boolean);
  }

  if (provider === "claude") {
    const res = await request(`${baseUrl}/models`, {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
    return (data.data || []).map((m) => m.id).filter(Boolean);
  }

  if (provider === "novelai") {
    const headers = {};
    if (providerNeedsApiKey) headers.Authorization = `Bearer ${apiKey}`;
    const fallbackModels = ["kayra", "erato", "clio"];
    try {
      const res = await request(`${baseUrl}/models`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
      const list = (data.data || []).map((m) => m.id).filter(Boolean);
      return list.length ? list : fallbackModels;
    } catch (_) {
      return fallbackModels;
    }
  }

  const headers = {};
  if (providerNeedsApiKey) headers.Authorization = `Bearer ${apiKey}`;
  if (provider === "openrouter") headers["HTTP-Referer"] = "https://maliphone.app";
  const nvidiaFallbackModels = [
    "meta/llama-3.3-70b-instruct",
    "openai/gpt-oss-20b",
    "openai/gpt-oss-120b",
    "deepseek-ai/deepseek-v4-flash",
    "qwen/qwen3.5-122b-a10b",
  ];
  try {
    const res = await request(`${baseUrl}/models`, { headers });
    const data = await res.json();
    if (!res.ok) {
      const error = new Error(data?.error?.message || data?.detail || `HTTP ${res.status}`);
      error.status = res.status;
      throw error;
    }
    const models = (data.data || []).map((m) => m.id).filter(Boolean);
    return provider === "nvidia" && !models.length ? nvidiaFallbackModels : models;
  } catch (error) {
    if (provider === "nvidia" && ![401, 403].includes(error?.status)) return nvidiaFallbackModels;
    throw error;
  }
}

export { callAI, fetchAvailableModels };
