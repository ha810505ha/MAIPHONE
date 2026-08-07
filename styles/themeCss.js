export function buildThemeCss({
  activeTheme,
  activeFontStack,
  fontSizeScale = "normal",
  isNightTheme,
  isPeachTheme,
  hasPeachEffects,
  themeEffectsEnabled,
  showThemeEffects,
  normalizedThemeName,
  scopedCustomCss,
}) {
  const fontScale = { normal: 1, large: 1.1, xlarge: 1.2, xxlarge: 1.3 }[fontSizeScale] || 1;
  const renderThemeEffects = themeEffectsEnabled && showThemeEffects;
  return `
    :root{
      ${Object.entries(activeTheme?.vars || {}).map(([k, v]) => `${k}:${v};`).join("")}
      --mp-font:${activeFontStack};
      --mp-font-scale:${fontScale};
      --mp-page-bg:${activeTheme?.surfaces?.pageBg || "linear-gradient(180deg,#fce4ec 0%,#fff 30%)"};
      --mp-lock-bg:${activeTheme?.surfaces?.lockBg || "linear-gradient(160deg,#fce4ec 0%,#f8bbd0 30%,#e8eaf6 60%,#b3e5fc 100%)"};
      --mp-card-bg:var(--mp-surface);
      --mp-card-border:var(--mp-glass-b);
      /* App pages should consume these semantic tokens instead of hard-coded foreground colors. */
      --mp-page-surface:var(--mp-surface);
      --mp-page-text:var(--mp-txt);
      --mp-page-text-muted:var(--mp-txt-l);
      --mp-page-border:var(--mp-glass-b);
      --mp-page-control-bg:var(--mp-surface);
      --mp-page-on-accent:#fff;
      --mp-accent:var(--mp-pink-dk);
      --mp-accent-soft:var(--mp-pink-lt);
      --mp-on-accent:#fff;
      --mp-muted:var(--mp-txt-l);
      --mp-overlay:rgba(20,12,24,.34);
      --mp-shadow:var(--mp-glass-s);
      --mp-success:#43a047;
      --mp-warning:#d9822b;
      --mp-danger:#d75a5a;
      --mp-space-xs:4px;
      --mp-space-sm:8px;
      --mp-space-md:12px;
      --mp-space-lg:16px;
    }
    .mp-wrap{background:${activeTheme?.surfaces?.wrapBg || "linear-gradient(135deg,#fce4ec 0%,#e8eaf6 50%,#e1f5fe 100%)"};}
    .mp-phone{background:${activeTheme?.surfaces?.phoneBg || "linear-gradient(160deg,#fce4ec 0%,#f8bbd0 25%,#e1f5fe 50%,#b3e5fc 75%,#f3e5f5 100%)"};font-size:calc(16px * var(--mp-font-scale));-webkit-text-size-adjust:calc(100% * var(--mp-font-scale));text-size-adjust:calc(100% * var(--mp-font-scale));}
    @media (min-width:700px){.mp-phone{zoom:var(--mp-font-scale);}}
    @media (min-width:700px){.notes-add-button{right:64px !important;}}
    .mp-lock{background:var(--mp-lock-bg);}
    .mp-lock-hint{max-width:min(82vw,320px);padding:0 12px;text-align:center;line-height:1.4;word-break:keep-all;overflow-wrap:anywhere;font-size:12px;}
    .mp-page{background:${activeTheme?.surfaces?.pageBg || "linear-gradient(180deg,#fce4ec 0%,#fff 30%)"};}
    /* Use this only for an intentionally fixed light art direction (for example, a paper notebook).
       It keeps the shared phone chrome readable even while the rest of the phone is in Night. */
    .mp-page[data-mp-surface="light"]{--mp-page-surface:rgba(255,255,255,.88);--mp-page-text:#57434b;--mp-page-text-muted:#8d7580;--mp-page-border:#ead6dd;--mp-page-control-bg:rgba(255,250,248,.94);--mp-page-on-accent:#fff;color:var(--mp-page-text);}
    .mp-page[data-mp-surface="light"]>.mp-hdr{background:var(--mp-page-control-bg);border-color:var(--mp-page-border);}
    .mp-page[data-mp-surface="light"]>.mp-hdr .mp-htitle{color:var(--mp-page-text);}
    .mp-page[data-mp-surface="light"]>.mp-hdr .mp-back{background:var(--mp-page-text);border-color:rgba(87,67,75,.22);color:var(--mp-page-on-accent);box-shadow:0 3px 10px rgba(87,67,75,.18);}
    ${isNightTheme ? `
      .mp-page{background:${activeTheme.surfaces.pageBg};}
      .mp-cr{background:linear-gradient(180deg,rgba(36,27,51,.97),rgba(26,22,37,.99));}
      .mp-bar,.mp-hdr,.mp-inp-bar,.mp-dock{background:rgba(26,22,37,.95);border-color:#3a2d4f;}
      .mp-modal,.mp-sg,.mp-cc,.mp-post,.mp-sc,.mp-cw,.mp-transfer-card{background:rgba(36,27,51,.95);border-color:#3a2d4f;box-shadow:0 8px 24px rgba(7,4,12,.26);}
      .game-center-page .mp-cw-name,.game-center-page .mp-cw div{color:#4a3c48 !important;}
      .game-center-page .mp-cw div[style*="var(--mp-txt-l)"]{color:#8d7485 !important;}
      .yunyin-game-page [data-yunyin-panel="1"]{color:#4a4038 !important;}
      .yunyin-game-page [data-yunyin-panel="1"] div,.yunyin-game-page [data-yunyin-panel="1"] span,.yunyin-game-page [data-yunyin-panel="1"] b,.yunyin-game-page [data-yunyin-panel="1"] small{color:#4a4038 !important;}
      .mp-icon-c,.mp-dock-i,.mp-back{background:rgba(47,36,64,.9);border-color:#3a2d4f;box-shadow:0 3px 12px rgba(7,4,12,.24);}
      .mp-icon-c:hover,.mp-dock-i:hover,.mp-cw:hover{background:rgba(58,45,79,.96);box-shadow:0 5px 16px rgba(7,4,12,.3);}
      .mp-chat-switch,.mp-mode-tabs{background:rgba(47,36,64,.72);border-color:#3a2d4f;box-shadow:none;}
      .mp-chat-switch-btn{color:#b8a8c9;}
      .mp-chat-switch-btn.active{color:#f0e6f5;background:rgba(244,143,177,.18);box-shadow:0 2px 8px rgba(7,4,12,.2);}
      .mp-chat-row,.mp-ci{border-color:rgba(122,107,138,.24);}
      .mp-chat-row:hover,.mp-chat-row.pinned:hover,.mp-ci:hover{background:rgba(255,255,255,.055);}
      .mp-chat-row:active{background:rgba(244,143,177,.1);}
      .mp-msg-ai{background:#2f2440;color:#f0e6f5;border-color:#3a2d4f;box-shadow:0 2px 8px rgba(7,4,12,.2);}
      .mp-msg-user{background:linear-gradient(135deg,#ec6a95,#d95e88);color:#fff;box-shadow:0 2px 8px rgba(7,4,12,.22);}
      .mp-post-menu{background:rgba(36,27,51,.98);border-color:#3a2d4f;box-shadow:0 8px 24px rgba(7,4,12,.4);}
      .mp-msg-ai .mp-msg-t{color:#9384a2;}
      .mp-msg-user .mp-msg-t{color:rgba(255,255,255,.72);}
      .mp-reality-msg{background:transparent;border-color:transparent;box-shadow:none;color:#c9b8da;}
      .mp-reality-user .mp-reality-msg{background:linear-gradient(135deg,#465d79,#394b66);color:#f4f8fc;box-shadow:inset 0 0 0 1px rgba(165,201,232,.22),0 2px 10px rgba(7,4,12,.22);}
      .mp-reality-ai .mp-reality-msg{background:transparent;color:#b5a3c4;box-shadow:none;}
      .mp-reality-dialogue{color:#fff7fc;font-weight:400;}
      .mp-reality-thought{color:#d9a6e8;font-style:italic;font-weight:600;}
      .mp-reality-strong{color:#ff91b8;font-weight:800;}
      .mp-mode-sep{color:#a5c9e8;}
      .mp-mode-sep::before{background:linear-gradient(90deg,rgba(165,201,232,0),rgba(165,201,232,.42));}
      .mp-mode-sep::after{background:linear-gradient(90deg,rgba(165,201,232,.42),rgba(165,201,232,0));}
      .mp-mode-sep span{background:#26384d;border-color:rgba(165,201,232,.34);color:#c5def2;}
      .mp-chat-mode-reality .mp-inp-bar{background:rgba(30,24,43,.97);border-top-color:rgba(165,201,232,.28);box-shadow:0 -6px 18px rgba(7,4,12,.22);}
      .mp-chat-mode-reality .mp-inp{background:#292039;border-color:rgba(165,201,232,.24);}
      .mp-chat-mode-reality .mp-btn-send{background:linear-gradient(135deg,#a5c9e8,#7ba8d1);color:#1a1625;}
      .mp-thought-content{background:rgba(47,36,64,.72);border-color:rgba(200,168,224,.5);}
      .mp-inp,.mp-sinp,.mp-ssel,.mp-ta{background:#2f2440;color:#f0e6f5;border-color:#3a2d4f;}
      .mp-ssel option{background:#241b33;color:#f0e6f5;}
      .mp-inp:focus,.mp-sinp:focus,.mp-ta:focus{border-color:#7ba8d1;}
      .mp-inp::placeholder,.mp-sinp::placeholder,.mp-ta::placeholder{color:#9384a2;}
      .mp-cw-desc,.mp-ci-prev,.mp-lbl,.mp-mode-hint{color:#b8a8c9;}
      .mp-msg-t,.mp-reality-t,.mp-char-counter{color:#81728f;}
      .mp-htitle,.mp-clock-big,.mp-clock-day,.mp-lock-time,.mp-cw-name,.mp-ctitle,.mp-sec-ct,.mp-persona,.mp-icon-l{color:#f0e6f5;}
      .mp-lock-notif{background:rgba(47,36,64,.72);border-color:rgba(165,201,232,.24);}
      .mp-lock-notif-name{color:#f0e6f5;}
      .mp-ibtn,.mp-ibtn-chat{background:rgba(165,201,232,.1);border-color:rgba(165,201,232,.3);color:#a5c9e8;}
      .mp-ibtn-view{background:rgba(130,177,255,.12);border-color:rgba(130,177,255,.34);color:#a9c8ff;}
      .mp-ibtn-r{background:rgba(229,115,115,.1);border-color:rgba(229,115,115,.28);color:#ef9696;}
      .mp-badge-enabled{background:rgba(129,199,132,.16);color:#9bd29e;}
      .mp-badge-disabled{background:rgba(122,107,138,.18);color:#b8a8c9;}
      .mp-lorebook-content{background:#2f2440;border-color:#3a2d4f;color:#f0e6f5;}
      .mp-btn-img{background:rgba(47,36,64,.9);color:#f0e6f5;border-color:#3a2d4f;}
      .mp-btn-img.active{background:rgba(165,201,232,.14);color:#a5c9e8;border-color:rgba(165,201,232,.32);}
      .mp-save{background:linear-gradient(135deg,#f48fb1,#ec6a95);color:#1a1625;}
      .mp-mode-tab{color:#b8a8c9;}
      .mp-mode-tab.active{background:#3a2d4f;color:#f0e6f5;box-shadow:0 2px 8px rgba(7,4,12,.24);}
      .mp-msg-note{background:rgba(47,36,64,.72);border-color:#3a2d4f;color:#b8a8c9;}
      .mp-msg-editbtn{background:#2f2440;border-color:rgba(165,201,232,.34);color:#a5c9e8;box-shadow:0 2px 7px rgba(7,4,12,.32);}
      .mp-msg-editbtn:hover{background:#3a2d4f;border-color:rgba(165,201,232,.52);color:#c5def2;}
      .mp-msg-editbtn + .mp-msg-editbtn{border-color:rgba(229,115,115,.34);color:#e98a8a;}
      .mp-msg-editbtn + .mp-msg-editbtn:hover{border-color:rgba(229,115,115,.52);color:#ffaaaa;}
      .mp-page-dot{background:rgba(255,255,255,.2);}
      .mp-page-dot.active{background:#f48fb1;}
      .mp-scroll-bottom{color:#f0e6f5;filter:drop-shadow(0 1px 3px rgba(7,4,12,.78));}
    ` : ``}
    ${isPeachTheme ? `
      .mp-chat-row,.mp-ci{border-bottom-color:var(--mp-line);}
      .mp-thought-history-divider{background:var(--mp-line);}
      .mp-thought-history,.mp-thought-record{border-color:var(--mp-line);}
      .mp-thought-history-pages button,.mp-transfer-row,.mp-transfer-note{border-color:var(--mp-line);}
      .mp-msg{border-radius:18px;}
      .mp-msg-ai{background:var(--mp-surface);border:none;border-radius:18px 18px 18px 6px;box-shadow:0 4px 12px color-mix(in srgb,var(--mp-pink) 12%,transparent);}
      .mp-msg-user{border-radius:18px 18px 6px 18px;}
      .mp-chat-row-badge{background:linear-gradient(135deg,var(--mp-bubble),var(--mp-bubble-2));box-shadow:0 2px 6px color-mix(in srgb,var(--mp-bubble-2) 40%,transparent);}
      .mp-chat-row-time,.mp-msg-t,.mp-reality-t,.mp-post-tm{font-family:var(--mp-hand);font-size:10px;}
      .mp-cr::before{content:'';position:absolute;inset:0;pointer-events:none;z-index:0;background-image:radial-gradient(color-mix(in srgb,var(--mp-pink-dk) 8%,transparent) 1px,transparent 1px),radial-gradient(circle at 15% 10%,color-mix(in srgb,var(--mp-pink-lt) 45%,transparent),transparent 38%);background-size:9px 9px,100% 100%;}
      .mp-msgs{position:relative;z-index:1;}
      .mp-phone::before,.mp-phone::after{position:absolute;top:-26px;z-index:95;pointer-events:none;font-size:12px;opacity:0;animation:mpPetal 12s linear infinite;}
      .mp-phone::before{content:'🌸';left:12%;text-shadow:98px 76px 0 rgba(244,169,176,.8);}
      .mp-phone::after{content:'🌸';left:64%;text-shadow:74px 128px 0 rgba(224,122,139,.72);animation-delay:3s;animation-duration:14s;}
      .mp-desk-scroll>.mp-cw{position:relative;height:155px;margin:6px 0 12px;padding:0;display:block;overflow:hidden;border:0;border-radius:20px;background:repeating-linear-gradient(45deg,color-mix(in srgb,var(--mp-surface) 78%,transparent) 0 12px,color-mix(in srgb,var(--mp-pink) 12%,transparent) 12px 24px);box-shadow:0 8px 24px color-mix(in srgb,var(--mp-pink-dk) 10%,transparent);touch-action:pan-x pan-y;}
      .mp-desk-scroll>.mp-cw::before{content:'角色立繪 ／ 自訂桌布';position:absolute;left:50%;top:50%;z-index:0;transform:translate(-50%,-50%);padding:7px 13px;border-radius:12px;background:color-mix(in srgb,var(--mp-surface) 86%,transparent);color:var(--mp-txt-l);font-size:10px;white-space:nowrap;}
      .mp-desk-scroll>.mp-cw>.mp-av{position:absolute;inset:0;z-index:1;width:100%;height:100%;border-radius:0;background:transparent;box-shadow:none;font-size:0;}
      .mp-desk-scroll>.mp-cw>.mp-av img{position:absolute;inset:0;z-index:1;width:100%;height:100%;object-fit:cover;object-position:center;transform-origin:center;will-change:transform;user-select:none;-webkit-user-drag:none;}
      .mp-desk-scroll>.mp-cw>.mp-av img.mp-hero-blur-bg{z-index:0;object-fit:cover;transform:scale(1.12);filter:blur(16px) saturate(1.08) brightness(1.02);opacity:.85;}
      .mp-desk-scroll>.mp-cw>.mp-cw-info{position:absolute;left:12px;bottom:12px;z-index:2;width:max-content;max-width:calc(100% - 24px);padding:7px 14px 8px 10px;border-radius:18px;background:color-mix(in srgb,var(--mp-surface) 88%,transparent);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);box-shadow:0 4px 14px color-mix(in srgb,var(--mp-pink-dk) 18%,transparent);}
      .mp-desk-scroll>.mp-cw .mp-cw-name{font-size:11px;font-weight:800;gap:5px;}
      .mp-desk-scroll>.mp-cw .mp-active-badge{width:7px;height:7px;min-width:7px;padding:0;border-radius:50%;font-size:0;background:#9CCC65;box-shadow:0 0 6px rgba(156,204,101,.8);}
      .mp-desk-scroll>.mp-cw .mp-cw-desc{max-width:270px;margin-top:2px;font-family:var(--mp-font);font-size:11px;line-height:1.35;color:var(--mp-pink-dk);white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere;}
      .peach-hero{cursor:default;}
      .peach-hero:active{transform:none;}
      .peach-hero>.mp-cw-info{cursor:pointer;transition:max-width .18s ease,padding .18s ease,border-radius .18s ease;}
      .peach-hero>.mp-cw-info.is-collapsed{width:auto;max-width:calc(100% - 24px);padding:7px 12px;border-radius:999px;}
      .peach-status-time{font-family:var(--mp-font);font-size:9px;font-weight:500;color:var(--mp-txt-l);white-space:nowrap;}
      .peach-status-new{width:7px;height:7px;border-radius:50%;background:#ef6f83;box-shadow:0 0 0 3px rgba(239,111,131,.16),0 0 7px rgba(239,111,131,.7);animation:mpThoughtPulse 1.15s ease-in-out infinite;}
      .peach-hero-adjust{position:absolute;right:9px;top:9px;z-index:4;padding:5px 9px;border:0;border-radius:999px;background:rgba(255,252,248,.88);color:var(--mp-pink-dk);font-size:10px;font-weight:800;box-shadow:0 3px 10px rgba(107,87,80,.14);cursor:pointer;}
      .peach-hero.is-adjusting{cursor:grab;touch-action:none;box-shadow:inset 0 0 0 2px var(--mp-pink-dk),0 8px 24px rgba(224,122,139,.18);}
      .peach-hero.is-adjusting:active{transform:none;cursor:grabbing;}
      .peach-hero-tools{position:absolute;left:8px;right:8px;bottom:8px;z-index:5;display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:14px;background:rgba(255,252,248,.92);box-shadow:0 4px 14px rgba(107,87,80,.18);}
      .peach-hero-tools input{min-width:0;flex:1;accent-color:var(--mp-pink-dk);}
      .peach-hero-tools button{border:0;border-radius:10px;padding:5px 8px;background:var(--mp-pink-lt);color:var(--mp-txt);font-size:10px;font-weight:800;cursor:pointer;}
      .peach-hero-tools button:last-child{background:linear-gradient(135deg,var(--mp-save-1),var(--mp-save-2));color:#fff;}
      .peach-hero.is-adjusting>.mp-cw-info{display:none;}
      .mp-home-mid{min-height:240px;}
      .mp-grid{gap:14px 8px;}
      .mp-chat-list{width:100%;min-width:0;max-width:100%;overflow-x:hidden;}
      .mp-chat-list-line{width:100%;min-width:0;max-width:100%;padding:8px 14px 16px;gap:10px;box-sizing:border-box;overflow-x:hidden;}
      .mp-chat-list-line .mp-chat-row{position:relative;width:100%;min-width:0;max-width:100%;min-height:84px;padding:12px 14px 12px 12px;gap:12px;box-sizing:border-box;border:1px solid color-mix(in srgb,var(--mp-pink) 20%,var(--mp-surface));border-radius:22px;background:color-mix(in srgb,var(--mp-surface) 86%,transparent);box-shadow:0 7px 20px color-mix(in srgb,var(--mp-pink-dk) 8%,transparent);overflow:hidden;}
      .mp-chat-list-line .mp-chat-row:hover{background:var(--mp-surface);box-shadow:0 9px 24px color-mix(in srgb,var(--mp-pink-dk) 12%,transparent);}
      .mp-chat-list-line .mp-chat-row:active{transform:scale(.985);background:var(--mp-surface);}
      .mp-chat-list-line .mp-chat-row.pinned{border-color:color-mix(in srgb,var(--mp-pink) 72%,transparent);box-shadow:0 0 0 3px color-mix(in srgb,var(--mp-pink) 17%,transparent),0 8px 22px color-mix(in srgb,var(--mp-pink-dk) 11%,transparent);}
      .mp-chat-list-line .mp-chat-row-avatar{width:56px;height:56px;border-radius:50%;border:2px solid var(--mp-surface);box-shadow:0 0 0 2px color-mix(in srgb,var(--mp-pink) 48%,transparent);font-size:22px;}
      .mp-chat-list-line .mp-chat-row.pinned .mp-chat-row-avatar{box-shadow:0 0 0 3px color-mix(in srgb,var(--mp-pink) 62%,transparent),0 0 0 6px var(--mp-surface);}
      .mp-chat-list-line .mp-chat-row-body{align-self:stretch;display:flex;flex-direction:column;justify-content:center;}
      .mp-chat-list-line .mp-chat-row-top{align-items:center;}
      .mp-chat-list-line .mp-chat-row-name{font-size:14px;color:var(--mp-txt);}
      .mp-chat-list-line .mp-chat-row-name>span:last-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .mp-chat-list-line .mp-chat-row-pin{order:2;color:var(--mp-pink-dk);font-size:11px;}
      .mp-chat-list-line .mp-chat-row-time{font-family:var(--mp-hand);font-size:9px;color:var(--mp-txt-l);padding:0;}
      .mp-chat-list-line .mp-chat-row-preview{min-width:0;max-width:100%;margin-top:4px;font-size:12px;color:var(--mp-txt-l);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .mp-chat-list-line .mp-chat-row-bottom{align-items:center;}
      .mp-chat-list-line .mp-chat-row-badge{min-width:30px;height:24px;padding:0 9px;border-radius:999px;background:linear-gradient(135deg,var(--mp-bubble),var(--mp-bubble-2));box-shadow:0 3px 9px color-mix(in srgb,var(--mp-bubble-2) 24%,transparent);font-family:var(--mp-hand);font-size:11px;}
      @media (prefers-reduced-motion:reduce){.mp-phone::before,.mp-phone::after{display:none;}}
    ` : ``}
    ${!hasPeachEffects ? `.mp-cr::before{display:none!important}` : ``}
    ${!renderThemeEffects ? `.mp-phone::before,.mp-phone::after{display:none!important;animation:none!important}` : ``}
    ${false && showThemeEffects && normalizedThemeName === "莓果蘇打" ? `
      .mp-phone::before,.mp-phone::after{display:block;content:'○';top:auto;bottom:-30px;color:rgba(255,255,255,.72);font-size:25px;text-shadow:72px -130px 0 rgba(144,202,249,.38),188px -48px 0 rgba(206,147,216,.32),278px -210px 0 rgba(244,143,177,.36);animation:mpBubbleRise 13s ease-in infinite;}
      .mp-phone::after{left:46%;font-size:17px;animation-delay:5s;animation-duration:16s;}
    ` : ``}
    ${false && showThemeEffects && normalizedThemeName === "夜色絨幕" ? `
      .mp-phone::before,.mp-phone::after{display:block;content:'✦';top:12%;left:12%;color:#f4dfff;font-size:9px;text-shadow:62px 88px 0 #a5c9e8,176px 22px 0 #f48fb1,248px 154px 0 #c8a8e0,94px 310px 0 #fff;animation:mpStarTwinkle 4.8s ease-in-out infinite;}
      .mp-phone::after{content:'·';top:24%;left:28%;font-size:17px;animation-delay:1.8s;animation-duration:6.2s;}
    ` : ``}
    ${false && showThemeEffects && normalizedThemeName === "抹茶檸檬" ? `
      .mp-phone::before,.mp-phone::after{display:block;content:'🍃';top:-30px;left:13%;font-size:13px;text-shadow:104px 120px 0 rgba(124,179,66,.55),232px 30px 0 rgba(230,168,23,.38);animation:mpLeafFall 15s linear infinite;}
      .mp-phone::after{left:58%;font-size:10px;animation-delay:6s;animation-duration:18s;}
    ` : ``}
    ${false && showThemeEffects && normalizedThemeName === "海鹽汽水" ? `
      .mp-phone::before,.mp-phone::after{display:block;content:'';inset:0;top:0;left:0;font-size:0;background-image:radial-gradient(ellipse at 20% 30%,rgba(255,255,255,.22) 0 2px,transparent 3px),radial-gradient(ellipse at 70% 65%,rgba(77,182,172,.16) 0 3px,transparent 4px);background-size:54px 38px,76px 52px;animation:mpWaterShimmer 12s ease-in-out infinite;}
      .mp-phone::after{animation-delay:3s;animation-duration:16s;filter:blur(1px);}
    ` : ``}
    ${renderThemeEffects && normalizedThemeName === "莓果蘇打" ? `
      .mp-phone::before,.mp-phone::after{content:'🫧';top:auto;bottom:-28px;color:rgba(255,255,255,.82);font-family:var(--mp-font);font-size:22px;text-shadow:none;filter:none;animation:mpBubbleRise 13s ease-in infinite;}
      .mp-phone::after{content:'🫧';left:58%;font-size:20px;text-shadow:none;filter:none;animation-name:mpBubbleRiseAlt;animation-delay:3.7s;animation-duration:16.8s;animation-timing-function:ease-in-out;}
    ` : ``}
    ${renderThemeEffects && normalizedThemeName === "夜色絨幕" ? `
      .mp-phone::before,.mp-phone::after{content:'✦';color:#f4dfff;font-size:11px;text-shadow:98px 76px 0 rgba(165,201,232,.78);}
      .mp-phone::after{content:'⋆';font-size:15px;color:#c8a8e0;text-shadow:74px 128px 0 rgba(244,143,177,.72);}
    ` : ``}
    ${renderThemeEffects && normalizedThemeName === "抹茶檸檬" ? `
      .mp-phone::before,.mp-phone::after{content:'🍃';font-size:13px;text-shadow:98px 76px 0 rgba(124,179,66,.48);}
      .mp-phone::after{content:'•';font-size:18px;color:#e6a817;text-shadow:74px 128px 0 rgba(230,168,23,.42);}
    ` : ``}
    ${renderThemeEffects && normalizedThemeName === "海鹽汽水" ? `
      .mp-phone::before,.mp-phone::after{content:'❄️';top:22%;left:-25px;font-size:14px;text-shadow:78px 34px 0 rgba(79,195,247,.22);animation:mpSaltCrystalDrift 15s ease-in-out infinite;}
      .mp-phone::after{content:'❄️';top:62%;left:auto;right:-25px;font-size:10px;color:rgba(255,255,255,.82);text-shadow:64px -32px 0 rgba(77,182,172,.2);animation:mpSaltCrystalDriftAlt 18s ease-in-out 4s infinite;}
    ` : ``}
    ${scopedCustomCss}
  `;
}
