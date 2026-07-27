import { useCallback, useEffect, useRef, useState } from "react";

const monotonicNow = () => (
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now()
);

/**
 * Keeps one transient surface interruptible across rapid replacements.
 * Timers pause while the document is hidden so feedback is not lost in the background.
 */
export default function useTransientItem({ holdMs, exitMs }) {
  const [item, setItem] = useState(null);
  const itemRef = useRef(null);
  const sequenceRef = useRef(0);
  const timerRef = useRef(null);
  const stageRef = useRef(null);
  const frameRefs = useRef([]);
  const advanceRef = useRef(null);

  const setCurrent = useCallback((next) => {
    itemRef.current = next;
    setItem(next);
  }, []);

  const cancelFrames = useCallback(() => {
    frameRefs.current.forEach((frame) => cancelAnimationFrame(frame));
    frameRefs.current = [];
  }, []);

  const clearTimer = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const scheduleStage = useCallback((kind, sequence, delay) => {
    clearTimer();
    const stage = {
      kind,
      sequence,
      remaining: Math.max(0, delay),
      deadline: 0,
    };
    stageRef.current = stage;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    stage.deadline = monotonicNow() + stage.remaining;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      advanceRef.current?.(kind, sequence);
    }, stage.remaining);
  }, [clearTimer]);

  const advanceStage = useCallback((kind, sequence) => {
    const stage = stageRef.current;
    const current = itemRef.current;
    if (!stage || stage.kind !== kind || stage.sequence !== sequence) return;
    if (!current || current.sequence !== sequence) {
      stageRef.current = null;
      return;
    }
    if (kind === "hold") {
      setCurrent({ ...current, phase: "exiting" });
      scheduleStage("exit", sequence, exitMs);
      return;
    }
    stageRef.current = null;
    setCurrent(null);
  }, [exitMs, scheduleStage, setCurrent]);
  advanceRef.current = advanceStage;

  const reveal = useCallback((sequence) => {
    const current = itemRef.current;
    if (current?.sequence === sequence && current.phase === "entering") {
      setCurrent({ ...current, phase: "visible" });
      scheduleStage("hold", sequence, holdMs);
    }
  }, [holdMs, scheduleStage, setCurrent]);

  const show = useCallback((value) => {
    const sequence = sequenceRef.current + 1;
    sequenceRef.current = sequence;
    const current = itemRef.current;
    const shouldReveal = !current || current.phase === "entering";
    cancelFrames();
    clearTimer();
    stageRef.current = null;
    setCurrent({
      value,
      sequence,
      phase: shouldReveal ? "entering" : "visible",
    });
    if (shouldReveal && (typeof document === "undefined" || document.visibilityState !== "hidden")) {
      const firstFrame = requestAnimationFrame(() => {
        const secondFrame = requestAnimationFrame(() => {
          frameRefs.current = [];
          reveal(sequence);
        });
        frameRefs.current = [secondFrame];
      });
      frameRefs.current = [firstFrame];
    }
    if (!shouldReveal) scheduleStage("hold", sequence, holdMs);
    return sequence;
  }, [cancelFrames, clearTimer, holdMs, reveal, scheduleStage, setCurrent]);

  const dismiss = useCallback(() => {
    const current = itemRef.current;
    if (!current || current.phase === "exiting") return;
    cancelFrames();
    setCurrent({ ...current, phase: "exiting" });
    scheduleStage("exit", current.sequence, exitMs);
  }, [cancelFrames, exitMs, scheduleStage, setCurrent]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const stage = stageRef.current;
      if (document.visibilityState === "hidden") {
        cancelFrames();
        if (stage && timerRef.current !== null) {
          stage.remaining = Math.max(0, stage.deadline - monotonicNow());
          clearTimer();
        }
        return;
      }
      const current = itemRef.current;
      if (current?.phase === "entering") reveal(current.sequence);
      if (stage && timerRef.current === null) {
        scheduleStage(stage.kind, stage.sequence, stage.remaining);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      cancelFrames();
      clearTimer();
      stageRef.current = null;
    };
  }, [cancelFrames, clearTimer, reveal, scheduleStage]);

  return { item, show, dismiss };
}
