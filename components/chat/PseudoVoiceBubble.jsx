import React, { useEffect, useRef, useState } from "react";
import { pseudoVoiceBubbleWidth, resolvePseudoVoiceDuration } from "../../utils/pseudoVoice";

export default function PseudoVoiceBubble({ pseudoVoice, compact = false, playback = null, tr = (value) => value }) {
  const [simulatedPlaying, setSimulatedPlaying] = useState(false);
  const [textActionOpen, setTextActionOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const timerRef = useRef(null);
  const duration = resolvePseudoVoiceDuration(pseudoVoice);
  const width = compact ? Math.min(180, pseudoVoiceBubbleWidth(duration)) : pseudoVoiceBubbleWidth(duration);
  const usesTts = typeof playback?.onToggle === "function";
  const status = usesTts ? playback.status : (simulatedPlaying ? "playing" : "idle");
  const playing = status === "playing";
  const loading = status === "loading";

  useEffect(() => () => clearTimeout(timerRef.current), []);
  if (!pseudoVoice?.transcript) return null;

  const togglePlayback = (event) => {
    event?.stopPropagation?.();
    if (usesTts) {
      playback.onToggle();
      return;
    }
    clearTimeout(timerRef.current);
    if (simulatedPlaying) {
      setSimulatedPlaying(false);
      return;
    }
    setSimulatedPlaying(true);
    timerRef.current = setTimeout(() => setSimulatedPlaying(false), duration * 1000);
  };

  return (
    <span style={{ width, maxWidth: "100%", display: "block" }}>
      <span style={{ minHeight: 38, padding: "5px 8px", display: "flex", alignItems: "center", gap: 7 }}>
        <button
          type="button"
          onClick={togglePlayback}
          aria-label={tr(`${playing ? "暫停" : "播放"}語音訊息，${duration} 秒`, `${playing ? "Pause" : "Play"} voice message, ${duration} seconds`, `${playing ? "一時停止" : "再生"}・音声メッセージ（${duration}秒）`, `${playing ? "일시정지" : "재생"} 음성 메시지, ${duration}초`)}
          title={usesTts ? tr("播放時才產生角色語音", "Character voice is generated when played", "再生時にキャラクターボイスを生成します", "재생할 때 캐릭터 음성을 생성합니다") : tr("播放語音訊息", "Play voice message", "音声メッセージを再生", "음성 메시지 재생")}
          style={{ width: 20, minWidth: 20, padding: 0, border: 0, background: "transparent", color: "inherit", fontSize: 15, cursor: "pointer" }}
        >
          {loading ? "…" : playing ? "Ⅱ" : "▶"}
        </button>
        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); setTextActionOpen((open) => !open); }}
          aria-label={tr("顯示語音文字選項", "Show voice transcript options", "音声テキストのオプションを表示", "음성 텍스트 옵션 표시")}
          title={tr("顯示文字", "Show transcript", "テキストを表示", "텍스트 보기")}
          style={{ flex: 1, minWidth: 0, height: 28, padding: 0, border: 0, background: "transparent", color: "inherit", display: "flex", alignItems: "center", gap: 2, overflow: "hidden", cursor: "pointer" }}
        >
          {Array.from({ length: compact ? 12 : 18 }, (_, index) => (
            <span key={index} style={{
              width: 2,
              flex: "0 0 2px",
              height: `${7 + ((index * 7 + duration) % 16)}px`,
              borderRadius: 2,
              background: "currentColor",
              opacity: playing ? .92 : .58,
              animation: playing ? `mpPseudoVoicePulse ${.42 + (index % 4) * .08}s ease-in-out infinite alternate` : "none",
            }} />
          ))}
        </button>
        <span style={{ fontSize: 10, opacity: .76, flex: "0 0 auto" }}>{duration}″</span>
      </span>
      {textActionOpen && (
        <span style={{ display: "flex", justifyContent: "flex-end", padding: "0 7px 5px" }}>
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); setTranscriptOpen((open) => !open); setTextActionOpen(false); }}
            style={{ border: "1px solid currentColor", borderRadius: 99, padding: "2px 8px", background: "rgba(255,255,255,.18)", color: "inherit", fontSize: 9, fontWeight: 700, cursor: "pointer" }}
          >
            {transcriptOpen ? tr("收起文字", "Hide transcript", "テキストを閉じる", "텍스트 접기") : tr("轉文字", "Transcript", "文字起こし", "텍스트로 보기")}
          </button>
        </span>
      )}
      {transcriptOpen && (
        <span className="mp-pseudo-voice-transcript">
          {pseudoVoice.transcript}
        </span>
      )}
      <style>{`@keyframes mpPseudoVoicePulse{from{transform:scaleY(.55)}to{transform:scaleY(1.08)}}`}</style>
    </span>
  );
}
