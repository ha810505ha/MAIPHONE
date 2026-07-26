import React from "react";
import { createRoot } from "react-dom/client";
import MaliPhone from "./MaliPhone.jsx";
import { GachaProvider } from "./contexts/GachaContext.jsx";
import { MusicPlayerProvider } from "./contexts/MusicPlayerContext.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <GachaProvider><MusicPlayerProvider><MaliPhone /></MusicPlayerProvider></GachaProvider>
  </React.StrictMode>
);
