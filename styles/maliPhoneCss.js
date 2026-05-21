const css = `
@import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@300;400;500;600;700&family=Zen+Maru+Gothic:wght@300;400;500;700&display=swap');
:root{--mp-pink:#f48fb1;--mp-pink-lt:#fce4ec;--mp-pink-dk:#e91e63;--mp-blue:#90caf9;--mp-blue-lt:#e1f5fe;--mp-purple:#ce93d8;--mp-purple-lt:#f3e5f5;--mp-glass:rgba(255,255,255,0.55);--mp-glass-b:rgba(255,255,255,0.65);--mp-glass-s:0 8px 32px rgba(244,143,177,0.15);--mp-txt:#37474f;--mp-txt-l:#78909c;--mp-r:20px;--mp-rs:12px;--mp-rx:8px;--mp-font:'Zen Maru Gothic','Quicksand',sans-serif;--mp-fontd:'Quicksand','Zen Maru Gothic',sans-serif;}
*{margin:0;padding:0;box-sizing:border-box;}
html,body,#root{width:100%;height:100%;min-height:100%;overflow:hidden;overscroll-behavior:none;}
body{position:fixed;inset:0;}
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
.mp-lock-time{font-family:var(--mp-fontd);font-size:68px;font-weight:300;letter-spacing:-2px;color:var(--mp-txt);text-shadow:0 2px 20px rgba(244,143,177,.25);}
.mp-lock-date{font-size:15px;font-weight:500;color:var(--mp-txt-l);margin-top:2px;letter-spacing:2px;}
.mp-lock-hint{position:absolute;bottom:60px;font-size:13px;color:var(--mp-txt-l);animation:mpFloat 2s ease-in-out infinite;}
@keyframes mpFloat{0%,100%{transform:translateY(0);opacity:.5}50%{transform:translateY(-6px);opacity:1}}
.mp-desk{position:absolute;inset:0;display:flex;flex-direction:column;}
.mp-desk-scroll{flex:1;overflow-y:auto;padding:4px 20px 168px;-webkit-overflow-scrolling:touch;}
.mp-desk-scroll::-webkit-scrollbar{display:none;}
.mp-badge{display:inline-flex;align-items:center;gap:5px;background:rgba(129,199,132,.22);border:1px solid rgba(129,199,132,.35);border-radius:16px;padding:3px 12px;margin-bottom:12px;font-size:10px;font-weight:700;color:#2e7d32;letter-spacing:1px;font-family:var(--mp-fontd);}
.mp-badge::before{content:'';width:5px;height:5px;border-radius:50%;background:#4caf50;}
.mp-clock{margin-bottom:14px;}
.mp-clock-big{font-family:var(--mp-fontd);font-size:56px;font-weight:300;letter-spacing:-2px;line-height:1;color:var(--mp-txt);}
.mp-clock-meta{display:flex;align-items:baseline;gap:8px;margin-top:2px;}
.mp-clock-day{font-size:18px;font-weight:600;color:var(--mp-txt);font-family:var(--mp-fontd);}
.mp-clock-ds{font-size:13px;color:var(--mp-txt-l);font-weight:500;}
.mp-cw{background:var(--mp-glass);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid var(--mp-glass-b);border-radius:24px;padding:14px 16px;margin-bottom:16px;display:flex;align-items:center;gap:12px;box-shadow:var(--mp-glass-s);cursor:pointer;transition:transform .15s,box-shadow .2s;}
.mp-cw:hover{box-shadow:0 12px 30px rgba(0,0,0,.08);}
.mp-cw:active{transform:scale(.97);}
.mp-av{width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:26px;background:linear-gradient(135deg,var(--mp-pink-lt),var(--mp-purple-lt));box-shadow:0 2px 8px rgba(244,143,177,.18);flex-shrink:0;overflow:hidden;}
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
.mp-app-icon-img{display:block;object-fit:contain;}
.mp-icon-c:hover{box-shadow:0 8px 18px rgba(244,143,177,.2);}
.mp-icon-l{font-size:11px;color:var(--mp-txt);font-weight:600;text-align:center;}
.mp-page-dots{position:absolute;left:0;right:0;bottom:98px;display:flex;align-items:center;justify-content:center;gap:7px;z-index:31;}
.mp-page-dot{width:7px;height:7px;border-radius:50%;background:rgba(55,71,79,.26);transition:all .2s ease;}
.mp-page-dot.active{width:18px;border-radius:10px;background:rgba(55,71,79,.68);}
.mp-grid-empty{grid-column:1 / -1;text-align:center;padding:28px 6px;font-size:12px;color:var(--mp-txt-l);background:rgba(255,255,255,.18);border-radius:14px;border:1px dashed rgba(255,255,255,.35);}
.mp-dock{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);width:calc(100% - 40px);max-width:328px;background:var(--mp-glass);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);border:1px solid var(--mp-glass-b);border-radius:28px;padding:12px 16px;display:flex;justify-content:space-between;gap:12px;box-shadow:0 12px 34px rgba(0,0,0,.08);z-index:30;}
.mp-dock-i{width:56px;height:56px;border-radius:18px;display:flex;align-items:center;justify-content:center;font-size:24px;cursor:pointer;background:rgba(255,255,255,.3);border:1px solid rgba(255,255,255,.4);transition:transform .14s ease,background .15s,box-shadow .18s;touch-action:none;}
.mp-dock-i .mp-app-icon-img{border-radius:18px;}
.mp-dock-i:active{transform:scale(.95);}
.mp-dock-i:hover{background:rgba(255,255,255,.5);box-shadow:0 8px 16px rgba(255,255,255,.35);}
.mp-page{position:absolute;inset:0;z-index:40;display:flex;flex-direction:column;background:linear-gradient(180deg,#fce4ec 0%,#fff 30%);transform-origin:center center;animation:mpAppOpen .24s cubic-bezier(.2,.8,.2,1);}
@keyframes mpAppOpen{
  0%{transform:scale(.88);opacity:.35;filter:blur(1.5px)}
  70%{transform:scale(1.01);opacity:1;filter:blur(0)}
  100%{transform:scale(1);opacity:1;filter:blur(0)}
}
.mp-hdr{display:flex;align-items:center;gap:10px;padding:12px 16px 10px;background:var(--mp-glass);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border-bottom:1px solid rgba(255,255,255,.45);flex-shrink:0;z-index:5;}
.mp-back{width:32px;height:32px;border-radius:50%;min-width:32px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.5);border:1px solid rgba(255,255,255,.6);cursor:pointer;font-size:15px;transition:transform .12s;}
.mp-back:active{transform:scale(.84);}
.mp-htitle{font-size:16px;font-weight:700;font-family:var(--mp-fontd);}
.mp-cl{flex:1;overflow-y:auto;padding:10px 14px 90px;}.mp-cl::-webkit-scrollbar{display:none;}
.mp-ci{display:flex;align-items:center;gap:10px;padding:10px;border-radius:14px;margin-bottom:4px;cursor:pointer;transition:background .12s;}
.mp-ci:hover{background:rgba(244,143,177,.07);}
.mp-ci-av{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;background:linear-gradient(135deg,var(--mp-pink-lt),var(--mp-blue-lt));overflow:hidden;}
.mp-ci-av img{width:100%;height:100%;object-fit:cover;border-radius:12px;}
.mp-ci-info{flex:1;min-width:0;}.mp-ci-name{font-size:13px;font-weight:600;}
.mp-ci-prev{font-size:11px;color:var(--mp-txt-l);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px;}
.mp-ci-time{font-size:10px;color:var(--mp-txt-l);flex-shrink:0;}
.mp-cr{flex:1;display:flex;flex-direction:column;min-height:0;}
.mp-msgs{flex:1;overflow-y:auto;padding:10px 14px;display:flex;flex-direction:column;gap:6px;}.mp-msgs::-webkit-scrollbar{display:none;}
.mp-msg-wrap{display:flex;align-items:flex-end;gap:6px;}
.mp-msg-wrap-ai{justify-content:flex-start;}
.mp-msg-wrap-user{justify-content:flex-end;}
.mp-msg-note-wrap{display:flex;justify-content:center;padding:4px 0;}
.mp-msg-note{max-width:92%;font-size:11px;line-height:1.5;color:#6b7c86;background:rgba(255,255,255,.75);border:1px dashed rgba(160,176,186,.65);padding:6px 10px;border-radius:10px;text-align:center;}
.mp-msg-note-wrap .mp-msg-editbtn{margin-left:8px;}
.mp-msg{max-width:78%;padding:9px 13px;border-radius:16px;font-size:13px;line-height:1.5;word-break:break-word;}
.mp-msg-ai{
  align-self:flex-start;
  background:rgba(255,255,255,.9);
  border:1px solid rgba(148,173,188,.42);
  border-bottom-left-radius:5px;
  box-shadow:0 2px 8px rgba(0,0,0,.06);
}
.mp-msg-user{align-self:flex-end;background:linear-gradient(135deg,#f48fb1,#f06292);color:#fff;border-bottom-right-radius:5px;}
.mp-msg-img{max-width:100%;border-radius:10px;margin-top:4px;}
.mp-msg-t{font-size:9px;opacity:.45;margin-top:3px;}
.mp-msg-editbtn{width:24px;height:24px;border-radius:50%;border:1px solid rgba(231,197,214,.9);background:#fff;color:var(--mp-txt);font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.mp-msg-editbtn-hidden{visibility:hidden;}
.mp-typing{display:flex;gap:3px;padding:6px 12px;align-self:flex-start;}
.mp-typing span{width:5px;height:5px;border-radius:50%;background:var(--mp-pink);animation:mpDot 1.4s infinite;}
.mp-typing span:nth-child(2){animation-delay:.2s}.mp-typing span:nth-child(3){animation-delay:.4s}
@keyframes mpDot{0%,60%,100%{transform:translateY(0);opacity:.35}30%{transform:translateY(-7px);opacity:1}}
.mp-inp-bar{display:flex;align-items:center;gap:6px;padding:10px 12px 14px;flex-shrink:0;background:rgba(255,255,255,.88);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-top:1px solid rgba(236,205,220,.85);box-shadow:0 -6px 18px rgba(0,0,0,.06);}
.mp-inp{flex:1;border:1px solid rgba(231,197,214,.9);outline:none;background:#fff;border-radius:18px;padding:10px 14px;font-size:13px;font-family:var(--mp-font);color:var(--mp-txt);resize:none;line-height:1.35;min-height:38px;max-height:86px;}
.mp-inp::placeholder{color:var(--mp-txt-l);}
.mp-btn{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:none;cursor:pointer;font-size:16px;transition:transform .12s;flex-shrink:0;}
.mp-btn:active{transform:scale(.84);}
.mp-btn-send{background:linear-gradient(135deg,#f48fb1,#e91e63);color:#fff;}
.mp-btn-img{background:rgba(255,255,255,.92);color:var(--mp-txt);border:1px solid rgba(231,197,214,.9);}
.mp-imgprev{display:flex;align-items:center;gap:6px;padding:6px 14px;background:rgba(255,255,255,.45);border-top:1px solid rgba(255,255,255,.4);flex-shrink:0;}
.mp-imgprev img{width:44px;height:44px;border-radius:7px;object-fit:cover;border:2px solid var(--mp-pink);}
.mp-imgprev button{width:18px;height:18px;border-radius:50%;background:rgba(0,0,0,.35);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;cursor:pointer;border:none;}
.mp-feed{flex:1;overflow-y:auto;padding:10px 14px 90px;}.mp-feed::-webkit-scrollbar{display:none;}
.mp-post{background:var(--mp-glass);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid var(--mp-glass-b);border-radius:var(--mp-r);padding:14px;margin-bottom:10px;box-shadow:var(--mp-glass-s);}
.mp-post-hd{display:flex;align-items:center;gap:8px;margin-bottom:8px;}
.mp-post-av{width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;background:linear-gradient(135deg,var(--mp-pink-lt),var(--mp-purple-lt));flex-shrink:0;overflow:hidden;}
.mp-post-av img{width:100%;height:100%;object-fit:cover;}
.mp-post-au{font-size:13px;font-weight:600;}.mp-post-tm{font-size:10px;color:var(--mp-txt-l);}
.mp-post-ct{font-size:13px;line-height:1.55;margin-bottom:8px;}
.mp-post-acts{display:flex;gap:14px;}
.mp-post-act{display:flex;align-items:center;gap:3px;font-size:12px;color:var(--mp-txt-l);cursor:pointer;background:none;border:none;font-family:var(--mp-font);transition:color .12s;}
.mp-post-act:hover{color:var(--mp-pink);}.mp-post-act.liked{color:var(--mp-pink-dk);}
.mp-cm{flex:1;overflow-y:auto;padding:10px 14px 90px;}.mp-cm::-webkit-scrollbar{display:none;}
.mp-cc{background:var(--mp-glass);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid var(--mp-glass-b);border-radius:var(--mp-r);padding:14px;margin-bottom:10px;box-shadow:var(--mp-glass-s);}
.mp-add{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;padding:12px;background:rgba(244,143,177,.08);border:2px dashed rgba(244,143,177,.25);border-radius:var(--mp-r);color:var(--mp-pink);font-size:13px;font-weight:600;cursor:pointer;font-family:var(--mp-font);transition:background .12s;}
.mp-add:hover{background:rgba(244,143,177,.13);}
.mp-sc{position:relative;background:var(--mp-glass);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border:1px solid var(--mp-glass-b);border-radius:var(--mp-r);overflow:hidden;margin-bottom:10px;box-shadow:var(--mp-glass-s);}
.mp-sc-ban{height:80px;background:linear-gradient(135deg,var(--mp-pink-lt),var(--mp-blue-lt),var(--mp-purple-lt));position:relative;}
.mp-sc-avl{width:56px;height:56px;border-radius:18px;display:flex;align-items:center;justify-content:center;font-size:28px;background:#fff;border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.08);position:relative;margin:-28px 0 0 16px;overflow:hidden;z-index:1;}
.mp-sc-avl img{width:100%;height:100%;object-fit:cover;}
.mp-sc-body{padding:10px 14px 14px;}
.mp-sc-nm{font-size:16px;font-weight:700;}
.mp-sc-desc{font-size:12px;color:var(--mp-txt-l);margin-top:3px;line-height:1.5;}
.mp-sc-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px;}
.mp-tag{font-size:10px;padding:2px 8px;border-radius:10px;background:rgba(244,143,177,.1);color:var(--mp-pink-dk);font-weight:500;}
.mp-sc-stats{display:flex;gap:14px;margin-top:10px;flex-wrap:wrap;}
.mp-stat{text-align:center;min-width:48px;}
.mp-stat-v{font-size:16px;font-weight:700;color:var(--mp-pink-dk);}
.mp-stat-lb{font-size:10px;color:var(--mp-txt-l);margin-top:1px;}
.mp-sec{margin-top:12px;padding:10px 12px;background:rgba(244,143,177,.05);border-radius:var(--mp-rs);border:1px solid rgba(244,143,177,.1);}
.mp-sec-t{font-size:11px;font-weight:700;color:var(--mp-pink);margin-bottom:6px;display:flex;align-items:center;gap:4px;}
.mp-sec-ct{font-size:12px;line-height:1.6;color:var(--mp-txt);}
.mp-sec-row{display:flex;justify-content:space-between;margin-bottom:3px;font-size:12px;}
.mp-sec-row span:last-child{font-weight:600;}
.mp-mem{padding:8px 0;border-bottom:1px solid rgba(244,143,177,.08);font-size:12px;line-height:1.5;}
.mp-mem:last-child{border-bottom:none;}
.mp-mem-d{font-size:10px;color:var(--mp-txt-l);margin-top:2px;}
.mp-gbtn{display:inline-flex;align-items:center;gap:4px;margin-top:6px;padding:5px 12px;background:linear-gradient(135deg,#f48fb1,#e91e63);color:#fff;border:none;border-radius:14px;font-size:11px;font-weight:600;cursor:pointer;font-family:var(--mp-font);transition:transform .12s;}
.mp-gbtn:active{transform:scale(.94);}.mp-gbtn:disabled{opacity:.5;cursor:default;}
.mp-tl{position:relative;padding-left:16px;}
.mp-tl::before{content:'';position:absolute;left:4px;top:4px;bottom:4px;width:2px;background:rgba(244,143,177,.2);border-radius:1px;}
.mp-tl-dot{position:absolute;left:0;width:10px;height:10px;border-radius:50%;background:var(--mp-pink);border:2px solid #fff;}
.mp-tl-item{position:relative;padding:4px 0 10px 8px;}
.mp-persona{font-size:12px;line-height:1.6;color:var(--mp-txt);white-space:pre-wrap;max-height:120px;overflow-y:auto;}
.mp-persona::-webkit-scrollbar{display:none;}
.mp-set{flex:1;overflow-y:auto;padding:10px 14px 90px;}.mp-set::-webkit-scrollbar{display:none;}
.mp-sg{background:var(--mp-glass);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid var(--mp-glass-b);border-radius:var(--mp-r);padding:14px;margin-bottom:10px;}
.mp-sg-t{font-size:12px;font-weight:700;color:var(--mp-pink);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;}
.mp-row{margin-bottom:8px;}
.mp-lbl{font-size:11px;font-weight:600;color:var(--mp-txt-l);margin-bottom:3px;}
.mp-sinp{width:100%;padding:7px 10px;border:1px solid rgba(244,143,177,.18);border-radius:var(--mp-rx);font-size:12px;font-family:var(--mp-font);background:rgba(255,255,255,.55);color:var(--mp-txt);outline:none;}
.mp-sinp:focus{border-color:var(--mp-pink);}
.mp-ssel{width:100%;padding:7px 10px;border:1px solid rgba(244,143,177,.18);border-radius:var(--mp-rx);font-size:12px;font-family:var(--mp-font);background:rgba(255,255,255,.55);color:var(--mp-txt);outline:none;cursor:pointer;}
.mp-save{width:100%;padding:10px;background:linear-gradient(135deg,#f48fb1,#e91e63);color:#fff;border:none;border-radius:var(--mp-rs);font-size:13px;font-weight:600;font-family:var(--mp-font);cursor:pointer;transition:transform .12s;}
.mp-save:active{transform:scale(.97);}
.mp-overlay{position:absolute;inset:0;z-index:70;background:rgba(0,0,0,.28);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;animation:mpFi .18s;}
@keyframes mpFi{from{opacity:0}to{opacity:1}}
.mp-modal{width:88%;max-height:75%;background:rgba(255,255,255,.95);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border-radius:var(--mp-r);padding:18px;overflow-y:auto;box-shadow:0 16px 50px rgba(0,0,0,.13);}
.mp-modal::-webkit-scrollbar{display:none;}
.mp-modal-t{font-size:16px;font-weight:700;margin-bottom:14px;font-family:var(--mp-fontd);}
.mp-ta{width:100%;min-height:70px;padding:7px 10px;border:1px solid rgba(244,143,177,.18);border-radius:var(--mp-rx);font-size:12px;font-family:var(--mp-font);background:rgba(255,255,255,.55);color:var(--mp-txt);outline:none;resize:vertical;}
.mp-ta:focus{border-color:var(--mp-pink);}
.mp-tabs{display:flex;gap:4px;margin-bottom:12px;}
.mp-tab{flex:1;padding:8px;text-align:center;font-size:12px;font-weight:600;border-radius:10px;cursor:pointer;transition:background .12s;border:1px solid rgba(244,143,177,.15);background:rgba(255,255,255,.3);font-family:var(--mp-font);color:var(--mp-txt);}
.mp-tab.active{background:linear-gradient(135deg,#f48fb1,#e91e63);color:#fff;border-color:transparent;}
.mp-drop{width:100%;padding:24px 16px;border:2px dashed rgba(244,143,177,.3);border-radius:var(--mp-r);text-align:center;cursor:pointer;transition:background .12s;background:rgba(244,143,177,.04);margin-bottom:10px;}
.mp-drop:hover{background:rgba(244,143,177,.08);}
.mp-drop-icon{font-size:32px;margin-bottom:6px;}
.mp-drop-text{font-size:12px;color:var(--mp-txt-l);}
.mp-toast{position:absolute;top:50px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.72);color:#fff;padding:7px 18px;border-radius:18px;font-size:12px;font-weight:500;z-index:200;animation:mpToast 2s ease-in-out forwards;}
@keyframes mpToast{0%{opacity:0;transform:translateX(-50%) translateY(-8px)}15%{opacity:1;transform:translateX(-50%) translateY(0)}85%{opacity:1}100%{opacity:0}}
.mp-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:36px 18px;text-align:center;color:var(--mp-txt-l);}
.mp-empty-i{font-size:44px;margin-bottom:10px;}
.mp-empty-t{font-size:13px;line-height:1.6;}
.mp-ibtn{background:rgba(244,143,177,.12);border:1px solid rgba(244,143,177,.18);border-radius:8px;padding:3px 9px;font-size:10px;cursor:pointer;color:var(--mp-pink-dk);font-weight:600;font-family:var(--mp-font);}
.mp-ibtn-hidden{visibility:hidden;}
.mp-ibtn-r{padding:6px 10px;background:rgba(244,67,54,.06);border:1px solid rgba(244,67,54,.12);border-radius:8px;font-size:11px;cursor:pointer;font-family:var(--mp-font);color:#e53935;}
.mp-ibtn-chat{flex:1;padding:7px;background:rgba(244,143,177,.08);border:1px solid rgba(244,143,177,.15);border-radius:8px;font-size:11px;cursor:pointer;font-family:var(--mp-font);color:var(--mp-txt);}
`;

// ============================================================
// Main Component
// ============================================================

export default css;

