import { useEffect, useState } from "react";
import { Device } from "@capacitor/device";

const UNKNOWN_BATTERY = { level: null, isCharging: false, available: false };

export default function useBatteryStatus({ refreshIntervalMs = 60000 } = {}) {
  const [battery, setBattery] = useState(UNKNOWN_BATTERY);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const info = await Device.getBatteryInfo();
        if (!active) return;
        const rawLevel = Number(info?.batteryLevel);
        const available = Number.isFinite(rawLevel) && rawLevel >= 0;
        setBattery({
          level: available ? Math.max(0, Math.min(100, Math.round(rawLevel * 100))) : null,
          isCharging: !!info?.isCharging,
          available,
        });
      } catch (_) {
        if (active) setBattery(UNKNOWN_BATTERY);
      }
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    void refresh();
    const timer = window.setInterval(refresh, Math.max(15000, refreshIntervalMs));
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refresh);
    };
  }, [refreshIntervalMs]);

  return battery;
}
