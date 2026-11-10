export const PSEUDO_VOICE_TEXT_LIMIT = 300;

export const VOICE_MESSAGE_RULE_CONTEXT = `[線上語音訊息]
你可以依照角色性格與當下情境，偶爾改用一則語音訊息。只有線上聊天可以使用，且每次回覆最多一則。
需要傳語音時，請輸出：[[VOICE_MESSAGE]]語音的逐字內容[[/VOICE_MESSAGE]]
標記中的內容必須是角色實際會說出口的話，限 1～300 字；可和一般文字訊息一起傳送。
VOICE_MESSAGE 的拼字與開關標記必須完全一致；若不使用語音，就只輸出一般訊息，不要輸出相似或殘缺的標記。
不要解釋標記、不要假裝已產生音檔，也不要每次回覆都使用語音。`;

// 部分模型偶爾會把 VOICE 拼成 COICE。這個容錯只接受已知的語音標記近似值，
// 避免把角色台詞裡其他 [[...]] 內容誤判為語音。
const PSEUDO_VOICE_BLOCK_RE = /\[\[\s*(?:VOICE|COICE)[\s_-]*MESSAGE\s*\]\]([\s\S]*?)\[\[\s*\/\s*(?:VOICE|COICE)[\s_-]*MESSAGE\s*\]\]/gi;
const PSEUDO_VOICE_ORPHAN_TAG_RE = /\[\[\s*\/?\s*(?:VOICE|COICE)[\s_-]*MESSAGE\s*\]\]/gi;

export function estimatePseudoVoiceDuration(text) {
  const value = String(text || "").trim();
  if (!value) return 0;
  const hanCount = (value.match(/[\u3400-\u9fff]/g) || []).length;
  const words = value.replace(/[\u3400-\u9fff]/g, " ").match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || [];
  const spokenWordUnits = words.reduce((total, word) => total + Math.max(1, word.length / 5), 0);
  const otherCount = value.replace(/[\s\u3400-\u9fffA-Za-z0-9'’\-]/g, "").length;
  const shortPauses = (value.match(/[，,、；;：:]/g) || []).length * 0.16;
  const longPauses = (value.match(/[。！？!?…]/g) || []).length * 0.34;
  const seconds = hanCount / 3.6 + spokenWordUnits / 2.5 + otherCount / 5 + shortPauses + longPauses;
  return Math.max(2, Math.min(60, Math.ceil(seconds)));
}

export function resolvePseudoVoiceDuration(pseudoVoice) {
  const estimated = estimatePseudoVoiceDuration(pseudoVoice?.transcript);
  if (estimated) return estimated;
  return Math.max(2, Math.min(60, Number(pseudoVoice?.duration) || 2));
}

export function createPseudoVoice(transcript) {
  const text = String(transcript || "").trim().slice(0, PSEUDO_VOICE_TEXT_LIMIT);
  if (!text) return null;
  return { transcript: text, duration: estimatePseudoVoiceDuration(text) };
}

export function extractPseudoVoiceDirectives(input) {
  const voices = [];
  const text = String(input || "").replace(
    PSEUDO_VOICE_BLOCK_RE,
    (_, transcript) => {
      const voice = createPseudoVoice(transcript);
      if (voice && voices.length < 1) voices.push(voice);
      return "";
    }
  );
  return {
    text: text
      // 配對失敗時至少不要把內部控制標記直接顯示給玩家；內容仍保留為一般訊息。
      .replace(PSEUDO_VOICE_ORPHAN_TAG_RE, " ")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim(),
    voices,
  };
}

export function normalizePersistedPseudoVoiceMessages(messages) {
  if (!Array.isArray(messages)) return [];
  let changed = false;
  const normalized = [];

  messages.forEach((message) => {
    if (message?.pseudoVoice?.transcript) {
      const duration = resolvePseudoVoiceDuration(message.pseudoVoice);
      if (duration !== Number(message.pseudoVoice.duration)) {
        changed = true;
        normalized.push({ ...message, pseudoVoice: { ...message.pseudoVoice, duration } });
      } else {
        normalized.push(message);
      }
      return;
    }
    if (message?.role !== "assistant" || message.pseudoVoice || typeof message.content !== "string") {
      normalized.push(message);
      return;
    }
    const extracted = extractPseudoVoiceDirectives(message.content);
    if (!extracted.voices.length && extracted.text === message.content) {
      normalized.push(message);
      return;
    }

    changed = true;
    if (extracted.text) normalized.push({ ...message, content: extracted.text });
    extracted.voices.forEach((pseudoVoice, index) => {
      normalized.push({
        ...message,
        id: extracted.text || index > 0
          ? `${message.id || "message"}_recovered_voice_${index + 1}`
          : message.id,
        content: pseudoVoice.transcript,
        pseudoVoice,
        mode: "online",
      });
    });
  });

  return changed ? normalized : messages;
}

export function pseudoVoicePromptLine(pseudoVoice, senderLabel) {
  if (!pseudoVoice?.transcript) return "";
  return `\n[語音訊息] ${senderLabel}傳了一段約 ${resolvePseudoVoiceDuration(pseudoVoice)} 秒的語音，語音內容是：「${pseudoVoice.transcript}」`;
}

export function pseudoVoiceBubbleWidth(duration) {
  const seconds = Math.max(2, Math.min(60, Number(duration) || 2));
  return Math.round(Math.min(250, 88 + Math.sqrt(seconds) * 22));
}
