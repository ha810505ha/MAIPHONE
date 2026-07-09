import React from "react";
import { BarClock, LockClock } from "../common/PhoneClocks";
import { sanitizeUserImageUrl } from "../../utils/coreUtils";

export default function LockScreen({ unlocking, notifications, onOpenNotification, onUnlock, gestureHandlers, ft, fd, tr }) {
  return (
    <div className="mp-wrap">
      <div className="mp-phone">
        <div className={`mp-lock ${unlocking ? "out" : ""}`} {...gestureHandlers} onDoubleClick={onUnlock}>
          <BarClock ft={ft} hideTime />
          <LockClock ft={ft} fd={fd} />
          {notifications.length > 0 && (
            <div className="mp-lock-notifs">
              {notifications.map((notification) => {
                const avatar = sanitizeUserImageUrl(notification.char.avatar);
                return (
                  <button key={notification.charId} type="button" className="mp-lock-notif" onClick={(event) => { event.stopPropagation(); onOpenNotification(notification); }}>
                    <div className="mp-lock-notif-avatar">{avatar ? <img src={avatar} alt="" /> : (notification.char.name?.[0] || "🙂")}</div>
                    <div className="mp-lock-notif-body">
                      <div className="mp-lock-notif-name">{notification.char.name}</div>
                      <div className="mp-lock-notif-preview">{notification.preview}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          <div className="mp-lock-hint">{tr("向上滑動解鎖 MaliPhone（或雙擊）", "Swipe up to unlock MaliPhone (or double-click)", "MaliPhone を上にスワイプしてロック解除（またはダブルクリック）", "MaliPhone을 위로 밀어 잠금 해제(또는 더블클릭)")}</div>
        </div>
      </div>
    </div>
  );
}
