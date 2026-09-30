// 揭曉演出的信封素材：由「關著／打開」兩張信封插畫拆成的圖層，共用同一個畫布座標。
import liningUrl from "./assets/envelope/envelope-lining.webp";
import pocketUrl from "./assets/envelope/envelope-pocket.webp";
import flapOuterUrl from "./assets/envelope/envelope-flap-outer.webp";
import flapInnerUrl from "./assets/envelope/envelope-flap-inner.webp";
import sealRUrl from "./assets/envelope/seal-r.webp";
import sealSrUrl from "./assets/envelope/seal-sr.webp";
import sealSsrUrl from "./assets/envelope/seal-ssr.webp";

export const ENVELOPE_IMAGES = Object.freeze({
  lining: liningUrl,
  pocket: pocketUrl,
  flapOuter: flapOuterUrl,
  flapInner: flapInnerUrl,
});

export const SEAL_IMAGES = Object.freeze({ R: sealRUrl, SR: sealSrUrl, SSR: sealSsrUrl });

let preloaded = false;

// 召喚前先暖好圖片快取，避免揭曉第一幀信封還沒載入。
export function preloadEnvelopeImages() {
  if (preloaded || typeof Image === "undefined") return;
  preloaded = true;
  [...Object.values(ENVELOPE_IMAGES), ...Object.values(SEAL_IMAGES)].forEach((src) => {
    const image = new Image();
    image.decoding = "async";
    image.src = src;
  });
}
