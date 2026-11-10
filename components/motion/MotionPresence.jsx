import React, { useCallback, useLayoutEffect, useRef, useState } from "react";

const scheduleAfterPaint = (callback) => {
  if (typeof requestAnimationFrame !== "function") {
    const timer = setTimeout(callback, 0);
    return () => clearTimeout(timer);
  }
  let innerFrame = 0;
  const outerFrame = requestAnimationFrame(() => {
    innerFrame = requestAnimationFrame(callback);
  });
  return () => {
    cancelAnimationFrame(outerFrame);
    if (innerFrame) cancelAnimationFrame(innerFrame);
  };
};

export default function MotionPresence({ show, children, exitMs = 180, className = "" }) {
  const visible = Boolean(show);
  const [mounted, setMounted] = useState(visible);
  const [phase, setPhase] = useState(visible ? "entering" : "exited");
  const childRef = useRef(children);
  const mountedRef = useRef(visible);
  const phaseRef = useRef(visible ? "entering" : "exited");
  const visibleRef = useRef(visible);
  const sequenceRef = useRef(0);
  const exitTimerRef = useRef(0);

  visibleRef.current = visible;
  if (visible && children != null) childRef.current = children;

  const finishExit = useCallback(() => {
    if (visibleRef.current || phaseRef.current !== "exiting") return;
    sequenceRef.current += 1;
    clearTimeout(exitTimerRef.current);
    exitTimerRef.current = 0;
    mountedRef.current = false;
    phaseRef.current = "exited";
    setMounted(false);
    setPhase("exited");
  }, []);

  useLayoutEffect(() => {
    const sequence = ++sequenceRef.current;
    let cancelFrame = () => {};
    clearTimeout(exitTimerRef.current);
    exitTimerRef.current = 0;

    if (visible) {
      const wasExiting = mountedRef.current && phaseRef.current === "exiting";
      mountedRef.current = true;
      setMounted(true);
      phaseRef.current = wasExiting ? "visible" : "entering";
      setPhase(phaseRef.current);
      cancelFrame = scheduleAfterPaint(() => {
        if (sequenceRef.current !== sequence || !visibleRef.current) return;
        phaseRef.current = "visible";
        setPhase("visible");
      });
    } else if (mountedRef.current) {
      phaseRef.current = "exiting";
      setPhase("exiting");
      exitTimerRef.current = setTimeout(() => {
        if (sequenceRef.current !== sequence || visibleRef.current) return;
        finishExit();
      }, Math.max(0, exitMs));
    }

    return () => {
      cancelFrame();
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = 0;
    };
  }, [visible, exitMs, finishExit]);

  if (!mounted) return null;

  return (
    <div
      className={`mp-motion-presence ${className}`.trim()}
      data-phase={phase}
      aria-hidden={phase === "exiting" ? "true" : undefined}
      inert={phase === "exiting" ? "" : undefined}
      onTransitionEnd={(event) => {
        if (event.propertyName !== "opacity") return;
        if (!event.target?.matches?.(".mp-overlay,.mp-modal,.mp-sheet,.mp-popover")) return;
        if (event.target.closest?.(".mp-motion-presence") !== event.currentTarget) return;
        finishExit();
      }}
    >
      {childRef.current}
    </div>
  );
}
