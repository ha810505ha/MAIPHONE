import { fetchWithTimeout, NETWORK_TIMEOUTS } from "../utils/networkRequest.js";

const clamp = (value, min, max, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

const readError = async (response) => {
  try {
    const data = await response.json();
    return data?.detail?.message || data?.detail || data?.base_resp?.status_msg || data?.message || response.statusText;
  } catch {
    return response.statusText || `HTTP ${response.status}`;
  }
};

const hexToBlob = (hex, mimeType = "audio/mpeg") => {
  const clean = String(hex || "").replace(/\s+/g, "");
  if (!clean || clean.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(clean)) throw new Error("Invalid MiniMax audio response");
  const bytes = new Uint8Array(clean.length / 2);
  for (let index = 0; index < clean.length; index += 2) bytes[index / 2] = Number.parseInt(clean.slice(index, index + 2), 16);
  return new Blob([bytes], { type: mimeType });
};

export async function fetchElevenLabsDefaultVoices(apiKey, options = {}) {
  if (!String(apiKey || "").trim()) throw new Error("Missing TTS API key");
  const response = await fetchWithTimeout("https://api.elevenlabs.io/v2/voices?page_size=100&include_total_count=true&sort=name&sort_direction=asc", {
    headers: { "xi-api-key": String(apiKey).trim() },
  }, {
    signal: options.signal,
    timeoutMs: options.timeoutMs || NETWORK_TIMEOUTS.METADATA,
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = await response.json();
  return (Array.isArray(data?.voices) ? data.voices : []).map((voice) => ({
    id: voice.voice_id,
    name: voice.name || voice.voice_id,
    category: voice.category || "default",
    previewUrl: voice.preview_url || "",
  })).filter((voice) => voice.id).sort((a, b) => {
    const categoryOrder = { premade: 0, default: 0, generated: 1, cloned: 2, professional: 3 };
    return (categoryOrder[a.category] ?? 4) - (categoryOrder[b.category] ?? 4) || a.name.localeCompare(b.name);
  });
}

export async function synthesizeSpeech({ text, config, voiceSettings, signal, timeoutMs }) {
  const content = String(text || "").trim();
  if (!content) throw new Error("No text to synthesize");
  const provider = config?.provider || "elevenlabs";
  const providerConfig = config?.[provider] || {};
  const voice = voiceSettings?.[provider] || {};
  if (!providerConfig.apiKey) throw new Error("Missing TTS API key");
  if (!voice.voiceId?.trim()) throw new Error("Missing voice ID");

  if (provider === "elevenlabs") {
    const response = await fetchWithTimeout(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice.voiceId.trim())}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "xi-api-key": providerConfig.apiKey },
      body: JSON.stringify({
        text: content,
        model_id: providerConfig.model || "eleven_flash_v2_5",
        voice_settings: {
          stability: clamp(voice.stability, 0, 1, 0.5),
          similarity_boost: clamp(voice.similarity, 0, 1, 0.75),
          style: 0,
          use_speaker_boost: true,
          speed: clamp(voice.speed, 0.7, 1.2, 1),
        },
      }),
    }, {
      signal,
      timeoutMs: timeoutMs || NETWORK_TIMEOUTS.MEDIA,
    });
    if (!response.ok) throw new Error(await readError(response));
    return response.blob();
  }

  if (provider === "minimax") {
    const baseUrl = String(providerConfig.baseUrl || "https://api.minimax.io").replace(/\/$/, "");
    const response = await fetchWithTimeout(`${baseUrl}/v1/t2a_v2`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${providerConfig.apiKey}` },
      body: JSON.stringify({
        model: providerConfig.model || "speech-2.8-turbo",
        text: content,
        stream: false,
        language_boost: "auto",
        output_format: "hex",
        voice_setting: {
          voice_id: voice.voiceId.trim(),
          speed: clamp(voice.speed, 0.5, 2, 1),
          vol: clamp(voice.volume, 0.1, 10, 1),
          pitch: clamp(voice.pitch, -12, 12, 0),
          ...(voice.emotion && voice.emotion !== "auto" ? { emotion: voice.emotion } : {}),
        },
        audio_setting: { sample_rate: 32000, bitrate: 128000, format: "mp3", channel: 1 },
      }),
    }, {
      signal,
      timeoutMs: timeoutMs || NETWORK_TIMEOUTS.MEDIA,
    });
    if (!response.ok) throw new Error(await readError(response));
    const data = await response.json();
    if (data?.base_resp?.status_code && data.base_resp.status_code !== 0) throw new Error(data.base_resp.status_msg || "MiniMax TTS failed");
    return hexToBlob(data?.data?.audio, "audio/mpeg");
  }

  throw new Error(`Unsupported TTS provider: ${provider}`);
}
