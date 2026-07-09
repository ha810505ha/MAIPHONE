import React from "react";
import ThemeSettings from "./ThemeSettings";
import CustomCssSettings from "./CustomCssSettings";
import HeroImageSettings from "./HeroImageSettings";
import InterfaceSettings from "./InterfaceSettings";
import ApiPresetSettings from "./ApiPresetSettings";
import AiConnectionSettings from "./AiConnectionSettings";
import VoiceApiSettings from "./VoiceApiSettings";
import ApiPresetModal from "./ApiPresetModal";
import AccountSyncSettings from "./AccountSyncSettings";
import DataBackupSettings from "./DataBackupSettings";
import DataImportPreviewModal from "./DataImportPreviewModal";
import ChatroomImportPreviewModal from "./ChatroomImportPreviewModal";
import AboutInfoSettings from "./AboutInfoSettings";
import ResetDataSettings from "./ResetDataSettings";

export default function SettingsApp({ closeApp, t, tr, tab, setTab, nightTheme, appearance, api, data, about, modals }) {
  const tabs = [
    { id: "appearance", label: t("appearance") },
    { id: "api", label: t("api") },
    { id: "data", label: t("data") },
    { id: "about", label: t("about") },
  ];
  return (
    <div className="mp-page">
      <div className="mp-hdr"><div className="mp-back" onClick={closeApp}>←</div><div className="mp-htitle">{t("settings")}</div></div>
      <div className="mp-set">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 4 }}>
          {tabs.map((item) => (
            <button key={item.id} type="button" className="mp-ibtn" style={{ padding: "8px 6px", minWidth: 0, fontWeight: 800, background: tab === item.id ? (nightTheme ? "linear-gradient(135deg,#4b3a62,#3a2d4f)" : "linear-gradient(135deg,#9aa8b3,#7b8791)") : (nightTheme ? "rgba(47,36,64,.72)" : "rgba(255,255,255,.72)"), color: tab === item.id ? "#fff" : "var(--mp-txt)", border: tab === item.id ? (nightTheme ? "1px solid rgba(200,168,224,.38)" : "1px solid rgba(123,135,145,.35)") : (nightTheme ? "1px solid #3a2d4f" : "1px solid rgba(160,176,186,.25)") }} onClick={() => setTab(item.id)}>{item.label}</button>
          ))}
        </div>
        {tab === "appearance" && <><div className="mp-sg"><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: "pointer" }} onClick={appearance.toggleOpen}><div><div className="mp-sg-t" style={{ marginBottom: 2 }}>{tr("主題與外觀", "Theme & appearance", "テーマと外観", "테마 및 외관")}</div><div style={{ fontSize: 10, color: "var(--mp-txt-l)" }}>{tr("主題、桌面立繪與自訂 CSS", "Theme, desktop image, and custom CSS", "テーマ、立ち絵、カスタム CSS", "테마, 데스크톱 이미지, 사용자 CSS")}</div></div><span style={{ fontSize: 11, fontWeight: 800, color: "var(--mp-pink-dk)" }}>{appearance.open ? tr("收合", "Collapse", "折りたたむ", "접기") : tr("展開", "Expand", "展開", "펼치기")}</span></div>{appearance.open && <div style={{ display: "flex", flexDirection: "column", marginTop: 12 }}><ThemeSettings {...appearance.themeProps} /><CustomCssSettings {...appearance.cssProps} /><HeroImageSettings {...appearance.heroProps} /></div>}</div><InterfaceSettings {...appearance.interfaceProps} /></>}
        {tab === "api" && <><ApiPresetSettings {...api.presetProps} /><AiConnectionSettings {...api.connectionProps} /><VoiceApiSettings {...api.voiceProps} /></>}
        {modals.preset && <ApiPresetModal {...modals.preset} />}
        {tab === "data" && <><AccountSyncSettings {...data.syncProps} /><DataBackupSettings {...data.backupProps} /></>}
        {modals.dataImport && <DataImportPreviewModal {...modals.dataImport} />}
        {modals.chatroomImport && <ChatroomImportPreviewModal {...modals.chatroomImport} />}
        {tab === "about" && <><AboutInfoSettings {...about.infoProps} /><ResetDataSettings {...about.resetProps} /></>}
      </div>
    </div>
  );
}
