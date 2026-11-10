import { createElement, useRef } from "react";
import useVoicePlayback from "../audio/useVoicePlayback";
import { CharacterVoiceAction } from "../../components/chat/ChatMessageParts";
import { fetchElevenLabsDefaultVoices, synthesizeSpeech } from "../../services/ttsService";
import { getMessageMode, stripInternalBlocks, stripModeLabel } from "../../utils/chatMessageUtils";

/**
 * Owns chat-specific voice behavior on top of the reusable TTS playback hook.
 * It keeps speech extraction, generated timestamps, and message-level actions
 * out of the phone shell while leaving Settings with the same public callbacks.
 */
export default function useChatVoiceController({
  ttsConfig,
  setTtsConfig,
  chatHistory,
  setChatHistory,
  showToast,
  sanitizeText,
  tr,
}) {
  const ttsGenerationTargetRef = useRef(null);

  const extractRealitySpeech = (text) => {
    const parts = [];
    const source = String(text || "");
    const pattern = /「([^」]+)」|“([^”]+)”|"([^"]+)"/g;
    let match;
    while ((match = pattern.exec(source))) parts.push(match[1] || match[2] || match[3]);
    return parts.join(" ").trim();
  };

  const getReplySpeechText = (characterId, message) => {
    const history = chatHistory[characterId] || [];
    const group = message.replyGroupId
      ? history.filter((item) => item.role === "assistant" && item.replyGroupId === message.replyGroupId)
      : [message];
    const combined = group
      .map((item) => stripModeLabel(stripInternalBlocks(item.content || "")))
      .filter(Boolean)
      .join("\n");
    const speech = getMessageMode(message) === "reality"
      ? extractRealitySpeech(combined)
      : combined;
    return speech.replace(/\*\*|__|[*_`#]/g, "").trim();
  };

  const markMessageVoiceGenerated = (character, message) => {
    const generatedAt = Date.now();
    setChatHistory((history) => ({
      ...history,
      [character.id]: (history[character.id] || []).map((item) => {
        const belongsToReply = message.replyGroupId
          ? item.role === "assistant" && item.replyGroupId === message.replyGroupId
          : item.id === message.id;
        return belongsToReply ? { ...item, ttsGeneratedAt: generatedAt } : item;
      }),
    }));
  };

  const playback = useVoicePlayback({
    config: ttsConfig,
    setConfig: setTtsConfig,
    fetchVoices: fetchElevenLabsDefaultVoices,
    synthesizeSpeech: async (options) => {
      const blob = await synthesizeSpeech(options);
      const target = ttsGenerationTargetRef.current;
      if (target) markMessageVoiceGenerated(target.character, target.message);
      return blob;
    },
    getSpeechText: getReplySpeechText,
    showToast,
    sanitizeText,
    tr,
  });

  const renderCharacterVoiceAction = (character, message, isActive, collapseWhenHidden = false) => {
    if (!ttsConfig.enabled || !character?.voiceSettings?.enabled) return null;
    const key = `${ttsConfig.provider || "elevenlabs"}:${character.id}:${message.replyGroupId || message.id}`;
    const status = playback.playback.key === key ? playback.playback.status : "idle";
    return createElement(CharacterVoiceAction, {
        visible: isActive || status !== "idle",
        collapseWhenHidden,
        status,
        onToggle: () => {
          ttsGenerationTargetRef.current = { character, message };
          void playback.toggleCharacterVoice(character, message)
            .finally(() => { ttsGenerationTargetRef.current = null; });
        },
        tr,
      });
  };

  const getCharacterVoiceBubblePlayback = (character, message) => {
    const key = `${ttsConfig.provider || "elevenlabs"}:${character.id}:${message.id}`;
    return {
      status: playback.playback.key === key ? playback.playback.status : "idle",
      onToggle: () => {
        if (!ttsConfig.enabled) {
          showToast("請先在設定中啟用語音功能");
          return;
        }
        if (!character?.voiceSettings?.enabled) {
          showToast("請先為此角色啟用語音");
          return;
        }
        ttsGenerationTargetRef.current = { character, message };
        void playback.toggleCharacterVoice(character, message)
          .finally(() => { ttsGenerationTargetRef.current = null; });
      },
    };
  };

  return {
    ...playback,
    renderCharacterVoiceAction,
    getCharacterVoiceBubblePlayback,
  };
}
