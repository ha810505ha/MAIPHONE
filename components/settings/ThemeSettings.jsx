import React from "react";
import { FONT_PRESETS } from "../../styles/themePresets";
import { buildFontStack, sanitizeFontName } from "../../utils/fontName";

export default function ThemeSettings({ t, tr, themeName, setThemeName, fontName, setFontName, fontSizeScale, setFontSizeScale, customFontName, setCustomFontName, effectsEnabled, setEffectsEnabled }) {
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
            "粉圓": tr("粉圓", "Huninn Rounded", "粉円ゴシック", "훈인 둥근체"),
            "黑體": tr("黑體", "Sans", "ゴシック体", "고딕체"),
            "明體": tr("明體", "Serif", "明朝体", "명조체"),
            "文楷": tr("文楷", "Kai Serif", "楷書体", "해서체"),
            "芫荽": tr("芫荽（手寫楷）", "Iansui Handwriting", "芫荽（手書き楷書）", "옌쑤이 손글씨"),
            "手寫體": tr("手寫體", "Handwriting", "手書き風", "손글씨체"),
            "系統黑體": tr("系統黑體", "System Sans", "システムゴシック", "시스템 고딕"),
          };
          return <option value={name} key={name} style={{ fontFamily: FONT_PRESETS[name].stack }}>{fontLabels[name] || name}</option>;
        })}
      </select>
    </div>
    <div className="mp-row">
      <div className="mp-lbl">{tr("自訂字型", "Custom font", "カスタムフォント", "사용자 글꼴")}</div>
      <input
        className="mp-sinp"
        value={customFontName || ""}
        maxLength={40}
        spellCheck={false}
        placeholder={tr("例如：微軟正黑體", "e.g. Georgia", "例：メイリオ", "예: 맑은 고딕")}
        onChange={(event) => setCustomFontName(sanitizeFontName(event.target.value))}
      />
    </div>
    <div style={{ fontSize: 10, color: "var(--mp-txt-l)", lineHeight: 1.6, marginBottom: 6 }}>
      {tr(
        "填入你電腦或手機裡已安裝的字型名稱，會優先套用；沒安裝時自動退回上面選的字體。留空即停用。",
        "Enter a font already installed on your device. It takes priority, and falls back to the selection above when unavailable. Leave blank to disable.",
        "端末にインストール済みのフォント名を入力すると優先的に適用されます。未インストール時は上の書体に戻ります。空欄で無効。",
        "기기에 설치된 글꼴 이름을 입력하면 우선 적용되며, 없으면 위 서체로 되돌아갑니다. 비우면 해제됩니다.",
      )}
    </div>
    <div style={{ fontSize: 12, color: "var(--mp-txt-l)", lineHeight: 1.6, marginBottom: 10, fontFamily: buildFontStack(customFontName, FONT_PRESETS[fontName]?.stack || FONT_PRESETS["圓體"].stack) }}>
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
