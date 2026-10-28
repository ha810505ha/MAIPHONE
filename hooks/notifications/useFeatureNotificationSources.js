import { useEffect, useRef, useState } from "react";
import { loadFeatureEntity } from "../../utils/indexedDbStorage";
import { FEATURE_DATA_CHANGED_EVENT, featureDataEventIncludes } from "../../services/featureDataLifecycle";
import { IMMERSIVE_APPS, YUNYIN_SAVE_UPDATED_EVENT } from "../../constants/notifications";
import { nextFeatureNotificationDueAt } from "../../services/notifications/notificationSources";

const TICK_MIN_MS = 1000;
const TICK_MAX_MS = 60 * 60 * 1000;

/**
 * 山莊存檔與登入獎勵進度不在 MaliPhone 的 React state 裡（各自直接讀寫 IndexedDB），
 * 通知要衍生就得自己拿一份。這裡只負責「拿到最新的一份」與「時間到了就重算」：
 * - 開機讀一次；匯入／還原／換人格走 FEATURE_DATA_CHANGED_EVENT 重讀。
 * - 山莊每次存檔會廣播整份存檔；人在山莊裡時只先收著，離開山莊才套用，
 *   免得每點一下田就讓根元件重畫（山莊裡本來就不跳橫幅）。
 * - featureNow 是通知用的時鐘：只在下一件事到期時才跳一次，不是固定每分鐘。
 */
export default function useFeatureNotificationSources({ currentApp }) {
  const [sources, setSources] = useState({ yunyinSave: null, loginReward: null, loaded: false });
  const [featureNow, setFeatureNow] = useState(() => Date.now());
  const pendingYunyinRef = useRef(null);
  const inVillaRef = useRef(false);
  inVillaRef.current = IMMERSIVE_APPS.includes(currentApp);

  useEffect(() => {
    let active = true;
    const loadAll = () => Promise.all([
      loadFeatureEntity("ent_yunyinSave", null).catch(() => null),
      loadFeatureEntity("ent_loginReward", null).catch(() => null),
    ]).then(([yunyinSave, loginReward]) => {
      if (!active) return;
      pendingYunyinRef.current = null;
      setSources({ yunyinSave, loginReward, loaded: true });
    });
    loadAll();
    const onFeatureDataChanged = (event) => {
      if (featureDataEventIncludes(event, ["ent_yunyinSave", "ent_loginReward"])) loadAll();
    };
    const onYunyinSaved = (event) => {
      const save = event?.detail;
      if (!save || typeof save !== "object") return;
      if (inVillaRef.current) {
        pendingYunyinRef.current = save;
        return;
      }
      setSources((current) => ({ ...current, yunyinSave: save }));
    };
    window.addEventListener(FEATURE_DATA_CHANGED_EVENT, onFeatureDataChanged);
    window.addEventListener(YUNYIN_SAVE_UPDATED_EVENT, onYunyinSaved);
    return () => {
      active = false;
      window.removeEventListener(FEATURE_DATA_CHANGED_EVENT, onFeatureDataChanged);
      window.removeEventListener(YUNYIN_SAVE_UPDATED_EVENT, onYunyinSaved);
    };
  }, []);

  // 離開山莊：把遊玩期間收著的最新存檔套上，並重算時鐘。
  useEffect(() => {
    if (IMMERSIVE_APPS.includes(currentApp)) return;
    const pending = pendingYunyinRef.current;
    if (!pending) return;
    pendingYunyinRef.current = null;
    setSources((current) => ({ ...current, yunyinSave: pending }));
    setFeatureNow(Date.now());
  }, [currentApp]);

  // 下一件事到期（田熟、丹好、換日）時跳一次時鐘；最長一小時重排一次，不會漏掉。
  useEffect(() => {
    if (!sources.loaded) return undefined;
    const dueAt = nextFeatureNotificationDueAt(sources, featureNow);
    if (!dueAt) return undefined;
    const delay = Math.min(TICK_MAX_MS, Math.max(TICK_MIN_MS, dueAt - Date.now()));
    const timer = setTimeout(() => setFeatureNow(Date.now()), delay);
    return () => clearTimeout(timer);
  }, [sources, featureNow]);

  return { ...sources, featureNow };
}
