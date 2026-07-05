import React, { useEffect, useState } from "react";

export function BarClock({ ft, hideTime = false }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className={`mp-bar ${hideTime ? "mp-lock-bar" : ""}`}>
      {!hideTime && <span>{ft(now)}</span>}
      <div className="mp-bar-r"><span>📶</span><span>100%</span><span>🔋</span></div>
    </div>
  );
}

export function LockClock({ ft, fd }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const dateInfo = fd(now);
  return (
    <>
      <div className="mp-lock-time">{ft(now)}</div>
      <div className="mp-lock-date">{dateInfo.day} · {dateInfo.month} {dateInfo.date}</div>
    </>
  );
}

export function DeskClock({ ft, fd }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const dateInfo = fd(now);
  return (
    <div className="mp-clock">
      <div className="mp-clock-big">{ft(now)}</div>
      <div className="mp-clock-meta"><span className="mp-clock-day">{dateInfo.day}</span><span className="mp-clock-ds">{dateInfo.month} · {dateInfo.date}</span></div>
    </div>
  );
}
