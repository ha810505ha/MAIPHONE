/**
 * 系統通知（瀏覽器／作業系統層）。
 *
 * 與殼內橫幅的差別只有「送到哪裡」：來源、抑制規則、點擊目的地全部沿用同一套，
 * 這裡不自己判斷該不該跳，只負責把已經決定要跳的通知送出去。
 *
 * 走 ServiceWorkerRegistration.showNotification 而非 new Notification：
 * Android Chrome 只支援前者，而且只有它的點擊事件能在頁面已關閉時把 App 叫回前景。
 */

const NOTIFICATION_TAG_PREFIX = "maliphone:";

export function isSystemNotificationSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getSystemNotificationPermission() {
  if (!isSystemNotificationSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestSystemNotificationPermission() {
  if (!isSystemNotificationSupported()) return "unsupported";
  // 已被封鎖時再問也不會跳窗，直接回報現況讓 UI 引導玩家去瀏覽器設定改。
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

async function getRegistration() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.getRegistration();
  } catch {
    return null;
  }
}

/**
 * 送出一則系統通知。data 會原封不動回到 notificationclick，
 * 由 sw.js 轉發給頁面走既有的 openNotification 流程。
 */
export async function showSystemNotification(item) {
  if (!isSystemNotificationSupported() || Notification.permission !== "granted") return false;
  const title = item.summaryCount
    ? `${item.names || item.title}`
    : (item.title || "MaliPhone");
  const body = item.summaryCount
    ? `${item.summaryCount} 則新通知`
    : (item.body || "");
  const options = {
    body,
    // 同一則通知（例如同一個角色連續傳訊）用同 tag 覆蓋，不堆滿通知中心。
    tag: `${NOTIFICATION_TAG_PREFIX}${item.id}`,
    renotify: true,
    silent: false,
    data: {
      id: item.id,
      type: item.type,
      appId: item.appId,
      payload: item.payload || null,
    },
  };
  // 頭像是 data URI 或站內路徑都能直接用；沒有就讓瀏覽器套 PWA 圖示。
  if (item.avatar) options.icon = item.avatar;

  const registration = await getRegistration();
  try {
    if (registration?.showNotification) {
      await registration.showNotification(title, options);
      return true;
    }
    // 桌面且沒有 SW 時的退路；行動裝置上這條會直接丟例外，交給 catch。
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}

export async function presentSystemNotifications(list) {
  for (const item of list) {
    // eslint-disable-next-line no-await-in-loop -- 逐則送出，避免同時間大量通知擠掉彼此
    await showSystemNotification(item);
  }
}

/**
 * 訂閱 sw.js 轉發的通知點擊。回傳解除訂閱函式。
 */
export function subscribeSystemNotificationClicks(handler) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return () => {};
  const onMessage = (event) => {
    if (event.data?.type !== "NOTIFICATION_CLICK") return;
    handler(event.data.notification);
  };
  navigator.serviceWorker.addEventListener("message", onMessage);
  return () => navigator.serviceWorker.removeEventListener("message", onMessage);
}
