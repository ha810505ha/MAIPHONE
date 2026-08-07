import React, { Suspense } from "react";
import { PlayerHost, useMusicPlayer } from "../../contexts/MusicPlayerContext";
import { loadFloatingPlayer } from "../../utils/featurePreload";
import { lazyWithRetry } from "../../utils/lazyWithRetry.js";

const FloatingPlayer = lazyWithRetry(loadFloatingPlayer);

// 掛在手機殼層（.mp-phone 內、AppRouter 之外）：
// PlayerHost 讓 iframe 永不卸載維持背景播放；懸浮球在音樂頁自動隱藏。
export default function MusicShellLayer({ currentApp }) {
  const mp = useMusicPlayer();
  return (
    <>
      <PlayerHost />
      {currentApp !== "music" && mp.track ? (
        <Suspense fallback={null}>
          <FloatingPlayer />
        </Suspense>
      ) : null}
    </>
  );
}
