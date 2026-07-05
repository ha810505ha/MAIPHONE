import React from "react";

export default function ThemeSettings({ t, tr, themeName, setThemeName, effectsEnabled, setEffectsEnabled }) {
  const normalized = themeName === "湖水藍" ? "海鹽汽水" : themeName === "蜜桃手帳" ? "蜜桃慕斯" : themeName;
  const labels = {
    "莓果蘇打": tr("莓果蘇打", "Berry Soda", "ベリーソーダ", "베리 소다"),
    "夜色絨幕": tr("夜色絨幕", "Velvet Night", "夜色ベルベット", "밤빛 벨벳"),
    "抹茶檸檬": tr("抹茶檸檬", "Matcha Lemon", "抹茶レモン", "말차 레몬"),
    "海鹽汽水": tr("海鹽汽水", "Sea Salt Soda", "シーソルトソーダ", "솔트 소다"),
    "蜜桃慕斯": tr("蜜桃慕斯", "Peach Mousse", "ピーチムース", "복숭아 무스"),
  };
  return <>
    <div className="mp-sg-t">{t("theme")}</div>
    <div className="mp-row">
      <div className="mp-lbl">{t("theme")}</div>
      <select className="mp-ssel" value={normalized} onChange={(event) => setThemeName(event.target.value)}>
        {Object.entries(labels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
      </select>
    </div>
    <div style={{ fontSize: 10, color: "var(--mp-txt-l)", lineHeight: 1.6, marginBottom: 10 }}>{tr("目前主題：", "Current theme: ", "現在のテーマ：", "현재 테마: ")}{labels[normalized] || labels["海鹽汽水"]}</div>
    <div className="mp-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div><div className="mp-lbl">{tr("主題動態效果", "Theme effects", "テーマエフェクト", "테마 효과")}</div><div style={{ fontSize: 10, color: "var(--mp-txt-l)", marginTop: 2 }}>{tr("顯示花瓣、泡泡等主題動畫", "Show petals, bubbles, and other theme animations", "花びらや泡などのアニメーションを表示", "꽃잎, 버블 등 테마 애니메이션 표시")}</div></div>
      <button type="button" role="switch" aria-checked={effectsEnabled} className={`mp-switch ${effectsEnabled ? "active" : ""}`} onClick={() => setEffectsEnabled((value) => !value)}><span /></button>
    </div>
  </>;
}
