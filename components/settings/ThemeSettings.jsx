import React from "react";
import { FONT_PRESETS } from "../../styles/maliPhoneCss";

export default function ThemeSettings({ t, tr, themeName, setThemeName, fontName, setFontName, fontSizeScale, setFontSizeScale, effectsEnabled, setEffectsEnabled }) {
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
    <div className="mp-row">
      <div className="mp-lbl">{tr("介面字體", "UI font", "フォント", "글꼴")}</div>
      <select className="mp-ssel" value={FONT_PRESETS[fontName] ? fontName : "圓體"} onChange={(event) => setFontName(event.target.value)}>
        {Object.keys(FONT_PRESETS).map((name) => {
          const fontLabels = {
            "圓體": tr("圓體（預設）", "Rounded (default)", "丸ゴシック（デフォルト）", "둥근 고딕(기본)"),
            "明體": tr("明體", "Serif", "明朝体", "명조체"),
            "手寫體": tr("手寫體", "Handwriting", "手書き風", "손글씨체"),
            "系統黑體": tr("系統黑體", "System Sans", "システムゴシック", "시스템 고딕"),
          };
          return <option value={name} key={name} style={{ fontFamily: FONT_PRESETS[name].stack }}>{fontLabels[name] || name}</option>;
        })}
      </select>
    </div>
    <div style={{ fontSize: 12, color: "var(--mp-txt-l)", lineHeight: 1.6, marginBottom: 10, fontFamily: FONT_PRESETS[fontName]?.stack }}>
      {tr("字體預覽：今天天氣真好 ABC 123", "Font preview: The quick brown fox ABC 123", "フォントプレビュー：今日はいい天気 ABC 123", "글꼴 미리보기: 오늘 날씨 참 좋다 ABC 123")}
    </div>
    <div className="mp-row"><div className="mp-lbl">{tr("文字大小", "Text size", "文字サイズ", "글자 크기")}</div><select className="mp-ssel" value={fontSizeScale || "normal"} onChange={(event) => setFontSizeScale(event.target.value)}><option value="normal">{tr("標準", "Standard", "標準", "기본")}</option><option value="large">{tr("稍大", "Large", "大きい", "크게")}</option><option value="xlarge">{tr("大", "Extra large", "さらに大きい", "더 크게")}</option><option value="xxlarge">{tr("特大", "Largest", "最大", "가장 크게")}</option></select></div>
    <div style={{ fontSize: 10, color: "var(--mp-txt-l)", lineHeight: 1.6, marginBottom: 10 }}>{tr("調整主要介面文字，不會改變圖片大小。", "Adjusts main interface text without resizing images.", "主な画面の文字を調整します。画像サイズは変わりません。", "주요 화면 글자만 조절하며 이미지 크기는 바뀌지 않습니다.")}</div>
    <div className="mp-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div><div className="mp-lbl">{tr("主題動態效果", "Theme effects", "テーマエフェクト", "테마 효과")}</div><div style={{ fontSize: 10, color: "var(--mp-txt-l)", marginTop: 2 }}>{tr("顯示花瓣、泡泡等主題動畫", "Show petals, bubbles, and other theme animations", "花びらや泡などのアニメーションを表示", "꽃잎, 버블 등 테마 애니메이션 표시")}</div></div>
      <button type="button" role="switch" aria-checked={effectsEnabled} className={`mp-switch ${effectsEnabled ? "active" : ""}`} onClick={() => setEffectsEnabled((value) => !value)}><span /></button>
    </div>
  </>;
}
