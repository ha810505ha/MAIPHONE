import React from "react";
import AppRouter from "../apps/AppRouter";
import { AllAppsDrawer, FolderPanel } from "../home/HomeAppLibrary";
import MusicShellLayer from "../music/MusicShellLayer";
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
        <div className="mp-phone">
          <HomeScreen {...homeProps} />
          <AllAppsDrawer {...libraryProps} />
          <FolderPanel {...folderProps} />
          <AppRouter {...routerProps} />
          <MusicShellLayer currentApp={currentApp} />
          <NotificationBanner {...notificationProps} />
          {globalLayer}
        </div>
      </div>
    </>
  );
}
