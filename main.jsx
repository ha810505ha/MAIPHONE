import React from "react";
import { createRoot } from "react-dom/client";
import MaliPhone from "./MaliPhone.jsx";
import { GachaProvider } from "./contexts/GachaContext.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <GachaProvider><MaliPhone /></GachaProvider>
  </React.StrictMode>
);
