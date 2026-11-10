// 開啟唯讀檢視頁（viewer.html）。檢視頁不讀寫存檔，與小手機同網址也安全。
// 網頁版另開分頁，保留目前畫面；App（Capacitor）內改為同視窗前往，檢視頁有「返回小手機」。
export function getBackupViewerUrl() {
  return new URL("viewer.html", document.baseURI).href;
}

export function openBackupViewer() {
  const url = getBackupViewerUrl();
  if (window.Capacitor?.isNativePlatform?.()) {
    window.location.assign(url);
    return;
  }
  const opened = window.open(url, "_blank", "noopener");
  if (!opened) window.location.assign(url);
}
