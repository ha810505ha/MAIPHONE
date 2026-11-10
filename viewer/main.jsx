import React from "react";
import { createRoot } from "react-dom/client";
import ViewerApp from "./ViewerApp.jsx";
import "./viewer.css";

// 唯讀檢視頁：獨立入口，不載入小手機主程式，也不讀寫 IndexedDB／localStorage。
createRoot(document.getElementById("viewer-root")).render(<ViewerApp />);
