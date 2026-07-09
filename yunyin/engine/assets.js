// 圖片快取。canvas 渲染迴圈不能 await，所以用「先拿引用、圖片背景載入、載好了自然畫得出來」的模式：
// 第一次 getImage(url) 當下圖片還沒載完會回傳 not-ready 的 Image，呼叫端該 fallback 就 fallback，
// 下一幀 isReady() 就會變 true，不需要額外的載入狀態管理。
const cache = new Map();

export function getImage(url) {
  if (!url) return null;
  let img = cache.get(url);
  if (!img) {
    img = new Image();
    img.src = url;
    cache.set(url, img);
  }
  return img;
}

export const isReady = (img) => !!img && img.complete && img.naturalWidth > 0;

// 預先丟進快取（進地圖前呼叫，減少「素材圖片這幀還沒到」的閃爍）
export function preload(urls) {
  for (const u of urls) getImage(u);
}
