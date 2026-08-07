import React from "react";
import ThemeSettings from "./ThemeSettings";
import CustomCssSettings from "./CustomCssSettings";
import HeroImageSettings from "./HeroImageSettings";
import InterfaceSettings from "./InterfaceSettings";
import ApiPresetSettings from "./ApiPresetSettings";
import AiConnectionSettings from "./AiConnectionSettings";
import MaliTestModelSettings from "./MaliTestModelSettings";
import VoiceApiSettings from "./VoiceApiSettings";
import ImageApiSettings from "./ImageApiSettings";
import ApiPresetModal from "./ApiPresetModal";
import AccountSettingsSection from "../auth/AccountSettingsSection";
import DataBackupSettings from "./DataBackupSettings";
import AboutInfoSettings from "./AboutInfoSettings";
import ResetDataSettings from "./ResetDataSettings";
import SystemMailboxSettings from "./SystemMailboxSettings";
import NotificationSettings from "./NotificationSettings";
import { IMAGE_GEN_ENABLED } from "../../config/featureFlags";

export default function SettingsApp({ closeApp, t, tr, tab, setTab, nightTheme, appearance, api, data, about, modals, notifications, mailboxUnreadCount = 0 }) {
  const tabs = [
    { id: "appearance", label: t("appearance") },
    { id: "notifications", label: tr("通知", "Alerts", "通知", "알림") },
    { id: "api", label: t("api") },
    { id: "data", label: t("data"), unread: mailboxUnreadCount > 0 },
    { id: "about", label: t("about") },
  ];
  return (
    <div className="mp-page">
      <div className="mp-hdr"><div className="mp-back" onClick={closeApp}>←</div><div className="mp-htitle">{t("settings")}</div></div>
      <div className="mp-set">
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${tabs.length},1fr)`, gap: 8, marginBottom: 4 }}>
          {tabs.map((item) => (
            <button key={item.id} type="button" aria-label={item.unread ? `${item.label}・有未讀信件` : item.label} className="mp-ibtn" style={{ position: "relative", padding: "8px 6px", minWidth: 0, fontWeight: 800, background: tab === item.id ? (nightTheme ? "linear-gradient(135deg,#4b3a62,#3a2d4f)" : "linear-gradient(135deg,#9aa8b3,#7b8791)") : (nightTheme ? "rgba(47,36,64,.72)" : "rgba(255,255,255,.72)"), color: tab === item.id ? "#fff" : "var(--mp-txt)", border: tab === item.id ? (nightTheme ? "1px solid rgba(200,168,224,.38)" : "1px solid rgba(123,135,145,.35)") : (nightTheme ? "1px solid #3a2d4f" : "1px solid rgba(160,176,186,.25)") }} onClick={() => setTab(item.id)}>{item.label}{item.unread && <span data-settings-mailbox-dot="1" aria-hidden="true" style={{ position: "absolute", top: 4, right: 5, width: 7, height: 7, borderRadius: "50%", background: "#f0445e", border: "1.5px solid var(--mp-surface)", boxShadow: "0 1px 4px rgba(190,35,65,.35)" }} />}</button>
          ))}
        </div>
        {tab === "appearance" && <><div className="mp-sg"><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: "pointer" }} onClick={appearance.toggleOpen}><div><div className="mp-sg-t" style={{ marginBottom: 2 }}>{tr("主題與外觀", "Theme & appearance", "テーマと外観", "테마 및 외관")}</div><div style={{ fontSize: 10, color: "var(--mp-txt-l)" }}>{tr("主題、桌面立繪與自訂 CSS", "Theme, desktop image, and custom CSS", "テーマ、立ち絵、カスタム CSS", "테마, 데스크톱 이미지, 사용자 CSS")}</div></div><span style={{ fontSize: 11, fontWeight: 800, color: "var(--mp-pink-dk)" }}>{appearance.open ? tr("收合", "Collapse", "折りたたむ", "접기") : tr("展開", "Expand", "展開", "펼치기")}</span></div>{appearance.open && <div style={{ display: "flex", flexDirection: "column", marginTop: 12 }}><ThemeSettings {...appearance.themeProps} /><CustomCssSettings {...appearance.cssProps} /><HeroImageSettings {...appearance.heroProps} /></div>}</div><InterfaceSettings {...appearance.interfaceProps} /></>}
        {tab === "notifications" && <NotificationSettings tr={tr} {...notifications} />}
        {tab === "api" && <><ApiPresetSettings {...api.presetProps} /><AiConnectionSettings {...api.connectionProps} /><MaliTestModelSettings {...api.hostedTestProps} /> <VoiceApiSettings {...api.voiceProps} />{IMAGE_GEN_ENABLED && <ImageApiSettings tr={tr} />}</>}
        {modals.preset && <ApiPresetModal {...modals.preset} />}
        {tab === "data" && <><SystemMailboxSettings /><AccountSettingsSection {...data.accountProps} /><DataBackupSettings {...data.backupProps} /></>}
        {tab === "about" && <><AboutInfoSettings {...about.infoProps} /><ResetDataSettings {...about.resetProps} /></>}
      </div>
    </div>
  );
}
