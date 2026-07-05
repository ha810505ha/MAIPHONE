import React, { useState } from "react";

const GROUPS = [
  { title: "首頁", items: [
    [".mp-phone", "整個手機介面"], [".mp-desk", "首頁背景"], [".mp-cw", "首頁角色狀態卡"], [".peach-hero", "首頁立繪區"], [".mp-page-dots", "首頁分頁圓點"],
  ] },
  { title: "APP 與 Dock", items: [
    [".mp-icon-c", "APP 圖示容器"], [".mp-icon-l", "APP 名稱文字"], [".mp-grid", "首頁 APP 排列區"], [".mp-dock", "底部 Dock"], [".mp-dock-i", "Dock 內的 APP"],
  ] },
  { title: "單一 APP 圖示", items: [
    ['[data-app-id="chat"] .mp-icon-c', "聊天"],
    ['[data-app-id="status"] .mp-icon-c', "狀態"],
    ['[data-app-id="social"] .mp-icon-c', "社群"],
    ['[data-app-id="gallery"] .mp-icon-c', "相簿"],
    ['[data-app-id="lorebook"] .mp-icon-c', "世界書／設定資料"],
    ['[data-app-id="player"] .mp-icon-c', "玩家"],
    ['[data-app-id="wallet"] .mp-icon-c', "錢包"],
    ['[data-app-id="game"] .mp-icon-c', "遊戲中心"],
    ['[data-app-id="petHome"] .mp-icon-c', "寵物小屋"],
    ['[data-app-id="lbook"] .mp-icon-c', "解答之書"],
    ['[data-app-id="notebook"] .mp-icon-c', "記事本"],
    ['[data-app-id="settings"] .mp-icon-c', "設定"],
    ['[data-app-id="characters"] .mp-icon-c', "聯絡人"],
    ['[data-app-id="phone"] .mp-icon-c', "手機"],
    ['.mp-dock-i[data-app-id="chat"]', "Dock 裡的聊天圖示"],
  ] },
  { title: "頁面與按鈕", items: [
    [".mp-page", "一般 APP 頁面"], [".mp-hdr", "頁面頂部標題列"], [".mp-htitle", "頁面標題"], [".mp-back", "返回按鈕"], [".mp-ibtn", "一般按鈕"], [".mp-save", "儲存按鈕"],
  ] },
  { title: "聊天", items: [
    [".mp-chat-list", "聊天列表"], [".mp-chat-row", "角色聊天卡片"], [".mp-chat-row-avatar", "聊天列表頭像"], [".mp-chat-row-name", "角色名稱"], [".mp-chat-row-preview", "訊息預覽文字"],
  ] },
  { title: "設定", items: [
    [".mp-sg", "設定區塊卡片"], [".mp-row", "設定項目列"], [".mp-lbl", "設定標籤"], [".mp-sinp", "文字輸入欄"], [".mp-ssel", "下拉選單"], [".mp-switch", "設定開關"],
  ] },
  { title: "寵物小屋", items: [
    [".pet-home", "寵物小屋主要頁面（若該元素存在）"], [".desktop-pet", "桌面寵物（若該元素存在）"],
  ] },
];

const ALL_CSS = GROUPS.flatMap((group) => group.items.map(([selector, description]) => `/* ${description} */\n${selector} {\n  \n}`)).join("\n\n");
const AI_PROMPT = `請幫我製作 MaliPhone 的自訂 CSS。\n\n請只輸出 CSS，不要 HTML、JavaScript 或解釋。不要使用 @import 或外部網址。\n\n我想修改的風格：\n（請在這裡描述配色、圓角、陰影與想修改的位置）\n\n可用的選擇器：\n${GROUPS.flatMap((group) => group.items.map(([selector, description]) => `${selector}：${description}`)).join("\n")}`;

export default function CustomCssGuide({ onClose }) {
  const [copied, setCopied] = useState("");
  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(""), 1400);
    } catch { setCopied("複製失敗"); }
  };
  return (
    <div className="ccg-overlay" role="dialog" aria-modal="true" aria-label="自訂 CSS 選擇器清單">
      <style>{`
        .ccg-overlay{position:absolute;inset:0;z-index:120;display:flex;flex-direction:column;background:var(--mp-bg,#fff7fa);color:var(--mp-txt,#384750)}
        .ccg-head{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;padding:16px 18px;background:var(--mp-surface,#fff);border-bottom:1px solid var(--mp-border,#ecdce3)}
        .ccg-head h2{margin:0;font-size:17px}.ccg-close{width:34px;height:34px;border:1px solid var(--mp-border,#ddd);border-radius:50%;background:transparent;color:inherit;font-size:16px}
        .ccg-body{flex:1;overflow-y:auto;padding:15px 16px 34px}.ccg-tip{margin:0 0 13px;padding:11px 12px;border-radius:13px;background:color-mix(in srgb,var(--mp-pink,#f5a8bd) 13%,var(--mp-surface,#fff));font-size:10px;line-height:1.6;color:var(--mp-txt-l,#789)}
        .ccg-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:15px}.ccg-action{padding:9px;border:0;border-radius:12px;background:linear-gradient(135deg,var(--mp-save-1,#ef7ba1),var(--mp-save-2,#e91e63));color:#fff;font-size:11px;font-weight:800}
        .ccg-group{margin:0 0 13px;padding:12px;border:1px solid var(--mp-border,#ecdce3);border-radius:16px;background:var(--mp-surface,#fff)}.ccg-group h3{margin:0 0 8px;font-size:13px;color:var(--mp-pink-dk,#de678d)}
        .ccg-item{width:100%;display:flex;align-items:center;justify-content:space-between;gap:9px;padding:9px 4px;border:0;border-bottom:1px solid color-mix(in srgb,var(--mp-border,#ddd) 55%,transparent);background:transparent;color:inherit;text-align:left}.ccg-item:last-child{border-bottom:0}.ccg-item code{font-size:11px;font-weight:800;color:var(--mp-txt,#345)}.ccg-item span{font-size:9px;color:var(--mp-txt-l,#789);text-align:right}.ccg-toast{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);padding:8px 14px;border-radius:18px;background:#44383e;color:#fff;font-size:10px;box-shadow:0 8px 20px #0003}
      `}</style>
      <header className="ccg-head"><div><h2>自訂 CSS 選擇器</h2><div style={{fontSize:9,color:"var(--mp-txt-l)",marginTop:2}}>點擊項目即可複製 CSS 空白範本</div></div><button className="ccg-close" onClick={onClose}>✕</button></header>
      <div className="ccg-body">
        <p className="ccg-tip">這些選擇器可以交給 AI，或直接貼進自訂 CSS 編輯器。部分介面可能會隨版本更新而調整。</p>
        <div className="ccg-actions"><button className="ccg-action" onClick={() => copy(ALL_CSS,"已複製完整清單")}>複製完整清單</button><button className="ccg-action" onClick={() => copy(AI_PROMPT,"已複製 AI 提示詞")}>複製 AI 提示詞</button></div>
        {GROUPS.map((group) => <section className="ccg-group" key={group.title}><h3>{group.title}</h3>{group.items.map(([selector, description]) => <button className="ccg-item" key={selector} onClick={() => copy(`${selector} {\n  \n}`,`已複製 ${selector}`)}><code>{selector}</code><span>{description}<br />點擊複製</span></button>)}</section>)}
      </div>
      {copied && <div className="ccg-toast">{copied}</div>}
    </div>
  );
}
