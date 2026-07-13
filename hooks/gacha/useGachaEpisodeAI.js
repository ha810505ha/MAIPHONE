import { useCallback, useState } from "react";
import { generateGachaEpisodeOpening, generateGachaEpisodeReply } from "../../services/gacha/gachaEpisodeService";

export default function useGachaEpisodeAI({ episode, character, playerProfile, apiConfig, recentMessages = [], sendUserMessage, appendAssistantMessage, setEpisodeOpening }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const prepareOpening = useCallback(async () => {
    if (episode.openingStatus !== "pending" || isGenerating) return false;
    setError(""); setIsGenerating(true);
    try {
      const opening = await generateGachaEpisodeOpening({ episode, character, playerProfile, apiConfig, recentMessages });
      setEpisodeOpening?.(episode.id, opening);
      return true;
    } catch (reason) {
      setError(reason?.message || "開場生成失敗，請稍後重試");
      return false;
    } finally { setIsGenerating(false); }
  }, [apiConfig, character, episode, isGenerating, playerProfile, recentMessages, setEpisodeOpening]);
  const send = useCallback(async (content) => {
    const text = String(content || "").trim();
    if (!text || isGenerating || episode.playerMessageCount >= 20) return false;
    setError("");
    setStreamingText("");
    sendUserMessage(episode.id, text);
    setIsGenerating(true);
    try {
      const reply = await generateGachaEpisodeReply({ episode, character, playerProfile, apiConfig, nextUserMessage: text, onChunk: setStreamingText });
      appendAssistantMessage(episode.id, reply);
      setStreamingText("");
      return true;
    } catch (reason) {
      setError(reason?.message || "角色回覆生成失敗，請稍後重試");
      return false;
    } finally {
      setIsGenerating(false);
    }
  }, [apiConfig, appendAssistantMessage, character, episode, isGenerating, playerProfile, sendUserMessage]);
  const finishEarly = useCallback(async () => {
    if (isGenerating || episode.status !== "active") return false;
    setError(""); setStreamingText(""); setIsGenerating(true);
    try {
      const reply = await generateGachaEpisodeReply({ episode, character, playerProfile, apiConfig, nextUserMessage: "", onChunk: setStreamingText, forceEnding: true });
      appendAssistantMessage(episode.id, reply);
      setStreamingText("");
      return true;
    } catch (reason) {
      setError(reason?.message || "收尾回覆生成失敗，請稍後重試");
      return false;
    } finally { setIsGenerating(false); }
  }, [apiConfig, appendAssistantMessage, character, episode, isGenerating, playerProfile]);
  return { send, finishEarly, prepareOpening, isGenerating, streamingText, error, clearError: () => setError("") };
}
