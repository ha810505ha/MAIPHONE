const THEME_PRESETS = {
  "莓果蘇打": {
    name: "莓果蘇打",
    vars: {
      "--mp-pink": "#f48fb1",
      "--mp-pink-lt": "#fce4ec",
      "--mp-pink-dk": "#e91e63",
      "--mp-blue": "#90caf9",
      "--mp-blue-lt": "#e1f5fe",
      "--mp-purple": "#ce93d8",
      "--mp-purple-lt": "#f3e5f5",
      "--mp-glass": "rgba(255,255,255,0.55)",
      "--mp-glass-b": "rgba(255,255,255,0.65)",
      "--mp-glass-s": "0 8px 32px rgba(244,143,177,0.15)",
      "--mp-txt": "#37474f",
      "--mp-txt-l": "#5f7683",
      "--mp-bubble": "#f48fb1",
      "--mp-bubble-2": "#f06292",
      "--mp-surface": "rgba(255,255,255,.92)",
      "--mp-rt-thought": "#5e2387",
      "--mp-rt-dialogue": "#5d4037",
      "--mp-rt-strong": "#ad3f68",
      "--mp-info": "#1565c0",
      "--mp-r": "20px",
      "--mp-rs": "12px",
      "--mp-rx": "8px",
      "--mp-font": "'Zen Maru Gothic','Quicksand',sans-serif",
      "--mp-fontd": "'Quicksand','Zen Maru Gothic',sans-serif",
    },
    surfaces: {
      wrapBg: "linear-gradient(135deg,#fce4ec 0%,#e8eaf6 50%,#e1f5fe 100%)",
      phoneBg: "linear-gradient(160deg,#fce4ec 0%,#f8bbd0 25%,#e1f5fe 50%,#b3e5fc 75%,#f3e5f5 100%)",
      lockBg: "linear-gradient(160deg,#fce4ec 0%,#f8bbd0 30%,#e8eaf6 60%,#b3e5fc 100%)",
      pageBg: "linear-gradient(180deg,#fce4ec 0%,#fff 30%)",
    },
  },
  "夜色絨幕": {
    name: "夜色絨幕",
    vars: {
      "--mp-pink": "#F48FB1",
      "--mp-pink-lt": "#3B263A",
      "--mp-pink-dk": "#EC6A95",
      "--mp-blue": "#A5C9E8",
      "--mp-blue-lt": "#26384D",
      "--mp-purple": "#C8A8E0",
      "--mp-purple-lt": "#352844",
      "--mp-glass": "rgba(36,27,51,0.86)",
      "--mp-glass-b": "rgba(122,96,151,0.34)",
      "--mp-glass-s": "0 8px 28px rgba(7,4,12,0.30)",
      "--mp-txt": "#F0E6F5",
      "--mp-txt-l": "#B8A8C9",
      "--mp-bubble": "#F48FB1",
      "--mp-bubble-2": "#EC6A95",
      "--mp-surface": "rgba(48,38,64,.94)",
      "--mp-rt-thought": "#C9A8E8",
      "--mp-rt-dialogue": "#D9C6BD",
      "--mp-rt-strong": "#F09CB8",
      "--mp-info": "#A5C9E8",
      "--mp-r": "20px",
      "--mp-rs": "12px",
      "--mp-rx": "8px",
      "--mp-font": "'Zen Maru Gothic','Quicksand',sans-serif",
      "--mp-fontd": "'Quicksand','Zen Maru Gothic',sans-serif",
    },
    surfaces: {
      wrapBg: "linear-gradient(135deg,#17131F 0%,#21182D 52%,#17131F 100%)",
      phoneBg: "linear-gradient(160deg,#241B33 0%,#1A1625 48%,#21182D 100%)",
      lockBg: "linear-gradient(160deg,#2B1E39 0%,#1A1625 58%,#202033 100%)",
      pageBg: "linear-gradient(180deg,#241B33 0%,#1A1625 34%,#181420 100%)",
    },
  },
  "抹茶檸檬": {
    name: "抹茶檸檬",
    vars: {
      "--mp-pink": "#7CB342",
      "--mp-pink-lt": "#F1F8E9",
      "--mp-pink-dk": "#C25E00",
      "--mp-blue": "#E6A817",
      "--mp-blue-lt": "#FFF8E1",
      "--mp-purple": "#FFAB91",
      "--mp-purple-lt": "#FBE9E7",
      "--mp-glass": "rgba(255,255,255,0.55)",
      "--mp-glass-b": "rgba(255,255,255,0.65)",
      "--mp-glass-s": "0 8px 32px rgba(139,195,74,0.16)",
      "--mp-txt": "#4A5A32",
      "--mp-txt-l": "#5c6b45",
      "--mp-bubble": "#9CCC65",
      "--mp-bubble-2": "#7CB342",
      "--mp-save-1": "#9CCC65",
      "--mp-save-2": "#7CB342",
      "--mp-surface": "rgba(255,255,255,.92)",
      "--mp-rt-thought": "#5e2387",
      "--mp-rt-dialogue": "#5d4037",
      "--mp-rt-strong": "#ad3f68",
      "--mp-info": "#1565c0",
      "--mp-r": "20px",
      "--mp-rs": "12px",
      "--mp-rx": "8px",
      "--mp-font": "'Zen Maru Gothic','Quicksand',sans-serif",
      "--mp-fontd": "'Quicksand','Zen Maru Gothic',sans-serif",
    },
    surfaces: {
      wrapBg: "linear-gradient(135deg,#f1f8e9 0%,#fff8e1 50%,#fdeee2 100%)",
      phoneBg: "linear-gradient(160deg,#f1f8e9 0%,#dcedc1 25%,#fff8e1 50%,#ffe9b3 75%,#fdeee2 100%)",
      lockBg: "linear-gradient(160deg,#f1f8e9 0%,#dcedc1 30%,#fef6e0 60%,#ffe3c2 100%)",
      pageBg: "linear-gradient(180deg,#f1f8e9 0%,#fff 30%)",
    },
  },
  "海鹽汽水": {
    name: "海鹽汽水",
    vars: {
      "--mp-pink": "#26A69A",
      "--mp-pink-lt": "#E0F2F1",
      "--mp-pink-dk": "#D6455B",
      "--mp-blue": "#4FC3F7",
      "--mp-blue-lt": "#E1F5FE",
      "--mp-purple": "#9FA8DA",
      "--mp-purple-lt": "#E8EAF6",
      "--mp-glass": "rgba(255,255,255,0.55)",
      "--mp-glass-b": "rgba(255,255,255,0.65)",
      "--mp-glass-s": "0 8px 32px rgba(77,182,172,0.18)",
      "--mp-txt": "#1F3A3D",
      "--mp-txt-l": "#456f74",
      "--mp-bubble": "#4DB6AC",
      "--mp-bubble-2": "#26A69A",
      "--mp-save-1": "#4DB6AC",
      "--mp-save-2": "#26A69A",
      "--mp-surface": "rgba(255,255,255,.92)",
      "--mp-rt-thought": "#5e2387",
      "--mp-rt-dialogue": "#5d4037",
      "--mp-rt-strong": "#ad3f68",
      "--mp-info": "#1565c0",
      "--mp-r": "20px",
      "--mp-rs": "12px",
      "--mp-rx": "8px",
      "--mp-font": "'Zen Maru Gothic','Quicksand',sans-serif",
      "--mp-fontd": "'Quicksand','Zen Maru Gothic',sans-serif",
    },
    surfaces: {
      wrapBg: "linear-gradient(135deg,#e0f7fa 0%,#e8eaf6 55%,#fbeaef 100%)",
      phoneBg: "linear-gradient(160deg,#e0f7fa 0%,#b2ebf2 25%,#e1f5fe 50%,#c5cae9 78%,#f6e3ea 100%)",
      lockBg: "linear-gradient(160deg,#e0f7fa 0%,#b2ebf2 30%,#e1f0fa 60%,#dfe2f3 100%)",
      pageBg: "linear-gradient(180deg,#e0f7fa 0%,#fff 30%)",
    },
  },
  "蜜桃慕斯": {
    name: "蜜桃慕斯",
    vars: {
      "--mp-pink": "#F4A9B0",
      "--mp-pink-lt": "#FBEFE0",
      "--mp-pink-dk": "#E07A8B",
      "--mp-blue": "#F6D8A8",
      "--mp-blue-lt": "#FCF3E2",
      "--mp-purple": "#E8B4A0",
      "--mp-purple-lt": "#F9E3D6",
      "--mp-glass": "rgba(255,252,248,0.72)",
      "--mp-glass-b": "rgba(255,252,248,0.55)",
      "--mp-glass-s": "0 8px 26px rgba(224,122,139,0.14)",
      "--mp-txt": "#6B5750",
      "--mp-txt-l": "#A48D84",
      "--mp-line": "rgba(164,141,132,0.18)",
      "--mp-bubble": "#F4A9B0",
      "--mp-bubble-2": "#E07A8B",
      "--mp-save-1": "#F4A9B0",
      "--mp-save-2": "#E07A8B",
      "--mp-surface": "rgba(255,252,248,.95)",
      "--mp-rt-thought": "#A0678A",
      "--mp-rt-dialogue": "#6B5750",
      "--mp-rt-strong": "#D06070",
      "--mp-info": "#C08A75",
      "--mp-r": "20px",
      "--mp-rs": "14px",
      "--mp-rx": "10px",
      "--mp-font": "'Zen Maru Gothic','Quicksand',sans-serif",
      "--mp-fontd": "'Quicksand','Zen Maru Gothic',sans-serif",
      "--mp-hand": "'Yomogi',cursive",
    },
    surfaces: {
      wrapBg: "linear-gradient(135deg,#FDF6EC 0%,#FBE9DE 55%,#F8DAD3 100%)",
      phoneBg: "linear-gradient(175deg,#FDF0E4 0%,#FBDDD6 45%,#F6C7C9 100%)",
      lockBg: "linear-gradient(165deg,#FDF0E4 0%,#FBDDD6 40%,#F4C4C6 100%)",
      pageBg: "linear-gradient(180deg,#FDF3E7 0%,#FBE6DC 60%,#F8DAD3 100%)",
    },
  },
};

﻿const css = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;600;700&family=Quicksand:wght@300;400;500;600;700&family=Yomogi&family=Zen+Maru+Gothic:wght@300;400;500;700&display=swap');
:root{--mp-pink:#f48fb1;--mp-pink-lt:#fce4ec;--mp-pink-dk:#e91e63;--mp-blue:#90caf9;--mp-blue-lt:#e1f5fe;--mp-purple:#ce93d8;--mp-purple-lt:#f3e5f5;--mp-glass:rgba(255,255,255,0.55);--mp-glass-b:rgba(255,255,255,0.65);--mp-glass-s:0 8px 32px color-mix(in srgb,var(--mp-pink) 15%,transparent);--mp-txt:#37474f;--mp-txt-l:#5f7683;--mp-line:rgba(148,163,184,.14);--mp-surface:rgba(255,255,255,.92);--mp-rt-thought:#5e2387;--mp-rt-dialogue:#5d4037;--mp-rt-strong:#ad3f68;--mp-info:#1565c0;--mp-bubble:#f48fb1;--mp-bubble-2:#f06292;--mp-r:20px;--mp-rs:12px;--mp-rx:8px;--mp-font:'Zen Maru Gothic','Quicksand',sans-serif;--mp-fontd:'Quicksand','Zen Maru Gothic',sans-serif;--mp-hand:var(--mp-font);}
*{margin:0;padding:0;box-sizing:border-box;}
html,body,#root{width:100%;height:100%;min-height:100%;overflow:hidden;overscroll-behavior:none;}
body{position:fixed;inset:0;}
@keyframes mpPetal{0%{transform:translateY(-30px) rotate(0);opacity:0}8%{opacity:.8}90%{opacity:.6}100%{transform:translateY(105vh) rotate(300deg);opacity:0}}
@keyframes mpBubbleRise{0%{transform:translateY(35px) translateX(0) scale(.7);opacity:0}8%{opacity:.68}30%{transform:translateY(-190px) translateX(34px) scale(.86)}58%{transform:translateY(-410px) translateX(-30px) scale(1)}86%{transform:translateY(-650px) translateX(26px) scale(1.12);opacity:.58}100%{transform:translateY(-780px) translateX(-12px) scale(1.2);opacity:0}}
@keyframes mpBubbleRiseAlt{0%{transform:translateY(45px) translateX(0) scale(.62);opacity:0}11%{opacity:.66}24%{transform:translateY(-145px) translateX(-28px) scale(.78)}49%{transform:translateY(-345px) translateX(38px) scale(.94)}73%{transform:translateY(-555px) translateX(-18px) scale(1.08)}91%{transform:translateY(-700px) translateX(31px) scale(1.16);opacity:.54}100%{transform:translateY(-790px) translateX(8px) scale(1.22);opacity:0}}
@keyframes mpStarTwinkle{0%,100%{opacity:.18;filter:brightness(.8)}45%{opacity:.82;filter:brightness(1.35)}70%{opacity:.35}}
@keyframes mpLeafFall{0%{transform:translateY(-40px) translateX(0) rotate(0);opacity:0}10%{opacity:.72}55%{transform:translateY(360px) translateX(20px) rotate(150deg)}100%{transform:translateY(780px) translateX(-10px) rotate(330deg);opacity:0}}
@keyframes mpWaterShimmer{0%{background-position:0 0,0 0;opacity:.2}50%{background-position:42px 16px,-34px 24px;opacity:.42}100%{background-position:84px 32px,-68px 48px;opacity:.2}}
@keyframes mpSaltCrystalDrift{0%{transform:translateX(-35px) translateY(0) rotate(0);opacity:0}12%{opacity:.65}35%{transform:translateX(125px) translateY(18px) rotate(105deg)}65%{transform:translateX(270px) translateY(-12px) rotate(220deg);opacity:.78}90%{opacity:.55}100%{transform:translateX(430px) translateY(8px) rotate(340deg);opacity:0}}
@keyframes mpSaltCrystalDriftAlt{0%{transform:translateX(35px) translateY(0) rotate(0);opacity:0}14%{opacity:.58}38%{transform:translateX(-105px) translateY(-16px) rotate(-100deg)}68%{transform:translateX(-250px) translateY(14px) rotate(-215deg);opacity:.72}100%{transform:translateX(-430px) translateY(-6px) rotate(-350deg);opacity:0}}
.mp-wrap{width:100%;height:100vh;height:100dvh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#fce4ec 0%,#e8eaf6 50%,#e1f5fe 100%);font-family:var(--mp-font);color:var(--mp-txt);user-select:none;overflow:hidden;overscroll-behavior:none;}
.mp-phone{width:380px;max-width:100vw;height:720px;max-height:100vh;max-height:100dvh;border-radius:32px;overflow:hidden;position:relative;background:linear-gradient(160deg,#fce4ec 0%,#f8bbd0 25%,#e1f5fe 50%,#b3e5fc 75%,#f3e5f5 100%);box-shadow:0 20px 60px rgba(0,0,0,.12),0 0 0 1px rgba(255,255,255,.6);}
@media(max-width:420px){.mp-phone{width:100vw;height:100vh;height:100dvh;border-radius:0;box-shadow:none;}}
@media(min-height:780px) and (min-width:420px){.mp-phone{height:780px;}}
.mp-bar{display:flex;justify-content:space-between;align-items:center;padding:10px 20px 6px;font-size:12px;font-weight:600;font-family:var(--mp-fontd);color:var(--mp-txt);position:relative;z-index:10;flex-shrink:0;}
.mp-bar-r{display:flex;align-items:center;gap:4px;font-size:11px;}
.mp-lock{position:absolute;inset:0;z-index:90;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(160deg,#fce4ec 0%,#f8bbd0 30%,#e8eaf6 60%,#b3e5fc 100%);cursor:pointer;transition:opacity .45s,transform .45s;}
.mp-lock.out{opacity:0;transform:scale(1.04);pointer-events:none;}
.mp-lock-fox{font-size:48px;margin-bottom:16px;animation:mpTail 3s ease-in-out infinite;}
@keyframes mpTail{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(5deg)}}
.mp-lock-time{font-family:var(--mp-fontd);font-size:68px;font-weight:300;letter-spacing:-2px;color:var(--mp-txt);text-shadow:0 2px 20px color-mix(in srgb,var(--mp-pink) 25%,transparent);}
.mp-lock-date{font-size:15px;font-weight:500;color:var(--mp-txt-l);margin-top:2px;letter-spacing:2px;}
.mp-lock-hint{position:absolute;bottom:60px;font-size:13px;color:var(--mp-txt-l);animation:mpFloat 2s ease-in-out infinite;}
.mp-lock-notifs{position:absolute;bottom:112px;left:20px;right:20px;display:flex;flex-direction:column;gap:8px;z-index:2;}
.mp-lock-notif{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border:1px solid var(--mp-glass-b);border-radius:16px;background:var(--mp-glass);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);box-shadow:0 8px 20px rgba(0,0,0,.08);cursor:pointer;text-align:left;transition:transform .14s ease;}
.mp-lock-notif:active{transform:scale(.97);}
.mp-lock-notif-avatar{width:34px;height:34px;border-radius:11px;flex-shrink:0;display:flex;align-items:center;justify-content:center;overflow:hidden;background:linear-gradient(135deg,var(--mp-pink-lt),var(--mp-blue-lt));font-size:15px;font-weight:800;color:var(--mp-txt);}
.mp-lock-notif-avatar img{width:100%;height:100%;object-fit:cover;}
.mp-lock-notif-body{flex:1;min-width:0;overflow:hidden;}
.mp-lock-notif-name{font-size:12px;font-weight:800;color:var(--mp-txt);line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.mp-lock-notif-preview{font-size:11px;color:var(--mp-txt-l);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
@keyframes mpFloat{0%,100%{transform:translateY(0);opacity:.5}50%{transform:translateY(-6px);opacity:1}}
.mp-desk{position:absolute;inset:0;display:flex;flex-direction:column;}
.mp-desk-scroll{flex:1;overflow-y:auto;padding:4px 20px 168px;-webkit-overflow-scrolling:touch;}
.mp-desk-scroll::-webkit-scrollbar{display:none;}
.mp-clock{margin-bottom:14px;}
.mp-clock-big{font-family:var(--mp-fontd);font-size:56px;font-weight:300;letter-spacing:-2px;line-height:1;color:var(--mp-txt);}
.mp-clock-meta{display:flex;align-items:baseline;gap:8px;margin-top:2px;}
.mp-clock-day{font-size:18px;font-weight:600;color:var(--mp-txt);font-family:var(--mp-fontd);}
.mp-clock-ds{font-size:13px;color:var(--mp-txt-l);font-weight:500;}
.mp-cw{background:var(--mp-glass);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid var(--mp-glass-b);border-radius:24px;padding:14px 16px;margin-bottom:16px;display:flex;align-items:center;gap:12px;box-shadow:var(--mp-glass-s);cursor:pointer;transition:transform .15s,box-shadow .2s;}
.mp-cw:hover{box-shadow:0 12px 30px rgba(0,0,0,.08);}
.mp-cw:active{transform:scale(.97);}
.mp-av{width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:26px;background:linear-gradient(135deg,var(--mp-pink-lt),var(--mp-purple-lt));box-shadow:0 2px 8px color-mix(in srgb,var(--mp-pink) 18%,transparent);flex-shrink:0;overflow:hidden;}
.mp-av img{width:100%;height:100%;object-fit:cover;}
.mp-cw-info{flex:1;min-width:0;}
.mp-cw-name{font-size:15px;font-weight:600;display:flex;align-items:center;gap:7px;}
.mp-active-badge{font-size:9px;font-weight:700;letter-spacing:.5px;padding:2px 7px;border-radius:8px;background:rgba(129,199,132,.2);color:#43a047;}
.mp-cw-desc{font-size:11px;color:var(--mp-txt-l);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.mp-home-mid{min-height:282px;display:flex;flex-direction:column;}
.mp-pages{overflow:hidden;}
.mp-pages-track{display:flex;transition:transform .28s ease;touch-action:pan-y;}
.mp-grid{min-width:100%;display:grid;grid-template-columns:repeat(4,1fr);gap:16px 8px;margin-top:2px;align-content:start;}
.mp-icon{display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;transition:transform .16s ease,filter .18s ease;touch-action:none;}
.mp-icon-empty{opacity:0;pointer-events:auto;}
.mp-icon:hover{filter:brightness(1.04);}
.mp-icon:active{transform:scale(.95);}
.mp-icon-c{width:56px;height:56px;border-radius:18px;display:flex;align-items:center;justify-content:center;font-size:24px;background:var(--mp-glass);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid var(--mp-glass-b);box-shadow:0 4px 14px rgba(0,0,0,.05);transition:box-shadow .2s;}
.mp-icon-c-img{overflow:hidden;}
.mp-app-icon-img{display:block;object-fit:contain;pointer-events:none;user-select:none;-webkit-user-select:none;-webkit-user-drag:none;-webkit-touch-callout:none;}
.mp-icon-c:hover{box-shadow:0 8px 18px color-mix(in srgb,var(--mp-pink) 18%,transparent);}
.mp-icon-l{font-size:11px;color:var(--mp-txt);font-weight:600;text-align:center;}
.mp-page-dots{position:absolute;left:0;right:0;bottom:98px;display:flex;align-items:center;justify-content:center;gap:7px;z-index:31;}
.mp-page-dot{width:7px;height:7px;border-radius:50%;background:color-mix(in srgb,var(--mp-txt) 30%,transparent);transition:all .2s ease;}
.mp-page-dot.active{width:18px;border-radius:10px;background:color-mix(in srgb,var(--mp-txt) 68%,transparent);}
.mp-grid-empty{grid-column:1 / -1;text-align:center;padding:28px 6px;font-size:12px;color:var(--mp-txt-l);background:rgba(255,255,255,.18);border-radius:14px;border:1px dashed rgba(255,255,255,.35);}
.mp-dock{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);width:calc(100% - 40px);max-width:328px;background:var(--mp-glass);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);border:1px solid var(--mp-glass-b);border-radius:28px;padding:12px 16px;display:flex;justify-content:space-between;gap:12px;box-shadow:0 12px 34px rgba(0,0,0,.08);z-index:30;}
.mp-dock-i{width:56px;height:56px;border-radius:18px;display:flex;align-items:center;justify-content:center;font-size:24px;cursor:pointer;background:var(--mp-glass);border:1px solid var(--mp-glass-b);transition:transform .14s ease,background .15s,box-shadow .18s;touch-action:none;}
.mp-dock-i .mp-app-icon-img{border-radius:18px;}
.mp-dock-i:active{transform:scale(.95);}
.mp-dock-i:hover{background:color-mix(in srgb,var(--mp-glass-b) 40%,var(--mp-glass));box-shadow:0 8px 16px rgba(255,255,255,.28);}
.mp-page{position:absolute;inset:0;z-index:40;display:flex;flex-direction:column;background:linear-gradient(180deg,#fce4ec 0%,#fff 30%);transform-origin:center center;animation:mpAppOpen .24s cubic-bezier(.2,.8,.2,1);}
@keyframes mpAppOpen{
  0%{transform:scale(.88);opacity:.35;filter:blur(1.5px)}
  70%{transform:scale(1.01);opacity:1;filter:blur(0)}
  100%{transform:scale(1);opacity:1;filter:blur(0)}
}
.mp-hdr{display:flex;align-items:center;gap:10px;padding:12px 16px 10px;background:var(--mp-glass);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border-bottom:1px solid var(--mp-glass-b);flex-shrink:0;z-index:5;}
.mp-back{width:32px;height:32px;border-radius:50%;min-width:32px;display:flex;align-items:center;justify-content:center;background:var(--mp-glass);border:1px solid var(--mp-glass-b);cursor:pointer;font-size:15px;transition:transform .12s;}
.mp-back:active{transform:scale(.84);}
.mp-htitle{font-size:16px;font-weight:700;font-family:var(--mp-fontd);}
.mp-chat-pin{width:24px;height:24px;min-width:24px;border:none;border-radius:50%;display:flex;align-items:center;justify-content:center;background:transparent;color:var(--mp-txt-l);font-size:16px;cursor:pointer;transition:transform .12s,color .16s;}
.mp-chat-pin:hover{box-shadow:none;background:transparent;}
.mp-chat-pin:active{transform:scale(.9);}
.mp-chat-pin.active{background:transparent;color:var(--mp-pink-dk);}
.mp-chat-switch{display:flex;gap:8px;align-items:center;margin:0 12px 6px;padding:5px;background:var(--mp-glass);border:1px solid color-mix(in srgb,var(--mp-pink) 12%,transparent);border-radius:16px;box-shadow:0 4px 14px color-mix(in srgb,var(--mp-pink) 5%,transparent);}
.mp-chat-switch-btn{position:relative;flex:1;border:none;background:transparent;color:var(--mp-txt-l);font-size:13px;font-weight:800;font-family:var(--mp-font);cursor:pointer;padding:8px 10px;border-radius:12px;transition:background .16s,color .16s,transform .16s,box-shadow .16s;}
.mp-chat-switch-btn.active{color:var(--mp-pink-dk);background:linear-gradient(135deg,color-mix(in srgb,var(--mp-pink) 30%,transparent),color-mix(in srgb,var(--mp-pink-lt) 90%,transparent));box-shadow:0 2px 8px color-mix(in srgb,var(--mp-pink) 12%,transparent);}
.mp-chat-switch-btn:active{transform:scale(.98);}
.mp-chat-list{display:grid;}
.mp-chat-list-line{padding:0 6px;}
.mp-chat-row{display:flex;align-items:center;gap:10px;width:100%;max-width:100%;padding:11px 8px;box-sizing:border-box;border:none;border-radius:0;background:transparent;border-bottom:1px solid rgba(148,163,184,.14);cursor:pointer;transition:background .12s ease;text-align:left;overflow:hidden;}
.mp-chat-row:hover{background:var(--mp-glass);}
.mp-chat-row:active{background:color-mix(in srgb,var(--mp-pink) 8%,transparent);}
.mp-chat-row.pinned{background:transparent;border-bottom-color:color-mix(in srgb,var(--mp-pink) 14%,transparent);}
.mp-chat-row.pinned:hover{background:var(--mp-glass);}
.mp-chat-row-avatar{position:relative;width:46px;height:46px;border-radius:14px;flex-shrink:0;display:flex;align-items:center;justify-content:center;overflow:hidden;background:linear-gradient(135deg,var(--mp-pink-lt),var(--mp-blue-lt));font-size:20px;font-weight:800;color:var(--mp-txt);}
.mp-chat-row-avatar img{width:100%;height:100%;object-fit:cover;}
.mp-chat-row-bottom{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0;}
.mp-chat-row-badge{flex-shrink:0;min-width:18px;height:18px;padding:0 5px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;line-height:1;color:#fff;background:#e53935;box-shadow:0 1px 4px rgba(229,57,53,.4);}
.mp-chat-row-body{flex:1;min-width:0;overflow:hidden;}
.mp-chat-row-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;min-width:0;overflow:hidden;}
.mp-chat-row-name{display:flex;align-items:center;gap:6px;font-size:15px;font-weight:800;color:var(--mp-txt);line-height:1.2;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.mp-chat-row.pinned .mp-chat-row-name{color:#b08a3a;}
.mp-chat-row-pin{color:#c09a46;font-size:12px;line-height:1;flex-shrink:0;text-shadow:0 0 10px rgba(208,167,74,.16);}
.mp-chat-row-time{font-size:10px;color:var(--mp-txt-l);white-space:nowrap;padding-top:2px;}
.mp-chat-row-preview{display:block;font-size:12px;color:var(--mp-txt);margin-top:4px;line-height:1.4;max-width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;}
.mp-chat-empty{min-height:420px;margin-top:2px;}
.mp-group-pick{appearance:none;-webkit-appearance:none;border:none;outline:none;position:relative;border-radius:14px;padding:0;overflow:hidden;background:transparent;cursor:pointer;transition:transform .14s ease,box-shadow .16s ease,opacity .16s ease;min-height:104px;box-shadow:none;}
.mp-group-pick::before,.mp-group-pick::after{display:none !important;}
.mp-group-pick:hover{transform:translateY(-1px);}
.mp-group-pick:active{transform:scale(.98);}
.mp-group-pick img{display:block;}
.mp-cl{flex:1;overflow-y:auto;padding:10px 14px 90px;}.mp-cl::-webkit-scrollbar{display:none;}
.mp-ci{display:flex;align-items:center;gap:10px;padding:12px 8px;border-bottom:1px solid rgba(148,163,184,.14);border-radius:0;margin-bottom:0;cursor:pointer;transition:background .12s,border-color .12s,transform .12s;}
.mp-ci:hover{background:color-mix(in srgb,var(--mp-pink) 5%,transparent);border-bottom-color:color-mix(in srgb,var(--mp-pink) 18%,transparent);}
.mp-ci:last-child{border-bottom:none;}
.mp-ci-av{box-shadow:0 2px 8px rgba(0,0,0,.08);}
.mp-ci-info{padding-right:6px;}
.mp-ci-av{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;background:linear-gradient(135deg,var(--mp-pink-lt),var(--mp-blue-lt));overflow:hidden;}
.mp-ci-av img{width:100%;height:100%;object-fit:cover;border-radius:12px;}
.mp-ci-info{flex:1;min-width:0;}.mp-ci-name{font-size:13px;font-weight:600;}
.mp-ci-prev{font-size:11px;color:var(--mp-txt-l);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px;}
.mp-ci-time{font-size:10px;color:var(--mp-txt-l);flex-shrink:0;}
  .mp-cr{flex:1;display:flex;flex-direction:column;min-height:0;position:relative;}
  .mp-msgs{flex:1;overflow-y:auto;padding:10px 14px;display:flex;flex-direction:column;gap:6px;}.mp-msgs::-webkit-scrollbar{display:none;}
  .mp-scroll-bottom{position:absolute;left:50%;z-index:12;width:42px;height:42px;padding:0;border:0;background:transparent;color:var(--mp-txt);display:flex;align-items:center;justify-content:center;cursor:pointer;transform:translateX(-50%);filter:drop-shadow(0 1px 2px rgba(255,255,255,.95)) drop-shadow(0 2px 4px rgba(31,50,71,.38));animation:mpScrollBottomIn .16s ease-out;}
  .mp-scroll-bottom:hover{color:var(--mp-pink-dk);}
  .mp-scroll-bottom:active{transform:translateX(-50%) translateY(2px);}
  @keyframes mpScrollBottomIn{from{opacity:0;transform:translateX(-50%) translateY(5px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
  @media (prefers-reduced-motion:reduce){.mp-scroll-bottom{animation:none;}}
.mp-msg-wrap{display:flex;align-items:flex-end;gap:6px;}
.mp-msg-wrap-ai{justify-content:flex-start;}
.mp-msg-wrap-user{justify-content:flex-end;}
.mp-group-msg-meta{display:flex;align-items:center;gap:6px;margin:2px 0 3px;}
.mp-group-msg-wrap-user .mp-group-msg-meta{justify-content:flex-end;}
.mp-group-msg-avatar{width:36px;height:36px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--mp-pink-lt),var(--mp-blue-lt));color:var(--mp-txt);font-size:15px;flex-shrink:0;}
.mp-group-msg-avatar img{width:100%;height:100%;object-fit:cover;}
.mp-group-msg-name{font-size:12px;font-weight:800;color:var(--mp-txt);line-height:1.2;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.mp-group-msg-wrap-user{flex-direction:column;align-items:flex-end;}
.mp-group-msg-wrap-ai{flex-direction:column;align-items:flex-start;}
.mp-msg-note-wrap{display:flex;justify-content:center;padding:4px 0;}
.mp-msg-note{max-width:92%;font-size:11px;line-height:1.5;color:var(--mp-txt-l);background:var(--mp-glass);border:1px dashed color-mix(in srgb,var(--mp-txt-l) 55%,transparent);padding:6px 10px;border-radius:10px;text-align:center;}
.mp-msg-note-wrap .mp-msg-editbtn{margin-left:8px;}
.mp-retry-btn{margin-top:7px;padding:4px 10px;border-radius:999px;border:1px solid color-mix(in srgb,var(--mp-pink) 24%,transparent);background:color-mix(in srgb,var(--mp-pink) 12%,transparent);color:var(--mp-pink-dk);font-size:11px;font-weight:800;font-family:var(--mp-font);cursor:pointer;}
.mp-retry-btn:disabled{opacity:.5;cursor:default;}
.mp-msg{max-width:78%;padding:9px 13px;border-radius:16px;font-size:13px;line-height:1.5;word-break:break-word;}
.mp-msg-ai{
  align-self:flex-start;
  background:var(--mp-surface);
  border:1px solid rgba(148,173,188,.42);
  border-bottom-left-radius:5px;
  box-shadow:0 2px 8px rgba(0,0,0,.06);
}
.mp-msg-user{align-self:flex-end;background:linear-gradient(135deg,var(--mp-bubble),var(--mp-bubble-2));color:#fff;border-bottom-right-radius:5px;}
.mp-msg-img{max-width:100%;border-radius:10px;margin-top:4px;}
  .mp-msg-t{font-size:9px;opacity:.45;margin-top:3px;}
  .mp-thought-stack{display:flex;flex-direction:column;align-items:flex-start;max-width:78%;min-width:0;}
  .mp-thought-stack-user{align-items:flex-end;}
  .mp-thought-stack>.mp-msg{max-width:100%;}
  .mp-reality-wrap .mp-thought-stack{max-width:min(92%,720px);width:100%;}
  .mp-thought{max-width:100%;margin:3px 0 0 7px;color:var(--mp-txt-l);}
  .mp-thought-bar{display:flex;align-items:center;gap:3px;min-height:22px;}
  .mp-thought-peek,.mp-thought-refresh{border:0;background:transparent;color:inherit;font-family:var(--mp-font);cursor:pointer;}
  .mp-thought-peek{display:flex;align-items:center;gap:5px;padding:2px 4px;font-size:10px;font-weight:700;}
  .mp-thought-peek>span:first-child{width:13px;height:13px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 13px;}
  .mp-thought-unseen-icon{display:inline-block;color:var(--mp-pink-dk);animation:mpThoughtPulse 1.15s ease-in-out infinite;transform-origin:center;}
  @keyframes mpThoughtPulse{0%,100%{opacity:.45;transform:scale(1)}50%{opacity:1;transform:scale(1.24);text-shadow:0 0 7px color-mix(in srgb,var(--mp-pink-dk) 55%,transparent)}}
  @media (prefers-reduced-motion:reduce){.mp-thought-unseen-icon{animation:none;opacity:1;text-shadow:0 0 5px color-mix(in srgb,var(--mp-pink-dk) 38%,transparent)}}
  .mp-thought-peek:hover,.mp-thought-refresh:hover{color:var(--mp-pink-dk);}
  .mp-thought-peek:disabled,.mp-thought-refresh:disabled{opacity:.55;cursor:default;}
  .mp-thought-refresh{width:22px;height:22px;padding:0;display:inline-flex;align-items:center;justify-content:center;}
  .mp-thought-content{margin:2px 0 3px 4px;padding:7px 10px;border-left:2px solid color-mix(in srgb,var(--mp-pink-dk) 29%,transparent);background:var(--mp-glass);border-radius:0 6px 6px 0;font-size:11px;font-style:italic;line-height:1.55;color:var(--mp-txt);white-space:pre-wrap;word-break:break-word;animation:mpFi .16s;}
  .mp-switch{width:40px;height:23px;padding:2px;border:0;border-radius:12px;background:#c8cdd1;cursor:pointer;flex:0 0 auto;transition:background .18s;}
  .mp-switch span{display:block;width:19px;height:19px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.18);transition:transform .18s;}
  .mp-switch.active{background:var(--mp-pink-dk);}
  .mp-switch.active span{transform:translateX(17px);}
  .mp-thought-history-divider{height:1px;background:rgba(148,173,188,.2);margin:12px 0 8px;}
  .mp-thought-history-toggle{width:100%;padding:3px 0;border:0;background:transparent;color:var(--mp-txt);font-family:var(--mp-font);font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer;}
  .mp-thought-history-toggle span:last-child{font-size:10px;font-weight:600;color:var(--mp-txt-l);}
  .mp-thought-history{margin-top:7px;border-top:1px solid rgba(148,173,188,.14);}
  .mp-thought-record{width:100%;padding:9px 2px;border:0;border-bottom:1px solid rgba(148,173,188,.14);background:transparent;color:var(--mp-txt);font-family:var(--mp-font);text-align:left;cursor:pointer;}
  .mp-thought-record:hover{background:rgba(128,128,128,.1);}
  .mp-thought-record-meta{display:flex;align-items:center;gap:5px;font-size:9px;color:var(--mp-txt-l);}
  .mp-thought-record-content{margin-top:4px;font-size:11px;line-height:1.55;white-space:pre-wrap;word-break:break-word;}
  .mp-thought-record-preview{margin-top:4px;font-size:9px;line-height:1.4;color:var(--mp-txt-l);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .mp-thought-history-empty{padding:14px 0 7px;text-align:center;font-size:10px;color:var(--mp-txt-l);}
  .mp-thought-history-pages{display:flex;align-items:center;justify-content:center;gap:10px;padding-top:8px;font-size:10px;color:var(--mp-txt-l);}
  .mp-thought-history-pages button{width:26px;height:24px;padding:0;border:1px solid rgba(148,173,188,.3);border-radius:6px;background:var(--mp-glass);color:var(--mp-txt);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;}
  .mp-thought-history-pages button:disabled{opacity:.35;cursor:default;}
  .mp-thought-jump-highlight{animation:mpThoughtJump 1.8s ease-out;}
  @keyframes mpThoughtJump{0%,35%{filter:drop-shadow(0 0 7px color-mix(in srgb,var(--mp-pink-dk) 70%,transparent));transform:translateX(0)}100%{filter:drop-shadow(0 0 0 rgba(224,111,158,0));transform:translateX(0)}}
  @media (prefers-reduced-motion:reduce){.mp-thought-jump-highlight{animation:none;filter:drop-shadow(0 0 5px color-mix(in srgb,var(--mp-pink-dk) 50%,transparent));}}
.mp-msg-editbtn{width:24px;height:24px;border-radius:50%;border:1px solid color-mix(in srgb,var(--mp-pink) 36%,transparent);background:var(--mp-surface);color:var(--mp-txt);font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.mp-msg-editbtn-hidden{visibility:hidden;}
.mp-voice-action{width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;border:0;background:transparent;color:var(--mp-txt-l);cursor:pointer;padding:0;border-radius:50%;flex-shrink:0;}
.mp-voice-action:hover{color:var(--mp-pink-dk);background:color-mix(in srgb,var(--mp-pink) 10%,transparent);}
.mp-voice-action:disabled{cursor:wait;opacity:.65;}
.mp-voice-action-hidden{visibility:hidden;}
.mp-voice-action-collapsed{display:none;}
.mp-voice-action-playing{color:var(--mp-pink-dk);}
.mp-voice-spinner{animation:mpVoiceSpin .8s linear infinite;}
@keyframes mpVoiceSpin{to{transform:rotate(360deg)}}
.mp-msg-wrap-transfer{justify-content:center;width:100%;}
.mp-transfer-card{
  position:relative;
  min-width:240px;
  max-width:82%;
  padding:16px 18px 14px;
  border-radius:22px;
  background:var(--mp-surface);
  backdrop-filter:blur(18px);
  -webkit-backdrop-filter:blur(18px);
  border:1.5px solid rgba(142,163,179,.35);
  box-shadow:0 1px 2px rgba(16,24,40,.04),0 12px 32px -8px rgba(132,144,166,.14),inset 0 1px 0 rgba(255,255,255,.72);
  overflow:hidden;
}
.mp-transfer-card::after{
  content:'';
  position:absolute;
  top:-42px;
  right:-42px;
  width:140px;
  height:140px;
  background:radial-gradient(circle,rgba(142,163,179,.10),transparent 70%);
  pointer-events:none;
}
.mp-transfer-success{display:flex;flex-direction:column;align-items:center;gap:8px;margin:0 0 14px;position:relative;z-index:1;}
.mp-transfer-check{width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:900;color:#4caf50;background:rgba(76,175,80,.08);border:1px solid rgba(76,175,80,.16);box-shadow:inset 0 1px 0 rgba(255,255,255,.8);}
.mp-transfer-success-text{font-size:17px;font-weight:800;color:var(--mp-txt);letter-spacing:.4px;}
.mp-transfer-line{font-size:14px;font-weight:800;color:var(--mp-txt);margin-bottom:8px;position:relative;z-index:1;}
.mp-transfer-meta{display:block;margin-bottom:10px;position:relative;z-index:1;}
.mp-transfer-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 0;border-top:1px solid rgba(160,176,186,.14);}
.mp-transfer-row:last-child{border-bottom:1px solid rgba(160,176,186,.14);}
.mp-transfer-k{font-size:12px;font-weight:700;color:var(--mp-txt-l);flex-shrink:0;}
.mp-transfer-v{font-size:12px;font-weight:800;color:var(--mp-txt);text-align:right;word-break:break-word;}
.mp-transfer-note{font-size:12px;line-height:1.5;color:var(--mp-txt-l);padding:8px 10px;background:var(--mp-glass);border:1px solid rgba(160,176,186,.14);border-radius:10px;position:relative;z-index:1;}
.mp-transfer-footer{display:flex;align-items:center;justify-content:space-between;font-size:11px;color:var(--mp-txt-l);margin-top:10px;position:relative;z-index:1;}
.mp-transfer-status{display:inline-flex;align-items:center;gap:4px;color:#2e7d32;font-weight:600;}
.mp-transfer-status::before{content:'✓';font-size:10px;}
.mp-mode-tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:3px;background:rgba(255,255,255,.55);border:1px solid color-mix(in srgb,var(--mp-pink) 28%,transparent);border-radius:12px;}
.mp-mode-tab{border:none;border-radius:9px;padding:8px 6px;background:transparent;color:var(--mp-txt-l);font-size:12px;font-weight:700;font-family:var(--mp-font);cursor:pointer;transition:background .14s,color .14s,box-shadow .14s;}
.mp-mode-tab.active{background:var(--mp-surface);color:var(--mp-pink-dk);box-shadow:0 2px 8px color-mix(in srgb,var(--mp-pink-dk) 12%,transparent);}
.mp-mode-hint{margin-top:7px;font-size:11px;line-height:1.5;color:var(--mp-txt-l);}
.mp-mode-sep{display:flex;align-items:center;gap:10px;margin:9px 0 7px;color:var(--mp-txt-l);font-size:11px;font-weight:800;letter-spacing:.5px;}
.mp-mode-sep::before,.mp-mode-sep::after{content:'';height:1px;flex:1;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--mp-txt-l) 40%,transparent));}
.mp-mode-sep::after{background:linear-gradient(90deg,color-mix(in srgb,var(--mp-txt-l) 40%,transparent),transparent);}
.mp-mode-sep span{padding:3px 10px;border-radius:999px;background:var(--mp-glass);border:1px solid color-mix(in srgb,var(--mp-txt-l) 22%,transparent);}
.mp-reality-wrap{display:flex;align-items:flex-start;gap:6px;width:100%;padding:2px 0;}
.mp-reality-footer{display:flex;align-items:center;justify-content:flex-end;gap:6px;min-height:26px;margin-top:2px;}
.mp-reality-footer .mp-reality-t{margin:0;}
.mp-reality-user{justify-content:flex-end;}
.mp-reality-ai{justify-content:flex-start;padding-left:10px;padding-right:10px;}
.mp-reality-msg{width:100%;max-width:100%;padding:8px 2px 10px;font-size:14px;line-height:1.9;color:var(--mp-txt);word-break:break-word;white-space:normal;}
.mp-reality-ai .mp-reality-msg{font-family:'Noto Serif TC','PMingLiU','Songti TC',serif;text-align:justify;text-justify:inter-ideograph;background:transparent;border-color:transparent;box-shadow:none;}
.mp-reality-user .mp-reality-msg{
  padding:10px 12px;
  background:rgba(255,229,241,.16);
  border:0;
  border-radius:16px;
  color:var(--mp-txt);
  box-shadow:none;
  backdrop-filter:blur(18px) saturate(135%);
  -webkit-backdrop-filter:blur(18px) saturate(135%);
  overflow:hidden;
  position:relative;
}
.mp-reality-p{margin:0 0 12px;}
.mp-reality-p:last-child{margin-bottom:0;}
.mp-reality-thought{color:var(--mp-rt-thought);font-family:'Noto Serif TC','PMingLiU','Songti TC',serif;font-style:italic;font-weight:600;}
.mp-reality-dialogue{color:var(--mp-rt-dialogue);font-family:var(--mp-font);font-weight:400;}
.mp-reality-strong{color:var(--mp-rt-strong);font-family:var(--mp-font);font-weight:800;}
.mp-reality-t{font-size:9px;color:var(--mp-txt-l);opacity:.65;margin-top:5px;text-align:right;}
.mp-typing{display:flex;gap:3px;padding:6px 12px;align-self:flex-start;}
.mp-typing span{width:5px;height:5px;border-radius:50%;background:var(--mp-pink);animation:mpDot 1.4s infinite;}
.mp-typing span:nth-child(2){animation-delay:.2s}.mp-typing span:nth-child(3){animation-delay:.4s}
@keyframes mpDot{0%,60%,100%{transform:translateY(0);opacity:.35}30%{transform:translateY(-7px);opacity:1}}
.mp-inp-bar{display:flex;align-items:center;gap:6px;padding:10px 12px 14px;flex-shrink:0;background:var(--mp-glass);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-top:1px solid color-mix(in srgb,var(--mp-pink) 27%,transparent);box-shadow:0 -6px 18px rgba(0,0,0,.06);}
.mp-chat-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:12px 14px;background:var(--mp-glass);border-top:1px solid color-mix(in srgb,var(--mp-pink) 22%,transparent);}
.mp-chat-action{min-width:0;display:flex;flex-direction:column;align-items:center;gap:5px;border:none;background:transparent;color:var(--mp-txt);font-family:var(--mp-font);font-size:11px;font-weight:700;cursor:pointer;}
.mp-chat-action:disabled{opacity:.35;cursor:default;}
.mp-chat-action-i{width:44px;height:44px;border-radius:14px;display:flex;align-items:center;justify-content:center;background:var(--mp-surface);border:1px solid color-mix(in srgb,var(--mp-pink) 32%,transparent);box-shadow:0 2px 8px rgba(0,0,0,.04);font-size:20px;}
.mp-inp-wrap{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;}
.mp-inp{width:100%;border:1px solid color-mix(in srgb,var(--mp-pink) 36%,transparent);outline:none;background:var(--mp-surface);border-radius:18px;padding:10px 14px;font-size:13px;font-family:var(--mp-font);color:var(--mp-txt);resize:none;line-height:1.35;min-height:38px;max-height:86px;}
.mp-inp::placeholder{color:var(--mp-txt-l);}
.mp-char-counter{font-size:10px;line-height:1;color:var(--mp-txt-l);text-align:right;padding-right:7px;font-family:var(--mp-fontd);}
.mp-char-counter-modal{margin-top:4px;padding-right:2px;}
.mp-update-list{display:grid;gap:7px;margin-top:10px;}
.mp-update-item{position:relative;padding:7px 9px 7px 22px;border-radius:10px;background:var(--mp-glass);border:1px solid color-mix(in srgb,var(--mp-pink) 12%,transparent);font-size:12px;line-height:1.55;color:var(--mp-txt);}
.mp-update-item::before{content:'';position:absolute;left:10px;top:15px;width:5px;height:5px;border-radius:50%;background:var(--mp-pink);}
.mp-version-row{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;font-weight:800;color:var(--mp-txt);cursor:pointer;}
.mp-version-row span:last-child{font-size:11px;color:var(--mp-pink-dk);}
.mp-version-list{margin:9px 0 0 18px;font-size:12px;line-height:1.7;color:var(--mp-txt-l);}
.mp-version-list li{padding-left:2px;margin-bottom:3px;}
.mp-btn{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:none;cursor:pointer;font-size:16px;transition:transform .12s;flex-shrink:0;}
.mp-btn:active{transform:scale(.84);}
.mp-btn-send{background:linear-gradient(135deg,var(--mp-save-1,var(--mp-pink)),var(--mp-save-2,var(--mp-pink-dk)));color:#fff;}
.mp-btn-img{background:rgba(255,255,255,.92);color:var(--mp-txt);border:1px solid color-mix(in srgb,var(--mp-pink) 36%,transparent);}
.mp-btn-img.active{background:var(--mp-pink-lt);color:var(--mp-pink-dk);transform:rotate(45deg);}
.mp-imgprev{display:flex;align-items:center;gap:6px;padding:6px 14px;background:rgba(255,255,255,.45);border-top:1px solid rgba(255,255,255,.4);flex-shrink:0;}
.mp-imgprev img{width:44px;height:44px;border-radius:7px;object-fit:cover;border:2px solid var(--mp-pink);}
.mp-imgprev button{width:18px;height:18px;border-radius:50%;background:rgba(0,0,0,.35);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;cursor:pointer;border:none;}
.mp-feed{flex:1;overflow-y:auto;padding:10px 14px 90px;position:relative;}.mp-feed::-webkit-scrollbar{display:none;}
.mp-post{background:var(--mp-glass);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid var(--mp-glass-b);border-radius:var(--mp-r);padding:14px;margin-bottom:10px;box-shadow:var(--mp-glass-s);}
.mp-post-hd{display:flex;align-items:center;gap:8px;margin-bottom:8px;position:relative;}
.mp-post-menu-btn{margin-left:auto;align-self:flex-start;border:none;background:transparent;color:var(--mp-txt-l);font-size:16px;font-weight:800;line-height:1;padding:2px 6px;border-radius:8px;cursor:pointer;}
.mp-post-menu-btn:hover{background:rgba(128,128,128,.12);color:var(--mp-txt);}
.mp-post-menu{position:absolute;top:24px;right:0;z-index:30;min-width:120px;background:var(--mp-surface);border:1px solid rgba(128,128,128,.22);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.14);overflow:hidden;}
.mp-post-menu-item{display:block;width:100%;padding:9px 14px;border:none;background:transparent;text-align:left;font-size:12px;font-weight:600;font-family:var(--mp-font);color:var(--mp-txt);cursor:pointer;}
.mp-post-menu-item:hover{background:rgba(128,128,128,.1);}
.mp-post-menu-item.danger{color:#e53935;}
.mp-post-av{width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;background:linear-gradient(135deg,var(--mp-pink-lt),var(--mp-purple-lt));flex-shrink:0;overflow:hidden;}
.mp-post-av.player{background:linear-gradient(135deg,#fff3e0,#dcedc8);}
.mp-post-av img{width:100%;height:100%;object-fit:cover;}
.mp-post-au{font-size:13px;font-weight:800;color:var(--mp-txt);}.mp-post-tm{font-size:10px;color:var(--mp-txt-l);}
.mp-post-ct{font-size:13px;line-height:1.55;margin-bottom:8px;white-space:pre-wrap;word-break:break-word;color:color-mix(in srgb,var(--mp-txt) 80%,var(--mp-txt-l));}
.mp-post-ct.clamped{display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden;}
.mp-post-more{display:inline-flex;margin:-2px 0 8px;padding:0;border:none;background:transparent;color:var(--mp-pink-dk);font-size:12px;font-weight:800;font-family:var(--mp-font);cursor:pointer;}
.mp-post-acts{display:flex;gap:10px;align-items:center;}
.mp-post-act{display:flex;align-items:center;gap:3px;font-size:12px;color:var(--mp-txt-l);cursor:pointer;background:none;border:none;font-family:var(--mp-font);transition:color .12s;}
.mp-post-act:hover{color:var(--mp-pink);}.mp-post-act.liked{color:var(--mp-pink-dk);}
.mp-post-like-count{margin-left:-9px;padding-left:0;color:var(--mp-txt-l);font-weight:700;}
.mp-liked-by{margin-top:6px;font-size:11px;line-height:1.45;color:var(--mp-txt-l);background:rgba(128,128,128,.1);border-radius:9px;padding:6px 8px;white-space:pre-wrap;word-break:break-word;}
.mp-social-head-actions{margin-left:auto;display:flex;align-items:center;gap:6px;}
.mp-pill-btn{background:linear-gradient(135deg,var(--mp-save-1,var(--mp-pink)),var(--mp-save-2,var(--mp-pink-dk)));color:#fff;border:none;border-radius:16px;padding:5px 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:var(--mp-font);box-shadow:0 5px 12px color-mix(in srgb,var(--mp-save-2,var(--mp-pink-dk)) 18%,transparent);white-space:nowrap;}
.mp-pill-btn-ghost{background:var(--mp-glass);color:var(--mp-pink-dk);border:1px solid color-mix(in srgb,var(--mp-pink) 24%,transparent);box-shadow:none;}
.mp-comments{margin-top:8px;display:grid;gap:6px;}
.mp-comments.scroll{max-height:260px;overflow-y:auto;padding-right:4px;}
.mp-comments.scroll::-webkit-scrollbar{width:4px;}
.mp-comments.scroll::-webkit-scrollbar-thumb{background:color-mix(in srgb,var(--mp-pink) 35%,transparent);border-radius:999px;}
.mp-comment{font-size:11px;line-height:1.45;color:var(--mp-txt-l);background:rgba(128,128,128,.12);border-radius:9px;padding:5px 7px;white-space:pre-wrap;word-break:break-word;}
.mp-comment.clickable{cursor:pointer;}
.mp-comment.clickable:hover{background:rgba(128,128,128,.16);}
.mp-comment.reply{margin-left:16px;border-left:2px solid color-mix(in srgb,var(--mp-pink) 25%,transparent);border-top-left-radius:4px;border-bottom-left-radius:4px;}
.mp-comment.empty{color:var(--mp-txt-l);font-style:italic;background:rgba(128,128,128,.08);}
.mp-comment span{font-weight:700;color:var(--mp-txt);}
.mp-comment em{font-style:normal;color:var(--mp-txt-l);font-size:10px;}
.mp-comment-input{display:flex;gap:6px;align-items:center;}
.mp-comment-inline-input{margin-top:6px;}
.mp-comment-input .mp-sinp{flex:1;padding:6px 8px;font-size:11px;}
.mp-cm{flex:1;overflow-y:auto;padding:10px 14px 90px;}.mp-cm::-webkit-scrollbar{display:none;}
.mp-cc{background:var(--mp-glass);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid var(--mp-glass-b);border-radius:var(--mp-r);padding:14px;margin-bottom:10px;box-shadow:var(--mp-glass-s);}
.mp-add{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;padding:12px;background:color-mix(in srgb,var(--mp-pink) 8%,transparent);border:2px dashed color-mix(in srgb,var(--mp-pink) 25%,transparent);border-radius:var(--mp-r);color:var(--mp-pink);font-size:13px;font-weight:600;cursor:pointer;font-family:var(--mp-font);transition:background .12s;}
.mp-add:hover{background:color-mix(in srgb,var(--mp-pink) 13%,transparent);}
.mp-sc{position:relative;background:var(--mp-glass);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border:1px solid var(--mp-glass-b);border-radius:var(--mp-r);overflow:hidden;margin-bottom:10px;box-shadow:var(--mp-glass-s);}
.mp-sc-ban{height:80px;background:linear-gradient(135deg,var(--mp-pink-lt),var(--mp-blue-lt),var(--mp-purple-lt));position:relative;}
.mp-sc-avl{width:56px;height:56px;border-radius:18px;display:flex;align-items:center;justify-content:center;font-size:28px;background:var(--mp-surface);border:3px solid var(--mp-glass-b);box-shadow:0 3px 10px rgba(0,0,0,.08);position:relative;margin:-28px 0 0 16px;overflow:hidden;z-index:1;}
.mp-sc-avl img{width:100%;height:100%;object-fit:cover;}
.mp-sc-body{padding:10px 14px 14px;}
.mp-sc-nm{font-size:16px;font-weight:700;}
.mp-sc-desc{font-size:12px;color:var(--mp-txt-l);margin-top:3px;line-height:1.5;}
.mp-sc-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px;}
.mp-tag{font-size:10px;padding:2px 8px;border-radius:10px;background:color-mix(in srgb,var(--mp-pink) 10%,transparent);color:var(--mp-pink-dk);font-weight:500;}
.mp-sc-stats{display:flex;gap:14px;margin-top:10px;flex-wrap:wrap;}
.mp-stat{text-align:center;min-width:48px;}
.mp-stat-v{font-size:16px;font-weight:700;color:var(--mp-pink-dk);}
.mp-stat-lb{font-size:10px;color:var(--mp-txt-l);margin-top:1px;}
.mp-sec{margin-top:12px;padding:10px 12px;background:color-mix(in srgb,var(--mp-pink) 5%,transparent);border-radius:var(--mp-rs);border:1px solid color-mix(in srgb,var(--mp-pink) 10%,transparent);}
.mp-sec-t{font-size:11px;font-weight:700;color:var(--mp-pink);margin-bottom:6px;display:flex;align-items:center;gap:4px;}
.mp-sec-t-toggle{justify-content:space-between;gap:8px;cursor:pointer;}
.mp-sec-toggle-tag{font-size:10px;font-weight:700;color:var(--mp-pink-dk);padding:2px 8px;border-radius:999px;background:color-mix(in srgb,var(--mp-pink) 12%,transparent);border:1px solid color-mix(in srgb,var(--mp-pink) 20%,transparent);}
.mp-sec-ct{font-size:12px;line-height:1.6;color:var(--mp-txt);}
.mp-sec-row{display:flex;justify-content:space-between;margin-bottom:3px;font-size:12px;}
.mp-sec-row span:last-child{font-weight:600;}
.mp-mem{padding:8px 0;border-bottom:1px solid color-mix(in srgb,var(--mp-pink) 8%,transparent);font-size:12px;line-height:1.5;}
.mp-mem:last-child{border-bottom:none;}
.mp-mem-d{font-size:10px;color:var(--mp-txt-l);margin-top:2px;}
.mp-gbtn{display:inline-flex;align-items:center;gap:4px;margin-top:6px;padding:5px 12px;background:linear-gradient(135deg,var(--mp-save-1,var(--mp-pink)),var(--mp-save-2,var(--mp-pink-dk)));color:#fff;border:none;border-radius:14px;font-size:11px;font-weight:600;cursor:pointer;font-family:var(--mp-font);transition:transform .12s;}
.mp-gbtn:active{transform:scale(.94);}.mp-gbtn:disabled{opacity:.5;cursor:default;}
.mp-tl{position:relative;padding-left:16px;}
.mp-tl::before{content:'';position:absolute;left:4px;top:4px;bottom:4px;width:2px;background:color-mix(in srgb,var(--mp-pink) 20%,transparent);border-radius:1px;}
.mp-tl-dot{position:absolute;left:0;width:10px;height:10px;border-radius:50%;background:var(--mp-pink);border:2px solid var(--mp-surface);}
.mp-tl-item{position:relative;padding:4px 0 10px 8px;}
.mp-persona{font-size:12px;line-height:1.6;color:var(--mp-txt);white-space:pre-wrap;max-height:120px;overflow-y:auto;}
.mp-persona::-webkit-scrollbar{display:none;}
.mp-set{flex:1;overflow-y:auto;padding:10px 14px 90px;}.mp-set::-webkit-scrollbar{display:none;}
.mp-sg{background:var(--mp-glass);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid var(--mp-glass-b);border-radius:var(--mp-r);padding:14px;margin-bottom:10px;}
.mp-sg-t{font-size:12px;font-weight:700;color:var(--mp-pink);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;}
.mp-row{margin-bottom:8px;}
.mp-lbl{font-size:11px;font-weight:600;color:var(--mp-txt-l);margin-bottom:3px;}
.mp-sinp{width:100%;padding:7px 10px;border:1px solid color-mix(in srgb,var(--mp-pink) 18%,transparent);border-radius:var(--mp-rx);font-size:12px;font-family:var(--mp-font);background:var(--mp-glass);color:var(--mp-txt);outline:none;}
.mp-sinp:focus{border-color:var(--mp-pink);}
.mp-ssel{width:100%;padding:7px 10px;border:1px solid color-mix(in srgb,var(--mp-pink) 18%,transparent);border-radius:var(--mp-rx);font-size:12px;font-family:var(--mp-font);background:var(--mp-glass);color:var(--mp-txt);outline:none;cursor:pointer;}
.mp-save{width:100%;padding:10px;background:linear-gradient(135deg,var(--mp-save-1,var(--mp-pink)),var(--mp-save-2,var(--mp-pink-dk)));color:#fff;border:none;border-radius:var(--mp-rs);font-size:13px;font-weight:600;font-family:var(--mp-font);cursor:pointer;transition:transform .12s;}
.mp-save:active{transform:scale(.97);}
.mp-hero-setting-preview{position:relative;width:100%;height:155px;overflow:hidden;border-radius:18px;background:repeating-linear-gradient(45deg,rgba(255,255,255,.45) 0 12px,color-mix(in srgb,var(--mp-pink) 12%,transparent) 12px 24px);border:1px solid color-mix(in srgb,var(--mp-pink) 28%,transparent);touch-action:none;cursor:grab;}
.mp-hero-setting-preview:active{cursor:grabbing;}
.mp-hero-setting-preview img{position:absolute;inset:0;z-index:1;width:100%;height:100%;object-fit:cover;object-position:center;transform-origin:center;pointer-events:none;user-select:none;-webkit-user-drag:none;}
.mp-hero-setting-preview img.mp-hero-blur-bg{z-index:0;object-fit:cover;transform:scale(1.12);filter:blur(16px) saturate(1.08) brightness(1.02);opacity:.85;}
.mp-hero-setting-preview span{position:absolute;left:50%;bottom:8px;z-index:2;transform:translateX(-50%);padding:4px 8px;border-radius:999px;background:rgba(255,255,255,.84);color:var(--mp-txt-l);font-size:9px;white-space:nowrap;pointer-events:none;}
.mp-overlay{position:absolute;inset:0;z-index:70;background:rgba(0,0,0,.28);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;animation:mpFi .18s;}
@keyframes mpFi{from{opacity:0}to{opacity:1}}
.mp-modal{width:88%;max-height:75%;background:var(--mp-surface);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border-radius:var(--mp-r);padding:18px;overflow-y:auto;box-shadow:0 16px 50px rgba(0,0,0,.13);}
.mp-modal::-webkit-scrollbar{display:none;}
.mp-modal-t{font-size:16px;font-weight:700;margin-bottom:14px;font-family:var(--mp-fontd);}
.mp-ta{width:100%;min-height:70px;padding:7px 10px;border:1px solid color-mix(in srgb,var(--mp-pink) 18%,transparent);border-radius:var(--mp-rx);font-size:12px;font-family:var(--mp-font);background:var(--mp-glass);color:var(--mp-txt);outline:none;resize:vertical;}
.mp-ta:focus{border-color:var(--mp-pink);}
.mp-tabs{display:flex;gap:4px;margin-bottom:12px;}
.mp-tab{flex:1;padding:8px;text-align:center;font-size:12px;font-weight:600;border-radius:10px;cursor:pointer;transition:background .12s;border:1px solid color-mix(in srgb,var(--mp-pink) 15%,transparent);background:rgba(128,128,128,.1);font-family:var(--mp-font);color:var(--mp-txt);}
.mp-tab.active{background:linear-gradient(135deg,var(--mp-save-1,var(--mp-pink)),var(--mp-save-2,var(--mp-pink-dk)));color:#fff;border-color:transparent;}
.mp-drop{width:100%;padding:24px 16px;border:2px dashed color-mix(in srgb,var(--mp-pink) 30%,transparent);border-radius:var(--mp-r);text-align:center;cursor:pointer;transition:background .12s;background:color-mix(in srgb,var(--mp-pink) 4%,transparent);margin-bottom:10px;}
.mp-drop:hover{background:color-mix(in srgb,var(--mp-pink) 8%,transparent);}
.mp-drop-icon{font-size:32px;margin-bottom:6px;}
.mp-drop-text{font-size:12px;color:var(--mp-txt-l);}
.mp-toast{position:absolute;top:50px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.72);color:#fff;padding:7px 18px;border-radius:18px;font-size:12px;font-weight:500;z-index:200;animation:mpToast 2s ease-in-out forwards;}
@keyframes mpToast{0%{opacity:0;transform:translateX(-50%) translateY(-8px)}15%{opacity:1;transform:translateX(-50%) translateY(0)}85%{opacity:1}100%{opacity:0}}
.mp-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:36px 18px;text-align:center;color:var(--mp-txt-l);}
.mp-empty-i{font-size:44px;margin-bottom:10px;}
.mp-empty-t{font-size:13px;line-height:1.6;}
.mp-ibtn{background:color-mix(in srgb,var(--mp-pink) 12%,transparent);border:1px solid color-mix(in srgb,var(--mp-pink) 18%,transparent);border-radius:8px;min-height:32px;padding:0 12px;font-size:11px;cursor:pointer;color:var(--mp-pink-dk);font-weight:600;font-family:var(--mp-font);display:inline-flex;align-items:center;justify-content:center;}
.mp-ibtn-view{background:rgba(144,202,249,.16);border-color:rgba(144,202,249,.35);color:var(--mp-info);}
.mp-ibtn-hidden{visibility:hidden;}
.mp-ibtn-r{padding:0 12px;min-height:32px;background:rgba(244,67,54,.06);border:1px solid rgba(244,67,54,.12);border-radius:8px;font-size:11px;cursor:pointer;font-family:var(--mp-font);color:#e53935;font-weight:600;display:inline-flex;align-items:center;justify-content:center;}
.mp-ibtn-chat{flex:1;padding:7px;background:color-mix(in srgb,var(--mp-pink) 8%,transparent);border:1px solid color-mix(in srgb,var(--mp-pink) 15%,transparent);border-radius:8px;font-size:11px;cursor:pointer;font-family:var(--mp-font);color:var(--mp-txt);}
.mp-char-actions{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:10px;}
.mp-char-actions .mp-ibtn,.mp-char-actions .mp-ibtn-r{width:100%;padding:7px 8px;font-size:11px;}
.mp-badge-enabled{background:rgba(129,199,132,.2);color:#2e7d32;}
.mp-badge-disabled{background:rgba(120,144,156,.18);color:#546e7a;}
.mp-lorebook-content{font-size:12px;line-height:1.6;white-space:pre-wrap;max-height:260px;overflow-y:auto;padding:10px;border:1px solid color-mix(in srgb,var(--mp-pink) 18%,transparent);border-radius:8px;background:var(--mp-glass);}
.mp-lorebook-description{display:-webkit-box;max-width:100%;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:4;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;}
/* Wallet ledger */
:root{--mp-bank-1:#F9E7C4;--mp-bank-2:#F6D8A8;--mp-bank-txt:#6B5238;--mp-bank-sub:#A0803F;}
.mp-bank{position:relative;border-radius:18px;background:linear-gradient(135deg,var(--mp-bank-1),var(--mp-bank-2));padding:15px 16px;overflow:hidden;box-shadow:0 8px 22px color-mix(in srgb,var(--mp-bank-2) 55%,transparent)}.mp-bank::after{content:'';position:absolute;top:-24px;right:-24px;width:110px;height:110px;border-radius:50%;background:radial-gradient(circle,rgba(255,252,248,.6),transparent 70%);pointer-events:none}.mp-bank-label,.mp-bank-sum{font-family:var(--mp-hand,var(--mp-font));color:var(--mp-bank-sub);position:relative}.mp-bank-label{font-size:12px}.mp-bank-sum{font-size:11px;margin-top:6px}.mp-bank-amt{font-family:var(--mp-fontd);font-size:30px;font-weight:700;color:var(--mp-bank-txt);position:relative}.mp-bank-edit{position:relative;border:0;border-radius:999px;padding:4px 10px;background:rgba(255,252,248,.6);color:var(--mp-bank-sub);font-size:10px;font-weight:700;cursor:pointer}
.mp-wtabs{display:flex;gap:6px}.mp-wtab{flex:1;padding:8px;border:0;border-radius:12px;background:transparent;color:var(--mp-txt-l);font:700 12px var(--mp-font);cursor:pointer}.mp-wtab.active{background:var(--mp-surface);color:var(--mp-pink-dk);box-shadow:0 3px 10px color-mix(in srgb,var(--mp-pink) 14%,transparent)}.mp-wfilter{display:flex;gap:6px;overflow-x:auto}.mp-wfilter::-webkit-scrollbar{display:none}.mp-wchip{flex-shrink:0;border:0;border-radius:999px;padding:5px 12px;background:color-mix(in srgb,var(--mp-surface) 65%,transparent);color:var(--mp-txt-l);font:700 10px var(--mp-font);cursor:pointer}.mp-wchip.active{background:var(--mp-pink-dk);color:#fff}
.mp-wday{padding:7px 2px 4px;font:11px var(--mp-hand,var(--mp-font));color:var(--mp-pink-dk)}.mp-wrow{display:flex;align-items:center;gap:9px;margin-bottom:6px;padding:9px 11px;border-radius:14px;background:var(--mp-surface);box-shadow:0 3px 10px color-mix(in srgb,var(--mp-pink) 10%,transparent)}.mp-wrow-av{width:28px;height:28px;border-radius:50%;overflow:hidden;display:grid;place-items:center;flex-shrink:0;background:var(--mp-pink-lt)}.mp-wrow-av img{width:100%;height:100%;object-fit:cover}.mp-wrow-note{font-size:12px;font-weight:700}.mp-wrow-meta{font:10px var(--mp-hand,var(--mp-font));color:var(--mp-txt-l)}.mp-wamt{font-weight:800;flex-shrink:0}.mp-wamt.in{color:#65935d}.mp-wamt.out{color:var(--mp-pink-dk)}.mp-wrow.memorial{position:relative;margin-top:11px;background:linear-gradient(135deg,#FBF0DA,#F9E7C4);border:1px dashed #DFB86E}.mp-wmem-tag{position:absolute;top:-8px;left:12px;padding:2px 8px;border-radius:999px;background:var(--mp-pink-dk);color:#fff;font-size:9px}.mp-wmem-btn{border:0;background:transparent;cursor:pointer}
.mp-wmonth-nav{display:flex;justify-content:center;align-items:center;gap:14px;font-weight:800}.mp-wmonth-nav button{border:0;background:transparent;color:var(--mp-pink-dk);font-size:18px}.mp-wcard{padding:14px;border-radius:18px;background:var(--mp-surface);box-shadow:0 6px 18px color-mix(in srgb,var(--mp-pink) 12%,transparent)}.mp-wcomp-row{display:flex;justify-content:space-between;font-size:12px;font-weight:700}.mp-wbar{height:8px;margin:6px 0 10px;border-radius:99px;background:var(--mp-pink-lt);overflow:hidden}.mp-wbar i{display:block;height:100%;background:linear-gradient(90deg,var(--mp-bubble),var(--mp-bubble-2))}.mp-wbar.gold i{background:linear-gradient(90deg,var(--mp-bank-1),#E8B95C)}.mp-wweeks{display:flex;align-items:flex-end;gap:9px;height:64px}.mp-wweek{flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:3px}.mp-wweek i{width:100%;min-height:2px;background:var(--mp-pink);border-radius:6px 6px 0 0}.mp-wweek small{font-size:9px}.mp-wnote{padding:12px;border-radius:5px;background:#FBF3D9;color:#8A7268;font:13px/1.7 var(--mp-hand,var(--mp-font));transform:rotate(-.5deg)}
.mp-wallet-month-sub{font:10px var(--mp-hand,var(--mp-font));color:var(--mp-pink-dk)}.mp-wallet-month-body{display:grid;gap:11px;padding-bottom:34px}.mp-month-compare{padding:16px}.mp-month-out{color:#E7798E;font-size:17px}.mp-month-in{color:#D49A2E;font-size:17px}.mp-wcomp-note{text-align:center;color:var(--mp-pink-dk);font:12px var(--mp-hand,var(--mp-font));padding-top:3px}.mp-month-card-title{font-size:11px;font-weight:800;color:var(--mp-txt-l);margin-bottom:10px}.mp-wweeks-dual{height:82px}.mp-week-bars{width:100%;height:64px;display:flex;align-items:flex-end;justify-content:center;gap:3px}.mp-week-bars i{width:42%;min-height:2px}.mp-week-bars i.out{background:linear-gradient(180deg,#F09AA8,#E7798E)}.mp-week-bars i.in{background:linear-gradient(180deg,#F5D28C,#DDAE4D)}.mp-week-legend{display:flex;justify-content:center;gap:15px;margin-top:7px;font-size:9px;color:var(--mp-txt-l)}.mp-week-legend span:first-child{color:#E7798E}.mp-week-legend span:last-child{color:#D49A2E}.mp-wmem-shelf{display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-size:11px;color:var(--mp-txt-l)}.mp-wmem-chip{border:1px dashed #DFB86E;border-radius:999px;padding:4px 10px;background:#FBF0DA;color:#A0803F;font:10px var(--mp-hand,var(--mp-font));cursor:pointer}
`;

// ============================================================
// Main Component
// ============================================================

// 介面字體選項：全部使用已載入的 Google Fonts 或系統字體，不增加載入成本
const FONT_PRESETS = {
  "圓體": { stack: "'Zen Maru Gothic','Quicksand',sans-serif" },
  "明體": { stack: "'Noto Serif TC','Zen Maru Gothic',serif" },
  "手寫體": { stack: "'Yomogi','Zen Maru Gothic',sans-serif" },
  "系統黑體": { stack: "'Microsoft JhengHei','PingFang TC',system-ui,sans-serif" },
};

export { THEME_PRESETS, FONT_PRESETS };
export default css;
