import React from "react";
import { createRoot } from "react-dom/client";
import MaliPhone from "./MaliPhone.jsx";
import { GachaProvider } from "./contexts/GachaContext.jsx";
import { MusicPlayerProvider } from "./contexts/MusicPlayerContext.jsx";
import AppRuntimeBoundary from "./components/shell/AppRuntimeBoundary.jsx";
import {
  installGlobalRuntimeDiagnostics,
  installRootBlankScreenWatchdog,
} from "./services/diagnostics/runtimeDiagnostics.js";
import { installNativeAuthRedirectHandler } from "./services/auth/nativeAuthRedirect.js";
import { handleGoogleDriveWebRedirect } from "./services/backup/googleDriveBackupService.js";

installGlobalRuntimeDiagnostics();
installRootBlankScreenWatchdog();
void installNativeAuthRedirectHandler();
void handleGoogleDriveWebRedirect().catch((error) => console.warn("[google-drive] redirect handling failed", error));

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppRuntimeBoundary appId="root">
      <GachaProvider><MusicPlayerProvider><MaliPhone /></MusicPlayerProvider></GachaProvider>
    </AppRuntimeBoundary>
  </React.StrictMode>
);
