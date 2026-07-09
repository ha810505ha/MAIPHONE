import { useEffect, useRef, useState } from "react";

export default function useAppPersistence({ defaults, snapshot, loadState, saveState, syncOnBoot, schedulePush, onLoad }) {
  const [hydrated, setHydrated] = useState(false);
  const initialLoadRef = useRef(onLoad);
  const loadConfigRef = useRef({ defaults, loadState, syncOnBoot });

  useEffect(() => {
    let mounted = true;
    const config = loadConfigRef.current;
    config.syncOnBoot().catch(() => null).then(() => config.loadState(config.defaults)).then((data) => {
      if (!mounted) return;
      initialLoadRef.current(data);
      setHydrated(true);
    }).catch(() => { if (mounted) setHydrated(true); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => { saveState(snapshot).then(() => schedulePush()).catch(() => {}); }, 180);
    return () => clearTimeout(timer);
  }, [hydrated, snapshot, saveState, schedulePush]);

  return { hydrated };
}
