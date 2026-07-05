import React from "react";

export default function AnswerBookApp({ closeApp, title }) {
  return <div className="mp-page" style={{ background: "#f7eef6" }}>
    <div className="mp-hdr"><div className="mp-back" onClick={closeApp}>←</div><div className="mp-htitle">{title}</div></div>
    <iframe title={title} src="./book.html" style={{ flex: 1, width: "100%", border: 0, background: "#f7eef6" }} />
  </div>;
}
