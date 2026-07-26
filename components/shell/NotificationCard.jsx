import React from "react";
import { sanitizeUserImageUrl } from "../../utils/coreUtils";
import { formatNotificationTime } from "../../services/notifications/notificationSources";

// 鎖定畫面與 App 內橫幅共用同一張卡，只差外層 className。
export default function NotificationCard({ notification, className, onClick, gestureHandlers, tr }) {
  const avatar = sanitizeUserImageUrl(notification.avatar);
  const title = notification.summaryCount
    ? tr(
      `${notification.summaryCount} 則新通知`,
      `${notification.summaryCount} new notifications`,
      `新着通知 ${notification.summaryCount} 件`,
      `새 알림 ${notification.summaryCount}건`,
    )
    : notification.count > 1
      ? `${notification.title}・${tr(`${notification.count} 則訊息`, `${notification.count} messages`, `${notification.count} 件のメッセージ`, `메시지 ${notification.count}건`)}`
      : notification.title;
  const body = notification.summaryCount ? notification.names : notification.body;
  return (
    <button type="button" className={`mp-notif ${className || ""}`} onClick={onClick} {...gestureHandlers}>
      <div className="mp-notif-avatar">
        {notification.summaryCount ? "🔔" : avatar ? <img src={avatar} alt="" /> : (notification.fallbackIcon || "🙂")}
      </div>
      <div className="mp-notif-body">
        <div className="mp-notif-head">
          <span className="mp-notif-name">{title}</span>
          <span className="mp-notif-time">{formatNotificationTime(notification.time, tr)}</span>
        </div>
        <div className="mp-notif-preview">{body}</div>
      </div>
    </button>
  );
}
