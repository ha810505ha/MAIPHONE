import React, { useEffect } from "react";
import {
  installBlankScreenWatchdog,
  setRuntimeDiagnosticApp,
} from "../../services/diagnostics/runtimeDiagnostics.js";
import AppRouter from "../apps/AppRouter";
import { AllAppsDrawer, FolderPanel } from "../home/HomeAppLibrary";
import MusicShellLayer from "../music/MusicShellLayer";
import AppRuntimeBoundary from "./AppRuntimeBoundary";
import HomeScreen from "./HomeScreen";
import LockScreen from "./LockScreen";
import NotificationBanner from "./NotificationBanner";

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
}) {
  const unlocking = lockProps?.unlocking === true;

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
        <LockScreen {...lockProps} />
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
            <HomeScreen {...homeProps} />
            <AllAppsDrawer {...libraryProps} />
            <FolderPanel {...folderProps} />
            <AppRouter {...routerProps} />
            <MusicShellLayer currentApp={currentApp} />
            <NotificationBanner {...notificationProps} />
            {globalLayer}
          </AppRuntimeBoundary>
        </div>
      </div>
    </>
  );
}
