import React from "react";
import { BarClock, LockClock } from "../common/PhoneClocks";
import NotificationCard from "./NotificationCard";

// 通知區可捲動，但解鎖也是上滑手勢，所以要攔掉冒泡，免得滑列表就把手機解鎖了。
const stopGesture = (event) => event.stopPropagation();
const gestureGuards = {
  onTouchStart: stopGesture, onTouchEnd: stopGesture,
  onMouseDown: stopGesture, onMouseUp: stopGesture,
  onPointerDown: stopGesture, onPointerUp: stopGesture,
};

export default function LockScreen({ unlocking, notifications, onOpenNotification, onUnlock, gestureHandlers, ft, fd, tr }) {
  return (
    <div className="mp-wrap">
      <div className="mp-phone">
        <div className={`mp-lock ${unlocking ? "out" : ""}`} {...gestureHandlers} onDoubleClick={onUnlock}>
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
          <div className="mp-lock-hint">{tr("向上滑動解鎖 MaliPhone（或雙擊）", "Swipe up to unlock MaliPhone (or double-click)", "MaliPhone を上にスワイプしてロック解除（またはダブルクリック）", "MaliPhone을 위로 밀어 잠금 해제(또는 더블클릭)")}</div>
        </div>
      </div>
    </div>
  );
}
