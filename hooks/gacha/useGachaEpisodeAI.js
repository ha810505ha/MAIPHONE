import { useCallback, useEffect, useRef, useState } from "react";
import { generateGachaEpisodeOpening, generateGachaEpisodeReply } from "../../services/gacha/gachaEpisodeService";
import { isRequestCancelled } from "../../utils/networkRequest.js";

export default function useGachaEpisodeAI({ episode, character, playerProfile, apiConfig, recentMessages = [], sendUserMessage, appendAssistantMessage, setEpisodeOpening, commitEpisodeTurn, tr = (zh) => zh }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const requestRef = useRef(null);
  const beginRequest = useCallback(() => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    return controller;
  }, []);
  useEffect(() => {
    requestRef.current?.abort();
    return () => requestRef.current?.abort();
  }, [episode.id]);

  const prepareOpening = useCallback(async () => {
    if (episode.openingStatus !== "pending" || isGenerating) return false;
    setError(""); setIsGenerating(true);
    const controller = beginRequest();
    try {
      const opening = await generateGachaEpisodeOpening({ episode, character, playerProfile, apiConfig, recentMessages, signal: controller.signal });
      if (controller.signal.aborted) return false;
      setEpisodeOpening?.(episode.id, opening);
      return true;
    } catch (reason) {
      if (isRequestCancelled(reason)) return false;
      setError(reason?.message || "開場生成失敗，請稍後重試");
      return false;
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setIsGenerating(false);
      }
    }
  }, [apiConfig, beginRequest, character, episode, isGenerating, playerProfile, recentMessages, setEpisodeOpening]);
  const send = useCallback(async (content) => {
    const text = String(content || "").trim();
    if (!text || isGenerating || episode.playerMessageCount >= 20) return false;
    setError("");
    setStreamingText("");
    sendUserMessage(episode.id, text);
    setIsGenerating(true);
    const controller = beginRequest();
    try {
      const reply = await generateGachaEpisodeReply({ episode, character, playerProfile, apiConfig, nextUserMessage: text, onChunk: setStreamingText, signal: controller.signal });
      if (controller.signal.aborted) return false;
      appendAssistantMessage(episode.id, reply);
      setStreamingText("");
      return true;
    } catch (reason) {
      if (isRequestCancelled(reason)) return false;
      setError(reason?.message || "角色回覆生成失敗，請稍後重試");
      return false;
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setIsGenerating(false);
      }
    }
  }, [apiConfig, appendAssistantMessage, beginRequest, character, episode, isGenerating, playerProfile, sendUserMessage]);
  const generatePending = useCallback(async () => {
    const hasPending = (episode.messages || []).some((message) => message.role === "user" && message.batchPending === true);
    if (!hasPending || isGenerating || episode.playerMessageCount >= 20) return false;
    setError("");
    setStreamingText("");
    setIsGenerating(true);
    const controller = beginRequest();
    try {
      const reply = await generateGachaEpisodeReply({ episode, character, playerProfile, apiConfig, nextUserMessage: "", onChunk: setStreamingText, signal: controller.signal });
      if (controller.signal.aborted) return false;
      appendAssistantMessage(episode.id, reply);
      commitEpisodeTurn?.(episode.id);
      setStreamingText("");
      return true;
    } catch (reason) {
      if (isRequestCancelled(reason)) return false;
      setError(reason?.message || tr("角色回覆生成失敗，請再試一次", "Failed to generate the reply. Please try again.", "返信の生成に失敗しました。もう一度お試しください。", "답장 생성에 실패했습니다. 다시 시도해 주세요."));
      return false;
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setIsGenerating(false);
      }
    }
  }, [apiConfig, appendAssistantMessage, beginRequest, character, commitEpisodeTurn, episode, isGenerating, playerProfile, tr]);
  const finishEarly = useCallback(async () => {
    if (isGenerating || episode.status !== "active") return false;
    setError(""); setStreamingText(""); setIsGenerating(true);
    const controller = beginRequest();
    try {
      const reply = await generateGachaEpisodeReply({ episode, character, playerProfile, apiConfig, nextUserMessage: "", onChunk: setStreamingText, forceEnding: true, signal: controller.signal });
      if (controller.signal.aborted) return false;
      appendAssistantMessage(episode.id, reply);
      setStreamingText("");
      return true;
    } catch (reason) {
      if (isRequestCancelled(reason)) return false;
      setError(reason?.message || "收尾回覆生成失敗，請稍後重試");
      return false;
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setIsGenerating(false);
      }
    }
  }, [apiConfig, appendAssistantMessage, beginRequest, character, episode, isGenerating, playerProfile]);
  return { send, generatePending, finishEarly, prepareOpening, isGenerating, streamingText, error, clearError: () => setError("") };
}
