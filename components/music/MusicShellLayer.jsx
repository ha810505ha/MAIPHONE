import React from "react";
import { PlayerHost, useMusicPlayer } from "../../contexts/MusicPlayerContext";
import FloatingPlayer from "./FloatingPlayer";

// 掛在手機殼層（.mp-phone 內、AppRouter 之外）：
// PlayerHost 讓 iframe 永不卸載維持背景播放；懸浮球在音樂頁自動隱藏。
export default function MusicShellLayer({ currentApp }) {
  const mp = useMusicPlayer();
  return (
    <>
      <PlayerHost />
      {currentApp !== "music" && mp.track ? <FloatingPlayer /> : null}
    </>
  );
}
