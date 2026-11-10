import React from "react";
import { AppHeader } from "../shell/LargeTitle";

export default function AnswerBookApp({ closeApp, title, backLabel, locale = "zh-TW" }) {
  return <div className="mp-page" style={{ background: "#f7eef6" }}>
    <AppHeader title={title} onBack={closeApp} backLabel={backLabel} />
    <iframe title={title} src={`./book.html?lang=${encodeURIComponent(locale)}`} style={{ flex: 1, width: "100%", border: 0, background: "#f7eef6" }} />
  </div>;
}
