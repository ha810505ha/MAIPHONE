import React, { useState } from "react";
import ThemeSettings, { TextSettings } from "./ThemeSettings";
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

// 分頁 id 維持舊值（通知與密碼重設流程會直接指定 settingsTab），只改顯示名稱與內容分配：
// appearance 外觀／notifications 通知／api AI／data 資料／about 一般。
export default function SettingsApp({ closeApp, t, tr, tab, setTab, nightTheme, appearance, api, data, about, modals, notifications, mailboxUnreadCount = 0 }) {
  const tabs = [
    // 五格分段很窄，英文用較短的 Display（Appearance 會被截斷）。
    { id: "appearance", label: tr("外觀", "Display", "外観", "외관") },
    { id: "notifications", label: tr("通知", "Alerts", "通知", "알림") },
    { id: "api", label: tr("AI", "AI", "AI", "AI") },
    { id: "data", label: t("data") },
    { id: "about", label: tr("一般", "General", "一般", "일반") },
  ];
  const largeTitle = useLargeTitle();
  // 自訂 CSS 是進階功能，預設收起，不讓長篇安全說明擠在一般選項中間。
  const [customCssOpen, setCustomCssOpen] = useState(false);
  const section = (zhTW, en, ja, ko) => <div className="mp-list-section">{tr(zhTW, en, ja, ko)}</div>;
  const pauseProactive = !!notifications?.settings?.pauseProactive;
  return (
    <div className={largeTitle.pageClassName}>
      <LargeTitleHeader title={t("settings")} onBack={closeApp} backLabel={tr("返回首頁", "Back to Home", "ホームに戻る", "홈으로 돌아가기")} />
      <div className="mp-set" onScroll={largeTitle.onScroll}>
        <LargeTitle title={t("settings")} />
        {/* 信箱用得不多但有獎勵要領，固定在分頁上方，切到哪一頁都看得到未讀數。 */}
        <SystemMailboxSettings tr={tr} locale={data.locale} refreshKey={mailboxUnreadCount} />
        <SegmentedControl items={tabs} value={tab} onChange={setTab} ariaLabel={t("settings")} />

        {tab === "appearance" && <>
          <ThemeSettings {...appearance.themeProps} />
          <HeroImageSettings {...appearance.heroProps} />
          <TextSettings {...appearance.themeProps} />
          {section("進階", "Advanced", "詳細設定", "고급")}
          {customCssOpen
            ? <CustomCssSettings {...appearance.cssProps} onCollapse={() => setCustomCssOpen(false)} />
            : (
              <button type="button" className="mp-sg mp-set-folded" onClick={() => setCustomCssOpen(true)}>
                <span className="mp-set-folded-copy">
                  <span className="mp-sg-t">{tr("自訂 CSS", "Custom CSS", "カスタム CSS", "사용자 CSS")}</span>
                  <small>{appearance.cssProps.enabled
                    ? tr("已啟用", "On", "有効", "사용 중")
                    : tr("未啟用", "Off", "無効", "사용 안 함")}</small>
                </span>
                <span className="mp-set-fold">{tr("展開", "Expand", "展開", "펼치기")}</span>
              </button>
            )}
        </>}

        {tab === "notifications" && <NotificationSettings tr={tr} {...notifications} />}

        {tab === "api" && <>
          <ApiPresetSettings {...api.presetProps} />
          <AiConnectionSettings {...api.connectionProps} />
          <MaliTestModelSettings {...api.hostedTestProps} />
          <VoiceApiSettings {...api.voiceProps} />
          {IMAGE_GEN_ENABLED && <ImageApiSettings tr={tr} />}
          {section("角色行為", "Character behavior", "キャラの動作", "캐릭터 동작")}
          <div className="mp-sg">
            <div className="mp-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div className="mp-lbl">{tr("暫停角色主動傳訊息", "Pause proactive messages", "キャラからの自動送信を停止", "캐릭터 자동 메시지 중지")}</div>
                <div style={{ fontSize: 11, color: "var(--mp-txt-l)", lineHeight: 1.55, marginTop: 2 }}>{tr(
                  "角色不會再自動生成訊息，可節省 API 額度。",
                  "Characters stop generating messages on their own, saving API quota.",
                  "キャラが自動でメッセージを生成しなくなり、API の消費を抑えられます。",
                  "캐릭터가 스스로 메시지를 생성하지 않아 API 사용량을 줄일 수 있습니다.",
                )}</div>
              </div>
              <button type="button" role="switch" aria-checked={pauseProactive} className={`mp-switch ${pauseProactive ? "active" : ""}`}
                onClick={() => notifications.updateSettings({ pauseProactive: !pauseProactive })}><span /></button>
            </div>
          </div>
        </>}
        {modals.preset && <ApiPresetModal {...modals.preset} />}

        {tab === "data" && <>
          <AccountSettingsSection {...data.accountProps} />
          <DataBackupSettings {...data.backupProps} />
          {section("危險區", "Danger zone", "危険な操作", "위험 구역")}
          <ResetDataSettings {...about.resetProps} />
        </>}

        {tab === "about" && <>
          <InterfaceSettings {...appearance.interfaceProps} />
          {section("關於", "About", "このアプリについて", "정보")}
          <AboutInfoSettings {...about.infoProps} />
        </>}
      </div>
    </div>
  );
}
