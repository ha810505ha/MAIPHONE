import React, { useState } from "react";

// note：寫給不會翻原始碼的使用者看的結構說明。凡是「外層 class 底下還有子元素」
// 或「同一個東西在不同位置有不同寫法」的地方都要標，否則只能靠猜，猜錯就整段失效。
const GROUPS = [
  { title: "首頁", items: [
    [".mp-phone", "整個手機介面（顏色變數寫在這裡）"], [".mp-desk", "首頁背景"], [".mp-cw", "首頁角色狀態卡"], [".mp-cw-name", "角色狀態卡的名字"], [".mp-cw-desc", "角色狀態卡的說明文字"], [".peach-hero", "首頁立繪區"], [".mp-page-dots", "首頁分頁圓點的容器"], [".mp-page-dot", "單一圓點"], [".mp-page-dot.active", "目前所在頁的圓點"],
  ] },
  { title: "螢幕鎖定", items: [
    [".mp-lock", "鎖定畫面與背景（可設定 --mp-lock-bg）"], [".mp-lock-time", "鎖定畫面時間"], [".mp-lock-date", "鎖定畫面日期"], [".mp-lock-notifs", "鎖定畫面通知排列區"], [".mp-lock-notif", "單一鎖定畫面通知的外框"], [".mp-lock-hint", "底部解鎖提示文字"],
  ] },
  { title: "APP 圖示與 Dock", note: "首頁格子和 Dock 的結構不一樣：首頁是 .mp-icon 外框包著 .mp-icon-c 圓角底；Dock 的 .mp-dock-i 裡面直接放圖片，沒有 .mp-icon-c。所以 Dock 不能寫 .mp-dock-i .mp-icon-c。", items: [
    [".mp-icon", "首頁單一 APP 的外框（含名稱）"], [".mp-icon-c", "首頁 APP 圖示的圓角底（Dock 沒有這層）"], [".mp-icon-l", "APP 名稱文字"], [".mp-app-icon-img", "APP 圖片本身（可用 filter 調色）"], [".mp-grid", "首頁 APP 排列區"], [".mp-dock", "底部 Dock"], [".mp-dock-i", "Dock 內的單一 APP"], [".mp-all-apps-handle", "底部「全部 App」把手"], [".mp-folder-icon", "資料夾圖示"], [".mp-folder-panel", "打開資料夾後的面板"],
  ] },
  { title: "首頁格子的 APP 圖示", note: "只對「放在首頁格子上」的 APP 有效。聊天、社群、聯絡人、設定這四個預設在 Dock，要用下一組的寫法。把 APP 從 Dock 拖到首頁後，才會改用這裡的寫法。", items: [
    ['[data-app-id="status"] .mp-icon-c', "狀態"],
    ['[data-app-id="gallery"] .mp-icon-c', "相簿"],
    ['[data-app-id="lorebook"] .mp-icon-c', "世界書／設定資料"],
    ['[data-app-id="player"] .mp-icon-c', "玩家"],
    ['[data-app-id="wallet"] .mp-icon-c', "錢包"],
    ['[data-app-id="game"] .mp-icon-c', "遊戲中心"],
    ['[data-app-id="petHome"] .mp-icon-c', "寵物小屋"],
    ['[data-app-id="yunyin"] .mp-icon-c', "雲隱山莊"],
    ['[data-app-id="lbook"] .mp-icon-c', "解答之書"],
    ['[data-app-id="notebook"] .mp-icon-c', "記事本"],
    ['[data-app-id="music"] .mp-icon-c', "一起聽歌"],
    ['[data-app-id="dating"] .mp-icon-c', "信風"],
    ['[data-app-id="couple"] .mp-icon-c', "情侶空間（預設不在首頁，需自行加入）"],
    ['[data-app-id="calendar"] .mp-icon-c', "日曆（預設不在首頁，需自行加入）"],
    ['[data-app-id="phone"] .mp-icon-c', "手機（預設不在首頁，需自行加入）"],
  ] },
  { title: "Dock 的 APP 圖示", note: "Dock 項目本身就是要上色的對象，後面不要再接 .mp-icon-c。若把這些 APP 拖出 Dock，就改用上一組的寫法。", items: [
    ['.mp-dock-i[data-app-id="chat"]', "聊天"],
    ['.mp-dock-i[data-app-id="social"]', "社群"],
    ['.mp-dock-i[data-app-id="characters"]', "聯絡人"],
    ['.mp-dock-i[data-app-id="settings"]', "設定"],
  ] },
  { title: "頁面與按鈕", items: [
    [".mp-page", "一般 APP 頁面"], [".mp-hdr", "頁面頂部標題列"], [".mp-htitle", "頁面標題"], [".mp-back", "返回按鈕"], [".mp-ibtn", "一般按鈕"], [".mp-ibtn-r", "紅色／警示按鈕"], [".mp-save", "儲存按鈕"], [".mp-modal", "彈出視窗"], [".mp-modal-t", "彈出視窗標題"], [".mp-toast", "底部提示訊息"],
  ] },
  { title: "主題與版面變數", note: "這些變數寫在 .mp-phone 裡就會整支手機生效，是改配色最省力的方式，不用一個一個元件改。", items: [
    [".mp-phone", "可設定 --mp-page-bg、--mp-lock-bg、--mp-card-bg、--mp-card-border、--mp-accent、--mp-muted、--mp-shadow 與 --mp-space-*"],
  ] },
  { title: "聊天列表", note: "一列聊天是 .mp-chat-row，裡面左邊是 .mp-chat-row-avatar，右邊 .mp-chat-row-body 再分上下兩排。置頂的那列會多一個 .pinned。", items: [
    [".mp-chat-list", "聊天列表"], [".mp-chat-row", "角色聊天卡片"], [".mp-chat-row.pinned", "被置頂的聊天卡片"], [".mp-chat-row-avatar", "聊天列表頭像"], [".mp-chat-row-name", "角色名稱"], [".mp-chat-row-preview", "訊息預覽文字"], [".mp-chat-row-time", "時間"], [".mp-chat-row-badge", "未讀數字"], [".mp-chat-row-pin", "置頂標記"],
  ] },
  { title: "聊天訊息", note: "每則訊息外面包一層 .mp-msg-wrap（對方是 -ai、自己是 -user，負責左右對齊），裡面才是泡泡 .mp-msg。要改泡泡顏色請改 .mp-msg-ai／.mp-msg-user，不要改 .mp-msg-wrap。", items: [
    [".mp-msgs", "訊息捲動區（可改整個聊天室背景）"], [".mp-msg", "所有訊息泡泡共通"], [".mp-msg-ai", "對方的訊息泡泡"], [".mp-msg-user", "自己的訊息泡泡"], [".mp-msg-wrap-ai", "對方訊息那一整排"], [".mp-msg-wrap-user", "自己訊息那一整排"], [".mp-msg-t", "訊息底下的時間"], [".mp-msg-img", "訊息裡的圖片"], [".mp-av", "聊天室頭像"], [".mp-typing", "對方輸入中的動畫"], [".mp-inp-bar", "底部輸入列"], [".mp-inp", "輸入框"], [".mp-btn-send", "送出按鈕"],
  ] },
  { title: "社群", items: [
    [".mp-feed", "社群動態牆"], [".mp-post", "單則貼文卡片"], [".mp-post-av", "貼文頭像"], [".mp-post-au", "貼文作者名"], [".mp-post-ct", "貼文內文"], [".mp-post-tm", "貼文時間"], [".mp-post-acts", "按讚留言那一列"], [".mp-comment", "單則留言"],
  ] },
  { title: "通知", items: [
    [".mp-notif", "單一通知卡片"], [".mp-notif-avatar", "通知頭像"], [".mp-notif-name", "通知標題"], [".mp-notif-preview", "通知內容"], [".mp-notif-time", "通知時間"], [".mp-banner", "從上方滑下的通知橫幅"],
  ] },
  { title: "設定", note: "開關是 <button class=\"mp-switch\">，裡面那顆白色圓點是它的 <span>。打開時外層會多一個 .active。這裡沒有 input，也沒有 .slider。", items: [
    [".mp-sg", "設定區塊卡片"], [".mp-sg-t", "設定區塊標題"], [".mp-row", "設定項目列"], [".mp-lbl", "設定標籤"], [".mp-sinp", "文字輸入欄"], [".mp-ssel", "下拉選單"], [".mp-ta", "多行文字框"], [".mp-switch", "設定開關的外框"], [".mp-switch > span", "開關裡的白色圓點"], [".mp-switch.active", "打開狀態的開關"], [".mp-switch.active > span", "打開狀態的圓點"],
  ] },
  { title: "寵物小屋", items: [
    [".pet-home", "寵物小屋主要頁面（若該元素存在）"], [".desktop-pet", "桌面寵物（若該元素存在）"],
  ] },
  { title: "新版 APP", items: [
    [".music-app-page", "一起聽歌主要頁面"], [".music-app-artwork", "一起聽歌封面區"], [".music-app-controls", "一起聽歌播放控制列"], [".music-app-input", "一起聽歌輸入欄"], [".music-floating-player", "桌面浮動播放器"], [".dt-page", "信風主要頁面"], [".dt-card", "信風角色卡"], [".dt-msg-bubble", "信風聊天泡泡"], [".couple-app-page", "情侶空間主要頁面"], [".calendar-app-page", "日曆主要頁面"], [".calendar-grid", "日曆月份格"], [".calendar-event-card", "日曆事件卡片"],
  ] },
  { title: "角色手機選擇頁", items: [
    [".phone-picker-page", "進入角色手機前的選擇頁"], [".phone-picker-panel", "角色選擇面板"], [".phone-picker-list", "角色排列與間距"], [".phone-picker-card", "單一角色卡片"], [".phone-picker-avatar", "角色頭像"], [".phone-picker-name", "角色名稱"], [".phone-picker-hint", "角色卡片說明文字"],
  ] },
];

const RULES = [
  "改不動時在後面加 !important，例如 color: #333 !important;（部分元件寫死了樣式，要這樣才蓋得過）",
  "不能用外部網址的圖片或字型，會被安全機制擋掉。字型請用電腦本來就有的，例如 Georgia、微軟正黑體",
  "大括號 { } 要成對，少一個或多一個都會存不進去",
  "只列在這裡的選擇器才保證有效，自己想像的 class 名稱不會生效",
];

const ALL_CSS = GROUPS.flatMap((group) => {
  const head = `/* ===== ${group.title} ===== */${group.note ? `\n/* ${group.note} */` : ""}`;
  return [head, ...group.items.map(([selector, description]) => `/* ${description} */\n${selector} {\n  \n}`)];
}).join("\n\n");

const AI_PROMPT = `請幫我製作 MaliPhone 的自訂 CSS。

請只輸出 CSS，不要 HTML、JavaScript 或任何解釋文字。

【必須遵守】
1. 只能使用下面列出的選擇器，不可以自己發明或推測 class 名稱。沒列出來的東西就不要改。
2. 不可以使用 @import、外部網址（http、https、// 開頭）、expression 或 javascript:。字型只能用系統內建字型。
3. 需要蓋掉既有樣式時請加 !important。
4. 大括號必須成對。
5. 請特別注意各組的「結構說明」，那是實際的 HTML 結構，寫錯就不會生效。

我想修改的風格：
（請在這裡描述配色、圓角、陰影與想修改的位置）

【可用的選擇器】
${GROUPS.map((group) => {
  const note = group.note ? `\n※ 結構說明：${group.note}` : "";
  return `\n■ ${group.title}${note}\n${group.items.map(([selector, description]) => `${selector}：${description}`).join("\n")}`;
}).join("\n")}`;

export default function CustomCssGuide({ onClose }) {
  const [copied, setCopied] = useState("");
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());
  const toggleGroup = (title) => setExpandedGroups((current) => {
    const next = new Set(current);
    if (next.has(title)) next.delete(title);
    else next.add(title);
    return next;
  });
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
        .ccg-rules{margin:0 0 13px;padding:11px 12px;border-radius:13px;border:1px solid var(--mp-border,#ecdce3);background:var(--mp-surface,#fff)}
        .ccg-rules h3{margin:0 0 6px;font-size:11px;color:var(--mp-pink-dk,#de678d)}.ccg-rules ul{margin:0;padding-left:15px}.ccg-rules li{font-size:10px;line-height:1.7;color:var(--mp-txt-l,#789)}
        .ccg-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:15px}.ccg-action{padding:9px;border:0;border-radius:12px;background:linear-gradient(135deg,var(--mp-save-1,#ef7ba1),var(--mp-save-2,#e91e63));color:#fff;font-size:11px;font-weight:800}
        .ccg-group{margin:0 0 10px;padding:0 12px;border:1px solid var(--mp-border,#ecdce3);border-radius:16px;background:var(--mp-surface,#fff);overflow:hidden}.ccg-group-toggle{width:100%;display:flex;align-items:center;justify-content:space-between;padding:12px 0;border:0;background:transparent;color:var(--mp-pink-dk,#de678d);font:inherit;text-align:left}.ccg-group-toggle h3{margin:0;font-size:13px}.ccg-chevron{font-size:15px;line-height:1;transition:transform .18s ease}.ccg-chevron.open{transform:rotate(90deg)}.ccg-group-items{padding-bottom:4px}
        .ccg-note{margin:0 0 8px;padding:8px 10px;border-radius:10px;background:color-mix(in srgb,var(--mp-pink,#f5a8bd) 10%,transparent);font-size:9px;line-height:1.7;color:var(--mp-txt-l,#789)}
        .ccg-item{width:100%;display:flex;align-items:center;justify-content:space-between;gap:9px;padding:9px 4px;border:0;border-bottom:1px solid color-mix(in srgb,var(--mp-border,#ddd) 55%,transparent);background:transparent;color:inherit;text-align:left}.ccg-item:last-child{border-bottom:0}.ccg-item code{font-size:11px;font-weight:800;color:var(--mp-txt,#345)}.ccg-item span{font-size:9px;color:var(--mp-txt-l,#789);text-align:right}.ccg-toast{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);padding:8px 14px;border-radius:18px;background:#44383e;color:#fff;font-size:10px;box-shadow:0 8px 20px #0003}
      `}</style>
      <header className="ccg-head"><div><h2>自訂 CSS 選擇器</h2><div style={{fontSize:9,color:"var(--mp-txt-l)",marginTop:2}}>點擊項目即可複製 CSS 空白範本</div></div><button className="ccg-close" onClick={onClose}>✕</button></header>
      <div className="ccg-body">
        <p className="ccg-tip">這些選擇器可以交給 AI，或直接貼進自訂 CSS 編輯器。標有「結構說明」的分組請先讀過再改，那是實際的畫面結構。部分介面可能會隨版本更新而調整。為避免影響手機觸控與全螢幕顯示，請勿覆寫 .mp-phone 的 overflow、height 或 touch-action。</p>
        <div className="ccg-rules">
          <h3>寫之前先看這四點</h3>
          <ul>{RULES.map((rule) => <li key={rule}>{rule}</li>)}</ul>
        </div>
        <div className="ccg-actions"><button className="ccg-action" onClick={() => copy(ALL_CSS,"已複製完整清單")}>複製完整清單</button><button className="ccg-action" onClick={() => copy(AI_PROMPT,"已複製 AI 提示詞")}>複製 AI 提示詞</button></div>
        {GROUPS.map((group) => {
          const expanded = expandedGroups.has(group.title);
          return <section className="ccg-group" key={group.title}>
            <button className="ccg-group-toggle" type="button" aria-expanded={expanded} onClick={() => toggleGroup(group.title)}>
              <h3>{group.title}</h3><span className={`ccg-chevron ${expanded ? "open" : ""}`} aria-hidden="true">›</span>
            </button>
            {expanded && <div className="ccg-group-items">
              {group.note && <p className="ccg-note">{group.note}</p>}
              {group.items.map(([selector, description]) => <button className="ccg-item" key={selector} onClick={() => copy(`${selector} {\n  \n}`,`已複製 ${selector}`)}><code>{selector}</code><span>{description}</span></button>)}
            </div>}
          </section>;
        })}
      </div>
      {copied && <div className="ccg-toast">{copied}</div>}
    </div>
  );
}
