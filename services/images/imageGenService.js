import { fetchWithTimeout, NETWORK_TIMEOUTS } from "../../utils/networkRequest.js";

// 算圖服務。與 aiService.js 分開：算圖的 endpoint、模型、金鑰通常和聊天不同一組。
// 目前只實作 Gemini（generateContent 走 IMAGE modality），provider 用 switch 留給之後擴充。
//
// 設定物件 imageApiConfig 形狀比照 aiService 的 apiConfig：
//   { provider, baseUrl, apiKey, model }

export const IMAGE_PROVIDERS = [
  {
    id: "gemini",
    name: "Gemini 圖像",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    // 模型會改版，這裡只是預設值；設定頁允許玩家自行輸入。
    models: ["gemini-2.5-flash-image", "gemini-3-pro-image-preview"],
  },
];

export const DEFAULT_IMAGE_API = {
  provider: "gemini",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta",
  apiKey: "",
  model: "gemini-2.5-flash-image",
};

// 一次呼叫的張數上限；未指定 count 時預設 1 張，因為每張都是玩家自己的錢。
const MAX_IMAGES_PER_CALL = 4;

function base64ToBlob(base64, mimeType) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType || "image/png" });
}

/**
 * Gemini 沒有原生 negativePrompt 欄位，只能用文字描述帶進去。
 * 效果不如 SD 系的權重式負面詞，但聊勝於無。
 */
function buildPromptText(prompt, negativePrompt) {
  const main = String(prompt || "").trim();
  const negative = String(negativePrompt || "").trim();
  if (!main) throw new Error("請先輸入圖片描述");
  return negative ? `${main}\n\n避免出現：${negative}` : main;
}

async function generateWithGemini(params, config) {
  const { baseUrl, apiKey, model } = config;
  const cleanBaseUrl = (baseUrl || DEFAULT_IMAGE_API.baseUrl).replace(/\/+$/, "");
  const useModel = model || DEFAULT_IMAGE_API.model;

  const parts = [{ text: buildPromptText(params.prompt, params.negativePrompt) }];
  // 參考圖：拿角色既有的圖當底，讓多張圖的長相比較一致。
  if (params.referenceImage) {
    parts.unshift({
      inlineData: {
        mimeType: params.referenceMimeType || "image/png",
        data: params.referenceImage, // 純 base64，不含 data: 前綴
      },
    });
  }

  const generationConfig = {
    responseModalities: ["TEXT", "IMAGE"],
    candidateCount: Math.max(1, Math.min(MAX_IMAGES_PER_CALL, Number(params.count) || 1)),
  };
  // aspectRatio 是較新模型才有的欄位，沒指定就不送，避免舊模型回 400。
  if (params.aspectRatio) {
    generationConfig.imageConfig = { aspectRatio: params.aspectRatio };
  }

  const res = await fetchWithTimeout(
    `${cleanBaseUrl}/models/${encodeURIComponent(useModel)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig,
      }),
    },
    {
      signal: params.signal,
      timeoutMs: params.timeoutMs || NETWORK_TIMEOUTS.MEDIA,
    },
  );

  const data = await res.json().catch(() => null);
  if (!res.ok || data?.error) {
    throw new Error(normalizeGeminiError(data?.error?.message || `HTTP ${res.status}`, res.status, useModel));
  }

  const images = [];
  let note = "";
  for (const candidate of data?.candidates || []) {
    for (const part of candidate?.content?.parts || []) {
      if (part?.inlineData?.data) {
        images.push({
          blob: base64ToBlob(part.inlineData.data, part.inlineData.mimeType),
          mimeType: part.inlineData.mimeType || "image/png",
        });
      } else if (part?.text) {
        note += part.text;
      }
    }
  }

  if (!images.length) {
    // 被安全機制擋下時通常沒有圖、只有 finishReason 或一段文字說明。
    const reason = data?.candidates?.[0]?.finishReason || "";
    const blocked = data?.promptFeedback?.blockReason || "";
    if (blocked || /SAFETY|PROHIBITED|BLOCK/i.test(reason)) {
      throw new Error("這個描述被 Gemini 的內容政策擋下了，請調整描述後再試。");
    }
    throw new Error(note.trim() || `模型沒有回傳圖片，請確認 ${useModel} 是圖像生成模型。`);
  }

  return { images, note: note.trim() };
}

function normalizeGeminiError(message, status, model) {
  if (status === 400 && /modalit/i.test(message)) {
    return `${model} 似乎不支援圖片輸出，請在設定改用圖像生成模型。`;
  }
  if (status === 401 || status === 403) return "API Key 無效或沒有這個模型的權限。";
  if (status === 404) return `找不到模型 ${model}，請確認名稱是否正確。`;
  if (status === 429) return "已達 API 用量上限，請稍後再試或檢查你的 Google 帳單設定。";
  return message;
}

/**
 * 產圖主入口。
 *
 * params: { prompt, negativePrompt, count, aspectRatio, referenceImage, referenceMimeType, signal }
 * 回傳:   { images: [{ blob, mimeType }], note }
 *
 * 注意：這裡不做每日次數上限或扣費確認，那些屬於 UI 層的責任。
 */
export async function generateImage(params, imageApiConfig) {
  const config = { ...DEFAULT_IMAGE_API, ...(imageApiConfig || {}) };
  if (!config.apiKey) throw new Error("請先在設定填入算圖 API Key");

  switch (config.provider) {
    case "gemini":
      return generateWithGemini(params || {}, config);
    default:
      throw new Error(`尚未支援的算圖服務：${config.provider}`);
  }
}

// Google 的 ListModels 不會告訴我們哪些模型「輸出」圖片 —— 聊天模型和圖像模型
// 都只回報 generateContent。只能靠命名推測，所以 UI 一定要保留手動輸入。
// vision 是「看得懂圖」不是「畫得出圖」，要排除。
const IMAGE_MODEL_HINT = /(^imagen|[-_]image($|[-_.])|[-_]image$)/i;
const VISION_ONLY_HINT = /vision|embedding/i;

/**
 * 抓可用模型清單。
 * 回傳 { imageModels, allModels } —— imageModels 是名稱推測後的候選，
 * 推測失效時 UI 可以改顯示 allModels 讓玩家自己挑。
 */
export async function fetchImageModels(imageApiConfig, options = {}) {
  const config = { ...DEFAULT_IMAGE_API, ...(imageApiConfig || {}) };
  if (!config.apiKey) throw new Error("請先填入算圖 API Key");
  if (config.provider !== "gemini") throw new Error(`尚未支援的算圖服務：${config.provider}`);

  const cleanBaseUrl = (config.baseUrl || DEFAULT_IMAGE_API.baseUrl).replace(/\/+$/, "");
  const res = await fetchWithTimeout(
    `${cleanBaseUrl}/models?key=${encodeURIComponent(config.apiKey)}`,
    {},
    { signal: options.signal, timeoutMs: options.timeoutMs || NETWORK_TIMEOUTS.METADATA },
  );
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.error) {
    throw new Error(normalizeGeminiError(data?.error?.message || `HTTP ${res.status}`, res.status, "models"));
  }

  const usable = (data?.models || [])
    .filter((m) => {
      const methods = m?.supportedGenerationMethods || [];
      return methods.includes("generateContent") || methods.includes("predict");
    })
    .map((m) => (m.name || "").replace(/^models\//, ""))
    .filter(Boolean);

  const imageModels = usable.filter((id) => IMAGE_MODEL_HINT.test(id) && !VISION_ONLY_HINT.test(id));
  return { imageModels, allModels: usable };
}

/** 設定頁「測試連線」用：跑一張最小的圖確認 key 與模型可用。 */
export async function testImageApi(imageApiConfig) {
  const result = await generateImage(
    { prompt: "a simple red circle on white background", count: 1 },
    imageApiConfig,
  );
  return result.images.length > 0;
}
