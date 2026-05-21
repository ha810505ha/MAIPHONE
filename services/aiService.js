async function callAI(messages, apiConfig, sysPrompt) {
  const { provider, baseUrl, apiKey, model } = apiConfig;
  const isOllamaLocal = provider === "ollama" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(baseUrl || "");
  const providerNeedsApiKey = !(provider === "ollama" && isOllamaLocal);
  if (providerNeedsApiKey && !apiKey) throw new Error("請先設定 API Key");

  const sys = sysPrompt || "你是一位自然、友善、穩定的 AI 角色助理。";
  const hasImageInput = messages.some((m) => !!m.image);

  if (hasImageInput && provider === "openrouter" && String(model || "").toLowerCase() === "auto") {
    throw new Error("OpenRouter 的 auto 可能會選到不支援圖片的模型，請改成可視覺模型（例如 openai/gpt-4o-mini、anthropic/claude-3.5-sonnet）。");
  }

  if (provider === "claude") {
    const res = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
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

  if (provider === "gemini") {
    const res = await fetch(`${baseUrl}/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: `${sys}\n\n${messages.map((m) => `${m.role}: ${m.content || ""}`).join("\n")}` }],
          },
        ],
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
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
    ? { max_completion_tokens: 1024 }
    : { max_tokens: 1024 };

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ model, messages: apiMsgs, ...completionLimit }),
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

async function fetchAvailableModels(apiConfig) {
  const { provider, baseUrl, apiKey } = apiConfig;
  const isOllamaLocal = provider === "ollama" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(baseUrl || "");
  const providerNeedsApiKey = !(provider === "ollama" && isOllamaLocal);
  if (providerNeedsApiKey && !apiKey) throw new Error("請先設定 API Key");

  if (provider === "ollama" && /ollama\.com/i.test(baseUrl || "")) {
    const cleanBase = (baseUrl || "").replace(/\/+$/, "");
    const candidates = [
      `${cleanBase}/models`, // e.g. https://ollama.com/v1/models
      `${cleanBase.replace(/\/v1$/i, "")}/api/tags`, // e.g. https://ollama.com/api/tags
    ];
    const errs = [];
    for (const url of candidates) {
      try {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message || data?.error || `HTTP ${res.status}`);
        if (Array.isArray(data?.data)) return data.data.map((m) => m.id).filter(Boolean);
        if (Array.isArray(data?.models)) return data.models.map((m) => m.name).filter(Boolean);
      } catch (e) {
        errs.push(`${url}: ${e.message}`);
      }
    }
    throw new Error(`Ollama 模型抓取失敗（已嘗試 v1/models 與 api/tags）`);
  }

  if (provider === "gemini") {
    const res = await fetch(`${baseUrl}/models?key=${apiKey}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
    return (data.models || []).map((m) => (m.name || "").replace(/^models\//, "")).filter(Boolean);
  }

  if (provider === "claude") {
    const res = await fetch(`${baseUrl}/models`, {
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
      const res = await fetch(`${baseUrl}/models`, { headers });
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
  const res = await fetch(`${baseUrl}/models`, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  return (data.data || []).map((m) => m.id).filter(Boolean);
}

export { callAI, fetchAvailableModels };
