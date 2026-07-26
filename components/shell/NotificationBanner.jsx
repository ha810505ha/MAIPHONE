import React, { useRef, useState } from "react";
import NotificationCard from "./NotificationCard";

const DISMISS_DISTANCE = 60;

export default function NotificationBanner({ notification, onOpen, onDismiss, tr }) {
  const startRef = useRef(null);
  const swipedRef = useRef(false);
  const [leaving, setLeaving] = useState(false);
  if (!notification) return null;
  const close = () => {
    setLeaving(true);
    setTimeout(() => { setLeaving(false); onDismiss(); }, 200);
  };
  // 往上或往右滑都可以撥掉，跟真手機一致。
  const gestureHandlers = {
    onPointerDown: (event) => { swipedRef.current = false; startRef.current = { x: event.clientX, y: event.clientY }; },
    onPointerUp: (event) => {
      const start = startRef.current;
      startRef.current = null;
      if (!start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (dx <= DISMISS_DISTANCE && dy >= -DISMISS_DISTANCE) return;
      // 撥掉之後接著會發出 click，用旗標擋掉，免得順手把 App 也開了。
      swipedRef.current = true;
      close();
    },
  };
  return (
    <NotificationCard
      notification={notification}
      className={`mp-banner ${leaving ? "out" : ""}`}
      tr={tr}
      gestureHandlers={gestureHandlers}
      onClick={() => { if (!swipedRef.current) onOpen(notification); }}
    />
  );
}
