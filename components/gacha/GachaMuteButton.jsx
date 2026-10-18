import React, { useSyncExternalStore } from "react";
import { isGachaAudioMuted, setGachaAudioMuted, subscribeGachaAudioMuted } from "../../services/gacha/gachaAudio";

// MP-072：抽卡畫面的靜音鈕（線條喇叭圖示）。tone="light" 用在深色的召喚演出上。
export default function GachaMuteButton({ tr, tone = "auto", className = "" }) {
  const muted = useSyncExternalStore(subscribeGachaAudioMuted, isGachaAudioMuted, isGachaAudioMuted);
  const label = muted ? tr("開啟聲音", "Turn sound on", "サウンドをオン", "소리 켜기") : tr("靜音", "Mute", "ミュート", "음소거");
  return <button
    type="button"
    className={`sg-mute ${tone === "light" ? "light" : ""} ${className}`}
    aria-label={label}
    aria-pressed={muted}
    title={label}
    onClick={(event) => { event.stopPropagation(); setGachaAudioMuted(!muted); }}
  >
    <style>{`.sg-mute{display:inline-grid;place-items:center;width:44px;height:44px;padding:0;border:0;border-radius:50%;background:transparent;color:var(--mp-txt);cursor:pointer;-webkit-tap-highlight-color:transparent}.sg-mute svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}.sg-mute:active{transform:scale(.92)}.sg-mute:focus-visible{outline:2px solid var(--mp-pink-dk);outline-offset:1px}.sg-mute.light{color:#fff;filter:drop-shadow(0 1px 3px rgba(0,0,0,.45))}`}</style>
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" />
      {muted
        ? <path d="M16 9.5l5 5M21 9.5l-5 5" />
        : <><path d="M15.5 9.2a4 4 0 0 1 0 5.6" /><path d="M18.2 6.6a7.6 7.6 0 0 1 0 10.8" /></>}
    </svg>
  </button>;
}
