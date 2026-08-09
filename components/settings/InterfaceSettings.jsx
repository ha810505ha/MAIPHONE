import React from "react";

export default function InterfaceSettings({ t, tr, uiLanguage, setUiLanguage, fontSizeScale, setFontSizeScale, screenLockTimeout, setScreenLockTimeout }) {
  const autoLockDetail = screenLockTimeout === 0
    ? t("neverLock")
    : tr(
      `${screenLockTimeout} 分鐘後自動鎖定`,
      `Automatically locks after ${screenLockTimeout} ${screenLockTimeout === 1 ? "minute" : "minutes"}`,
      `${screenLockTimeout}分後に自動ロック`,
      `${screenLockTimeout}분 후 자동 잠금`,
    );

  return <>
    <div className="mp-sg">
      <div className="mp-sg-t">{tr("介面語言", "Interface language", "表示言語", "인터페이스 언어")}</div>
      <div className="mp-row">
        <div className="mp-lbl">{t("language")}</div>
        <select className="mp-ssel" value={uiLanguage} onChange={(event) => setUiLanguage(event.target.value)}>
          <option className="ignore-opencc" value="zh-TW">繁體中文</option><option className="ignore-opencc" value="zh-CN">简体中文</option><option className="ignore-opencc" value="en">English</option><option className="ignore-opencc" value="ja">日本語</option><option className="ignore-opencc" value="ko">한국어</option>
        </select>
      </div>
    </div>
    <div className="mp-sg">
      <div className="mp-sg-t">{t("screenLock")}</div>
      <div className="mp-row">
        <div className="mp-lbl">{t("autoLock")}</div>
        <select className="mp-ssel" value={String(screenLockTimeout)} onChange={(event) => setScreenLockTimeout(Number(event.target.value))}>
          <option value="1">{tr("1 分鐘", "1 minute", "1分", "1분")}</option><option value="3">{tr("3 分鐘", "3 minutes", "3分", "3분")}</option><option value="5">{tr("5 分鐘", "5 minutes", "5分", "5분")}</option><option value="10">{tr("10 分鐘", "10 minutes", "10分", "10분")}</option><option value="0">{t("neverLock")}</option>
        </select>
      </div>
      <div style={{ fontSize: 10, color: "var(--mp-txt-l)", lineHeight: 1.6 }}>{t("autoLockStatus")}：{autoLockDetail}</div>
    </div>
  </>;
}
