import React from "react";

export default function ContactsApp({ t, closeApp, characters, activeCharId, sanitizeImage, onAdd, onSetActive, onChat, onView }) {
  return <div className="mp-page"><div className="mp-hdr"><div className="mp-back" onClick={closeApp}>←</div><div className="mp-htitle">{t("characters")}</div></div><div className="mp-cm">
    <button className="mp-add" onClick={onAdd}>{t("add")} / {t("import")} {t("characters")}</button><div style={{ height: 8 }} />
    {characters.map((character) => <div key={character.id} className="mp-cc"><div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <div className="mp-av">{sanitizeImage(character.avatar) ? <img src={sanitizeImage(character.avatar)} alt="" /> : "🦊"}</div>
      <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 13 }}>{character.name}</div><div style={{ fontSize: 11, color: "var(--mp-txt-l)" }}>{(character.description || character.personality || t("noRoleConfig")).slice(0, 52)}</div></div>
      {activeCharId === character.id ? <span className="mp-active-badge">ACTIVE</span> : <button className="mp-ibtn" onClick={() => onSetActive(character)}>{t("setAsMainCharacter")}</button>}
    </div><div style={{ display: "flex", gap: 6 }}><button className="mp-ibtn-chat" onClick={() => onChat(character)}>{t("startChatting")}</button><button className="mp-ibtn-chat" onClick={() => onView(character)}>{t("viewMore")}</button></div></div>)}
  </div></div>;
}
