import React from "react";
import { BarClock, LockClock } from "../common/PhoneClocks";
import NotificationCard from "./NotificationCard";
import { getPrivacyUrl, getTermsUrl } from "../../utils/privacyUrl.js";

// 通知區可捲動，但解鎖也是上滑手勢，所以要攔掉冒泡，免得滑列表就把手機解鎖了。
const stopGesture = (event) => event.stopPropagation();
const gestureGuards = {
  onTouchStart: stopGesture, onTouchEnd: stopGesture,
  onMouseDown: stopGesture, onMouseUp: stopGesture,
  onPointerDown: stopGesture, onPointerUp: stopGesture,
};
const linkGuards = { ...gestureGuards, onClick: stopGesture, onDoubleClick: stopGesture };

export default function LockScreen({ unlocking, notifications, onOpenNotification, onUnlock, gestureHandlers, ft, fd, tr, effects = null }) {
  return (
    <div className="mp-wrap">
      <div className="mp-phone" data-runtime-phone="true">
        <div className={`mp-lock ${unlocking ? "out" : ""}`} {...gestureHandlers} onDoubleClick={onUnlock}>
          {effects}
          <BarClock ft={ft} hideTime />
          <LockClock ft={ft} fd={fd} />
          <div className="mp-lock-notifs" {...gestureGuards}>
            {notifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                className="mp-lock-notif"
                tr={tr}
                onClick={(event) => { event.stopPropagation(); onOpenNotification(notification); }}
              />
            ))}
          </div>
          <div {...linkGuards} style={{ position: "absolute", bottom: 26, zIndex: 3, display: "flex", alignItems: "center", gap: 2, fontSize: 11, color: "var(--mp-lock-hint,var(--mp-txt))", opacity: 0.6 }}>
            <a href={getTermsUrl()} target="_blank" rel="noopener noreferrer" {...linkGuards} style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 2, padding: "6px 8px" }}>
              {tr("服務條款", "Terms of Service", "利用規約", "이용약관")}
            </a>
            <span aria-hidden="true">·</span>
            <a href={getPrivacyUrl()} target="_blank" rel="noopener noreferrer" {...linkGuards} style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 2, padding: "6px 8px" }}>
              {tr("隱私權政策", "Privacy Policy", "プライバシーポリシー", "개인정보 처리방침")}
            </a>
          </div>
          <div className="mp-lock-hint">{tr("向上滑動解鎖 MaliPhone（或雙擊）", "Swipe up to unlock MaliPhone (or double-click)", "MaliPhone を上にスワイプしてロック解除（またはダブルクリック）", "MaliPhone을 위로 밀어 잠금 해제(또는 더블클릭)")}</div>
        </div>
      </div>
    </div>
  );
}
