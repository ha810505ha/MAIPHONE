import React, { useEffect, useLayoutEffect, useRef } from "react";
import {
  installBlankScreenWatchdog,
  setRuntimeDiagnosticApp,
} from "../../services/diagnostics/runtimeDiagnostics.js";
import { playAppOpen, playHomeEnter, resetAppLaunch } from "../../utils/appLaunchMotion.js";
import AppRouter from "../apps/AppRouter";
import { AllAppsDrawer, FolderPanel } from "../home/HomeAppLibrary";
import MusicShellLayer from "../music/MusicShellLayer";
import AppRuntimeBoundary from "./AppRuntimeBoundary";
import HomeScreen from "./HomeScreen";
import LockScreen from "./LockScreen";
import NotificationBanner from "./NotificationBanner";
import ThemeParticles from "./ThemeParticles";
import ScrollTopButton from "./ScrollTopButton";

export default function MaliPhoneShell({
  themeCss,
  locked,
  lockProps,
  onClickCapture,
  homeProps,
  libraryProps,
  folderProps,
  routerProps,
  currentApp,
  notificationProps,
  globalLayer,
  effects,
}) {
  const unlocking = lockProps?.unlocking === true;
  const previousAppRef = useRef(currentApp);
  const wasLockedRef = useRef(locked);
  const showEffects = effects?.enabled === true;

  // 解鎖後首頁從稍微放大的位置收回原位，接續鎖屏往上淡出的動作。
  useLayoutEffect(() => {
    const wasLocked = wasLockedRef.current;
    wasLockedRef.current = locked;
    if (wasLocked && !locked) playHomeEnter();
  }, [locked]);

  // 從首頁進入 App 時，在第一次繪製前把頁面縮到圖示位置再展開；App 之間切換不套用。
  useLayoutEffect(() => {
    const previousApp = previousAppRef.current;
    previousAppRef.current = currentApp;
    if (previousApp === currentApp) return;
    resetAppLaunch();
    if (!locked && currentApp && !previousApp) playAppOpen(currentApp);
  }, [currentApp, locked]);

  useEffect(() => {
    const appId = locked ? "lock" : (currentApp || "home");
    setRuntimeDiagnosticApp(appId);
    return installBlankScreenWatchdog({
      appId,
      locked,
      // The lock surface deliberately fades to transparent before it unmounts.
      // Do not report that intended animation state as a blank screen.
      skipWhen: unlocking,
    });
  }, [currentApp, locked, unlocking]);

  if (locked) {
    return (
      <>
        <style>{themeCss}</style>
        <LockScreen {...lockProps} effects={showEffects ? <ThemeParticles themeName={effects.theme} /> : null} />
      </>
    );
  }

  return (
    <>
      <style>{themeCss}</style>
      <div className="mp-wrap" onClickCapture={onClickCapture}>
        <div className="mp-phone" data-runtime-phone="true">
          <AppRuntimeBoundary
            appId={currentApp}
            onBack={routerProps.closeApp}
            tr={routerProps.tr}
          >
            {showEffects && <ThemeParticles themeName={effects.theme} layer="back" paused={!!currentApp} />}
            <HomeScreen {...homeProps} />
            {showEffects && <ThemeParticles themeName={effects.theme} layer="front" paused={!!currentApp} />}
            <AllAppsDrawer {...libraryProps} />
            <FolderPanel {...folderProps} />
            <div className="mp-app-stage" data-app-id={currentApp || undefined}>
              <AppRouter {...routerProps} />
            </div>
            <div className="mp-app-ghost" aria-hidden="true" inert="" />
            <ScrollTopButton currentApp={currentApp} tr={routerProps.tr} />
            <MusicShellLayer currentApp={currentApp} tr={routerProps.tr} />
            <NotificationBanner {...notificationProps} />
            {globalLayer}
          </AppRuntimeBoundary>
        </div>
      </div>
    </>
  );
}
