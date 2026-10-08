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
import { LargeTitle, LargeTitleHeader, useLargeTitle } from "../shell/LargeTitle";
import SegmentedControl from "../common/SegmentedControl";

export default function SettingsApp({ closeApp, t, tr, tab, setTab, nightTheme, appearance, api, data, about, modals, notifications, mailboxUnreadCount = 0 }) {
  const tabs = [
    { id: "appearance", label: t("appearance") },
    { id: "notifications", label: tr("通知", "Alerts", "通知", "알림") },
    { id: "api", label: t("api") },
    { id: "data", label: t("data"), unread: mailboxUnreadCount > 0 },
    { id: "about", label: t("about") },
  ];
  const largeTitle = useLargeTitle();
  return (
    <div className={largeTitle.pageClassName}>
      <LargeTitleHeader title={t("settings")} onBack={closeApp} backLabel={tr("返回首頁", "Back to Home", "ホームに戻る", "홈으로 돌아가기")} />
      <div className="mp-set" onScroll={largeTitle.onScroll}>
        <LargeTitle title={t("settings")} />
        <SegmentedControl
          items={tabs.map((item) => ({ ...item, badge: item.unread ? <i className="mp-seg-dot" data-settings-mailbox-dot="1" aria-hidden="true" /> : null, ariaLabel: item.unread ? `${item.label}・${tr("有未讀信件", "unread mail", "未読メールあり", "읽지 않은 메일")}` : undefined }))}
          value={tab}
          onChange={setTab}
          ariaLabel={t("settings")}
        />
        {tab === "appearance" && <><div className="mp-sg"><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: "pointer" }} onClick={appearance.toggleOpen}><div><div className="mp-sg-t" style={{ marginBottom: 2 }}>{tr("主題與外觀", "Theme & appearance", "テーマと外観", "테마 및 외관")}</div><div style={{ fontSize: 10, color: "var(--mp-txt-l)" }}>{tr("主題、桌面立繪與自訂 CSS", "Theme, desktop image, and custom CSS", "テーマ、立ち絵、カスタム CSS", "테마, 데스크톱 이미지, 사용자 CSS")}</div></div><span style={{ fontSize: 11, fontWeight: 800, color: "var(--mp-pink-dk)" }}>{appearance.open ? tr("收合", "Collapse", "折りたたむ", "접기") : tr("展開", "Expand", "展開", "펼치기")}</span></div>{appearance.open && <div style={{ display: "flex", flexDirection: "column", marginTop: 12 }}><ThemeSettings {...appearance.themeProps} /><CustomCssSettings {...appearance.cssProps} /><HeroImageSettings {...appearance.heroProps} /></div>}</div><InterfaceSettings {...appearance.interfaceProps} /></>}
        {tab === "notifications" && <NotificationSettings tr={tr} {...notifications} />}
        {tab === "api" && <><ApiPresetSettings {...api.presetProps} /><AiConnectionSettings {...api.connectionProps} /><MaliTestModelSettings {...api.hostedTestProps} /> <VoiceApiSettings {...api.voiceProps} />{IMAGE_GEN_ENABLED && <ImageApiSettings tr={tr} />}</>}
        {modals.preset && <ApiPresetModal {...modals.preset} />}
        {tab === "data" && <><SystemMailboxSettings tr={tr} locale={data.locale} /><AccountSettingsSection {...data.accountProps} /><DataBackupSettings {...data.backupProps} /></>}
        {tab === "about" && <><AboutInfoSettings {...about.infoProps} /><ResetDataSettings {...about.resetProps} /></>}
      </div>
    </div>
  );
}
