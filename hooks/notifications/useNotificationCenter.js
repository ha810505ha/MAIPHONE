import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BANNER_DURATION, DEFAULT_NOTIFICATION_SETTINGS } from "../../constants/notifications";
import useTransientItem from "../useTransientItem";
import {
  buildBadgeCounts,
  buildBannerPayload,
  canInterrupt,
  collectNotifications,
  normalizeNotificationSettings,
  selectLockNotifications,
} from "../../services/notifications/notificationSources";

/**
 * 全 App 共用的通知中心。
 *
 * 持久層是各功能自己的未讀狀態，通知清單即時衍生；橫幅只是瞬時 UI 狀態，不進存檔。
 * 唯一需要保存的是 lastNotifiedAt，用來確保橫幅只對「新事件」跳一次。
 */
export default function useNotificationCenter({ characters, chatHistory, proactiveUnread, datingState, datingProfiles, posts, mailboxMails, locked, currentApp }) {
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
    () => collectNotifications({ characters, chatHistory, proactiveUnread, datingState, datingProfiles, posts, socialSeenAt, mailboxMails }),
    [characters, chatHistory, proactiveUnread, datingState, datingProfiles, posts, socialSeenAt, mailboxMails],
  );

  useEffect(() => {
    // 第一次計算只用來建立基準線，避免重整後把既有未讀重跳一輪。
    const hadBaseline = baselineRef.current;
    baselineRef.current = true;
    const fresh = notifications.filter((item) => item.time > lastNotifiedRef.current);
    if (!fresh.length) return;
    // 不論最後有沒有顯示，時間戳都往前推進：抑制的語意是「現在別打斷我」，
    // 不是「等一下再補跳」。錯過的部分由紅點與鎖定畫面承接。
    lastNotifiedRef.current = fresh[0].time;
    setLastNotifiedAt(fresh[0].time);
    if (!hadBaseline) return;
    if (!canInterrupt({ settings, locked, currentApp })) return;
    // 人已經在該 App 裡面時，不跳自己的通知。
    const interrupting = fresh.filter((item) => item.appId !== currentApp);
    if (interrupting.length) showBanner(buildBannerPayload(interrupting));
  }, [notifications, settings, locked, currentApp, showBanner]);

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
    markSocialRead: useCallback(() => setSocialSeenAt(Date.now()), []),
  };
}
