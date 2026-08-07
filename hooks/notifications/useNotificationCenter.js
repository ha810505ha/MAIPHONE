import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BANNER_DURATION, DEFAULT_NOTIFICATION_SETTINGS, NOTIFICATION_TYPES } from "../../constants/notifications";
import useTransientItem from "../useTransientItem";
import {
  buildBadgeCounts,
  buildBannerPayload,
  canInterrupt,
  canNotifySystem,
  collectNotifications,
  collectSocialActivities,
  filterAllowedTypes,
  normalizeNotificationSettings,
  selectLockNotifications,
} from "../../services/notifications/notificationSources";
import {
  getSystemNotificationPermission,
  presentSystemNotifications,
  requestSystemNotificationPermission,
} from "../../services/notifications/systemNotifications";

/**
 * 全 App 共用的通知中心。
 *
 * 持久層是各功能自己的未讀狀態，通知清單即時衍生；橫幅只是瞬時 UI 狀態，不進存檔。
 * 唯一需要保存的是 lastNotifiedAt，用來確保橫幅只對「新事件」跳一次。
 */
export default function useNotificationCenter({ characters, chatHistory, proactiveUnread, datingState, datingProfiles, posts, socialNow, mailboxMails, locked, currentApp }) {
  const [settings, setSettings] = useState(DEFAULT_NOTIFICATION_SETTINGS);
  const [lastNotifiedAt, setLastNotifiedAt] = useState(0);
  const [socialSeenAt, setSocialSeenAt] = useState(0);
  const { item: bannerItem, show: showBanner, dismiss: dismissBanner } = useTransientItem({
    holdMs: BANNER_DURATION,
    exitMs: 160,
  });
  const lastNotifiedRef = useRef(0);
  const baselineRef = useRef(false);

  const notifications = useMemo(
    () => collectNotifications({ characters, chatHistory, proactiveUnread, datingState, datingProfiles, posts, socialSeenAt, socialNow, mailboxMails }),
    [characters, chatHistory, proactiveUnread, datingState, datingProfiles, posts, socialSeenAt, socialNow, mailboxMails],
  );
  const socialActivities = useMemo(
    () => collectSocialActivities({ characters, posts, socialSeenAt, socialNow }),
    [characters, posts, socialSeenAt, socialNow],
  );

  useEffect(() => {
    // 第一次計算只用來建立基準線，避免重整後把既有未讀重跳一輪。
    const hadBaseline = baselineRef.current;
    baselineRef.current = true;
    const fresh = notifications.filter((item) => (
      item.type !== NOTIFICATION_TYPES.SOCIAL
      && item.time > lastNotifiedRef.current
    ));
    if (!fresh.length) return;
    // 不論最後有沒有顯示，時間戳都往前推進：抑制的語意是「現在別打斷我」，
    // 不是「等一下再補跳」。錯過的部分由紅點與鎖定畫面承接。
    lastNotifiedRef.current = fresh[0].time;
    setLastNotifiedAt(fresh[0].time);
    if (!hadBaseline) return;

    // 頁面不在前景時走系統通知，在前景時走殼內橫幅：同一則事件只會用一種方式提醒。
    const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
    if (hidden) {
      if (!canNotifySystem({ settings })) return;
      const allowed = filterAllowedTypes(fresh, settings);
      if (allowed.length) presentSystemNotifications([buildBannerPayload(allowed)]);
      return;
    }

    if (!canInterrupt({ settings, locked, currentApp })) return;
    // 人已經在該 App 裡面時，不跳自己的通知。
    const interrupting = fresh.filter((item) => item.appId !== currentApp);
    if (interrupting.length) showBanner(buildBannerPayload(interrupting));
  }, [notifications, settings, locked, currentApp, showBanner]);

  const [systemPermission, setSystemPermission] = useState(() => getSystemNotificationPermission());
  const requestSystemPermission = useCallback(async () => {
    const result = await requestSystemNotificationPermission();
    setSystemPermission(result);
    return result;
  }, []);

  const hydrate = useCallback((data) => {
    setSettings(normalizeNotificationSettings(data?.notificationSettings));
    const saved = Number(data?.notificationState?.lastNotifiedAt) || 0;
    const savedSocialSeenAt = Number(data?.notificationState?.socialSeenAt);
    lastNotifiedRef.current = saved;
    setLastNotifiedAt(saved);
    setSocialSeenAt(Number.isFinite(savedSocialSeenAt) ? savedSocialSeenAt : Date.now());
  }, []);

  const updateSettings = useCallback(
    (patch) => setSettings((current) => normalizeNotificationSettings({ ...current, ...patch })),
    [],
  );

  return {
    settings,
    updateSettings,
    hydrate,
    systemPermission,
    requestSystemPermission,
    persisted: { notificationSettings: settings, notificationState: { lastNotifiedAt, socialSeenAt } },
    banner: bannerItem
      ? {
        ...bannerItem.value,
        transitionPhase: bannerItem.phase,
        transitionSequence: bannerItem.sequence,
      }
      : null,
    dismissBanner,
    lockNotifications: useMemo(() => selectLockNotifications(notifications, settings), [notifications, settings]),
    badges: useMemo(() => buildBadgeCounts(notifications, settings), [notifications, settings]),
    socialActivities,
    socialUnreadCount: socialActivities.filter((item) => item.isUnread).length,
    markSocialReadThrough: useCallback((time) => {
      const nextSeenAt = Number(time) || Date.now();
      setSocialSeenAt((current) => Math.max(current, nextSeenAt));
    }, []),
  };
}
