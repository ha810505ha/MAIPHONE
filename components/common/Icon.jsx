import React from "react";

// 小手機共用線條圖示：取代介面裡用 emoji 表示「沒有東西／功能」的地方。
// 顏色跟著 currentColor，粗細統一 1.8，圓角端點，跟圓體字的氣質一致。
const PATHS = {
  chat: <><path d="M5 5h11a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H10l-4 3v-3H5a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z" /><path d="M7.5 11h.01M10.5 11h.01M13.5 11h.01" /></>,
  user: <><circle cx="12" cy="8.5" r="3.6" /><path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6" /></>,
  users: <><circle cx="9" cy="9" r="3.2" /><path d="M3.5 19c.6-3.1 2.8-4.9 5.5-4.9s4.9 1.8 5.5 4.9" /><path d="M15.5 6.2a3 3 0 0 1 0 5.6M17.5 14.6c1.6.6 2.7 2.1 3 4.4" /></>,
  book: <><path d="M5 4.5h10.5A2.5 2.5 0 0 1 18 7v12.5H7.5A2.5 2.5 0 0 1 5 17z" /><path d="M5 17a2.5 2.5 0 0 1 2.5-2.5H18M9 8.5h5" /></>,
  books: <><path d="M4 5h4v15H4zM10 5h4v15h-4z" /><path d="M16 6.5l3.6-1 3 13.5-3.6 1z" /></>,
  sparkle: <><path d="M12 3.5l1.8 5 5 1.8-5 1.8-1.8 5-1.8-5-5-1.8 5-1.8z" /><path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" /></>,
  post: <><rect x="4.5" y="3.5" width="15" height="17" rx="2.5" /><rect x="7.5" y="6.5" width="9" height="5.5" rx="1.2" /><path d="M7.5 15h9M7.5 17.8h5.5" /></>,
  bell: <><path d="M18 15.5V11a6 6 0 0 0-12 0v4.5L4.5 18h15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
  receipt: <><path d="M6 3.5h12v17l-2.5-1.5-2 1.5-1.5-1.5-1.5 1.5-2-1.5L6 20.5z" /><path d="M9 8h6M9 11.5h6M9 15h3.5" /></>,
  gem: <><path d="M7 4.5h10l3.5 5L12 20 3.5 9.5z" /><path d="M3.5 9.5h17M9.5 4.5 12 9.5l2.5-5M12 9.5V20" /></>,
  notebook: <><rect x="5.5" y="3.5" width="13" height="17" rx="2" /><path d="M3.5 7.5h3M3.5 12h3M3.5 16.5h3M9.5 8h6M9.5 11.5h6" /></>,
  phone: <><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M10.5 18.5h3" /></>,
  heart: <path d="M12 19.5s-7.5-4.4-7.5-10A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7.5 2.5c0 5.6-7.5 10-7.5 10z" />,
  flower: <><circle cx="12" cy="12" r="2.2" /><path d="M12 9.8c-1.8-3.6.1-6.3 0-6.3s1.8 2.7 0 6.3zM14.2 12c3.6-1.8 6.3.1 6.3 0s-2.7 1.8-6.3 0zM12 14.2c1.8 3.6-.1 6.3 0 6.3s-1.8-2.7 0-6.3zM9.8 12c-3.6 1.8-6.3-.1-6.3 0s2.7-1.8 6.3 0z" /></>,
  warning: <><path d="M12 4 21 19.5H3z" /><path d="M12 10v4M12 17h.01" /></>,
  refresh: <><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" /><path d="M19.5 4.5v4h-4" /></>,
  camera: <><path d="M4 8h3l1.8-2.5h6.4L17 8h3v11H4z" /><circle cx="12" cy="13.2" r="3.4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  doll: <><circle cx="12" cy="6" r="2.6" /><path d="M8 20l1.5-6.5L7 10.5h10l-2.5 3L16 20M12 8.6v4" /></>,
};

export default function Icon({ name, size = 24, className = "", strokeWidth = 1.8, title }) {
  const path = PATHS[name] || PATHS.sparkle;
  return (
    <svg
      className={`mp-icon-line ${className}`.trim()}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : "true"}
      role={title ? "img" : undefined}
      aria-label={title}
    >
      {path}
    </svg>
  );
}
