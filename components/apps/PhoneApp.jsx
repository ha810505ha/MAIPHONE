import React from "react";
import { PHONE_APP_META, sanitizePhoneTheme, phoneWallpaperCss, mixHex } from "../../utils/phoneAppGen";

const AI_APP_PAGES = ["gallery", "music", "map", "shop", "diary", "browser", "usage"];

export default function PhoneApp({
  phoneViewCharId, setPhoneViewCharId, phonePage, setPhonePage, phoneActiveThreadId, setPhoneActiveThreadId,
  characters, chatHistory, phoneInboxCache, characterWallets, playerProfile, closeApp, t, tr, sanitizeUserImageUrl,
  renderAppIcon, phoneGenLoading, generatePhoneNpcChats, phonePlayerContactLoading, refreshPhonePlayerContact, walletGenLoading, generateCharacterWallet,
  regenerateCharacterWallet, formatMoney, displayWalletText, armAppClickSuppression, suppressAppClickUntilRef, gid,
  phoneAppCache, phoneAppGenLoading, generatePhoneApp, diaryPage, setDiaryPage,
}) {
    const selectedCharId = phoneViewCharId || null;
    const selectedChar = characters.find((c) => c.id === selectedCharId) || null;
    const playerMsgs = selectedChar ? (chatHistory[selectedChar.id] || []).slice(-20) : [];
    const npcThreads = selectedChar ? (phoneInboxCache[selectedChar.id]?.threads || []) : [];
    const playerContact = selectedChar ? (phoneInboxCache[selectedChar.id]?.playerContact || {}) : {};
    const playerBaseName = String(playerProfile?.nickname || playerProfile?.name || tr("你", "You", "あなた", "나")).trim();
    const playerContactName = playerContact.suffix ? `${playerBaseName}（${playerContact.suffix}）` : playerBaseName;
    const now = new Date();
    const phoneTime = now.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false });
    const phoneDate = now.toLocaleDateString("zh-TW", { month: "2-digit", day: "2-digit" });
    const allThreads = [
      {
        id: "player",
        name: playerContactName,
        relation: playerContact.note || selectedChar?.relationshipToUser || "",
        messages: playerMsgs.map((m, i) => ({
          id: `p-${i}-${m.id || gid()}`,
          from: m.role === "assistant" ? "char" : "other",
          text: m.content || "[圖片]",
          time: m.time || Date.now(),
        })),
      },
      ...npcThreads,
    ];
    const activeThread = allThreads.find((t) => t.id === phoneActiveThreadId) || allThreads[0] || null;
    const openDesktop = (charId) => {
    setPhoneViewCharId(charId);
    setPhoneActiveThreadId("player");
    setDiaryPage(0);
    armAppClickSuppression();
    setPhonePage("desktop");
  };
    const phoneWallet = selectedChar ? characterWallets[selectedChar.id] : null;
    // 共用主題：聊天列表/對話串/錢包頁的桌布與狀態列也跟著角色主題走
    const phTh = selectedChar ? sanitizePhoneTheme(phoneAppCache[selectedChar.id]?.theme?.data) : null;
    // 主題化的面板與按鈕樣式（聊天/錢包等舊頁面共用）
    const phPanel = phTh ? { background: phTh.card, border: `1px solid ${phTh.cardBorder}` } : {};
    const phBtn = phTh ? { background: phTh.card, border: `1px solid ${phTh.cardBorder}`, color: phTh.text } : {};
    const inImmersivePhone = ["desktop", "chatlist", "thread", "wallet", ...AI_APP_PAGES].includes(phonePage);
    return (
      <div className="mp-page" style={inImmersivePhone ? { padding: 0 } : undefined}>
        {!inImmersivePhone && (
          <div className="mp-hdr">
            <div className="mp-back" onClick={closeApp}>←</div>
            <div className="mp-htitle">{t("phone")}</div>
          </div>
        )}
        <div className="mp-cm" style={inImmersivePhone ? { padding: 0 } : undefined}>
          {characters.length === 0 && <div className="mp-empty"><div className="mp-empty-i">📱</div><div className="mp-empty-t">{t("characters")} {t("phone")}</div></div>}
          {characters.length > 0 && !inImmersivePhone && (
            <div className="mp-sc" style={{padding:12}}>
              <div style={{fontWeight:700,fontSize:14,marginBottom:8}}>{t("contactsHint")}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr",gap:8}}>
                {characters.map((c) => (
                  <button key={c.id} className="mp-cc" style={{textAlign:"left",background:"#fff"}} onClick={(e) => { e.stopPropagation(); armAppClickSuppression(); openDesktop(c.id); }}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div className="mp-av">{sanitizeUserImageUrl(c.avatar)?<img src={sanitizeUserImageUrl(c.avatar)} alt=""/>:"🦊"}</div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700,fontSize:13}}>{c.name}</div>
                        <div style={{fontSize:11,color:"var(--mp-txt-l)"}}>{t("contactsHint")}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {characters.length > 0 && selectedChar && phonePage === "desktop" && (() => {
            const th = sanitizePhoneTheme(phoneAppCache[selectedChar.id]?.theme?.data);
            const homeMusic = phoneAppCache[selectedChar.id]?.music?.data?.nowPlaying || th.music;
            const cardS = { background: th.card, border: `1px solid ${th.cardBorder}`, borderRadius: 16 };
            const openApp = (page) => (e) => { e.stopPropagation(); armAppClickSuppression(); setPhonePage(page); };
            const appTile = (icon, label, page, locked) => (
              <button key={label} className="mp-icon" disabled={locked} onClick={locked ? undefined : openApp(page)}
                style={{ background: "transparent", border: "none", padding: 0, opacity: locked ? .45 : 1 }}>
                <div className="mp-icon-c" style={{ fontSize: 26, background: th.card, borderColor: th.cardBorder }}>{icon}</div>
                <span className="mp-icon-l" style={{ color: th.textSub }}>{locked ? "🔒" : label}</span>
              </button>
            );
            return (
              <div style={{ position: "relative", height: "100%", minHeight: 640, background: phoneWallpaperCss(th), padding: "14px 14px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
                <button className="mp-back" style={{ position: "absolute", left: 12, top: 12, zIndex: 5 }} onClick={closeApp}>←</button>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, color: th.textSub, fontSize: 13, padding: "2px 8px 0 56px" }}>
                  <span>{phoneTime}</span><span>{phoneDate}</span>
                </div>

                {/* 時鐘小工具 */}
                <div style={{ ...cardS, borderRadius: 18, padding: "12px 16px" }}>
                  <div style={{ fontSize: 36, fontWeight: 900, color: th.text, fontFamily: "var(--mp-fontd)", letterSpacing: 1 }}>{phoneTime}</div>
                  <div style={{ fontSize: 11, color: th.textSub, marginTop: 2 }}>
                    {now.toLocaleDateString("zh-TW", { month: "long", day: "numeric", weekday: "long" })} · {selectedChar.name}的手機{th.themeName !== "預設" ? ` · ${th.themeName}` : ""}
                  </div>
                </div>

                {/* 狀態一句話 */}
                <div style={{ ...cardS, borderRadius: 14, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="mp-av" style={{ width: 30, height: 30, flex: "none", background: th.accent, color: "#fff", fontSize: 13, fontWeight: 700 }}>
                    {sanitizeUserImageUrl(selectedChar.avatar) ? <img src={sanitizeUserImageUrl(selectedChar.avatar)} alt="" /> : (selectedChar.name?.[0] || "🙂")}
                  </div>
                  <div style={{ fontSize: 12, color: th.text, lineHeight: 1.5, flex: 1 }}>
                    {th.status || tr("尚未生成主題", "Theme not generated yet", "テーマ未生成", "테마 미생성")}
                  </div>
                </div>

                {/* 音樂 + 待辦（備忘錄） */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <button style={{ ...cardS, padding: 12, textAlign: "left", cursor: "pointer", font: "inherit" }} onClick={openApp("music")}>
                    <div style={{ fontSize: 10, color: th.accent, fontWeight: 700 }}>♪ {tr("正在播放", "Now playing", "再生中", "재생 중")}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: th.text, marginTop: 6 }}>{homeMusic?.title || "—"}</div>
                    <div style={{ fontSize: 10, color: th.textSub }}>{homeMusic?.artist || ""}</div>
                    <div style={{ height: 3, borderRadius: 99, background: th.cardBorder, marginTop: 10 }}>
                      <div style={{ width: "38%", height: "100%", borderRadius: 99, background: th.accent }} />
                    </div>
                  </button>
                  <div style={{ ...cardS, padding: 12, display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ fontSize: 10, color: th.accent, fontWeight: 700 }}>{tr("待辦", "To-do", "やること", "할 일")}</div>
                    {th.todos.length === 0 && <div style={{ fontSize: 11, color: th.textSub }}>—</div>}
                    {th.todos.map((td, i) => (
                      <div key={i} style={{ fontSize: 11, color: td.done ? th.textSub : th.text, textDecoration: td.done ? "line-through" : "none" }}>
                        {td.done ? "☑" : "☐"} {td.text}
                      </div>
                    ))}
                  </div>
                </div>

                {/* App 格：聊天/錢包 + AI App×7 + 鎖定 App */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 10, marginTop: 2 }}>
                  <button className="mp-icon" style={{ background: "transparent", border: "none", padding: 0 }} onClick={openApp("chatlist")}>
                    <div className="mp-icon-c mp-icon-c-img" style={{ background: th.card, borderColor: th.cardBorder }}>{renderAppIcon({ id: "chat", name: "聊天", icon: "💬", iconUrl: "./app-icons/chat.png?v=1.1.5" }, 44)}</div>
                    <span className="mp-icon-l" style={{ color: th.textSub }}>{t("chat")}</span>
                  </button>
                  <button className="mp-icon" style={{ background: "transparent", border: "none", padding: 0 }} onClick={openApp("wallet")}>
                    <div className="mp-icon-c mp-icon-c-img" style={{ background: th.card, borderColor: th.cardBorder }}>{renderAppIcon({ id: "wallet", name: "錢包", icon: "💳", iconUrl: "./app-icons/wallet.png?v=1.1.5" }, 44)}</div>
                    <span className="mp-icon-l" style={{ color: th.textSub }}>{t("wallet")}</span>
                  </button>
                  {appTile("🖼️", tr("相簿", "Gallery", "アルバム", "앨범"), "gallery", false)}
                  {appTile("🎧", tr("音樂", "Music", "音楽", "음악"), "music", false)}
                  {appTile("🗺️", tr("地圖", "Map", "マップ", "지도"), "map", false)}
                  {appTile("🛍️", tr("商店", "Shop", "ショップ", "상점"), "shop", false)}
                  {appTile("📔", tr("日記", "Diary", "日記", "일기"), "diary", false)}
                  {appTile("🧭", tr("瀏覽器", "Browser", "ブラウザ", "브라우저"), "browser", false)}
                  {appTile("⏱️", tr("使用紀錄", "Screen Time", "使用履歴", "사용 기록"), "usage", false)}
                  {appTile("📷", tr("相機", "Camera", "カメラ", "카메라"), null, true)}
                  {appTile("⚙️", t("settings"), null, true)}
                </div>

                {/* 底部操作列 */}
                <div style={{ marginTop: "auto", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <button className="mp-ibtn" onClick={openApp("picker")}>{t("switchRole")}</button>
                  <button className="mp-ibtn" disabled={phoneAppGenLoading === "theme"} onClick={() => generatePhoneApp(selectedChar, "theme")}>
                    {phoneAppGenLoading === "theme" ? t("loading") : (phoneAppCache[selectedChar.id]?.theme ? tr("刷新主題", "Refresh theme", "テーマ更新", "테마 새로고침") : tr("✦ 生成主題", "✦ Generate theme", "✦ テーマ生成", "✦ 테마 생성"))}
                  </button>
                </div>
                <div style={{ position: "absolute", left: "50%", bottom: 10, transform: "translateX(-50%)", width: 120, height: 5, borderRadius: 999, background: "rgba(28,44,55,.3)" }} />
              </div>
            );
          })()}
          {characters.length > 0 && selectedChar && phonePage === "wallet" && (
            <div style={{position:"relative",height:"100%",minHeight:640,background:phoneWallpaperCss(phTh),padding:"14px 10px 24px"}}>
              <button className="mp-back" style={{position:"absolute",left:12,top:12,zIndex:5}} onClick={closeApp}>←</button>
              <div style={{padding:"2px 8px 0 56px",display:"flex",justifyContent:"space-between",fontWeight:700,color:phTh.textSub,fontSize:13}}>
                <span>{phoneTime}</span><span>{phoneDate}</span>
              </div>
              <div className="mp-sc" style={{padding:10,marginTop:12,...phPanel}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <button className="mp-ibtn" style={phBtn} onClick={(e) => { e.stopPropagation(); armAppClickSuppression(); setPhonePage("desktop"); }}>{t("backToDesktop")}</button>
                <div style={{fontWeight:700,fontSize:13,color:phTh.text}}>{selectedChar.name} {t("wallet")}</div>
                </div>
                {!phoneWallet ? (
                  <div>
                    <div style={{fontSize:12,color:phTh.textSub,lineHeight:1.7}}>{tr("尚未生成角色錢包。", "This character wallet hasn't been generated yet.", "まだキャラクターのウォレットが生成されていません。", "아직 캐릭터 지갑이 생성되지 않았습니다.")}</div>
                    <button className="mp-save" style={{marginTop:10}} disabled={walletGenLoading} onClick={() => generateCharacterWallet(selectedChar)}>{walletGenLoading ? t("generating") : t("generate")}</button>
                  </div>
                ) : (
                  <>
                    <div style={{fontSize:12,color:phTh.textSub}}>{tr("可用餘額", "Available balance", "利用可能残高", "사용 가능 잔액")}</div>
                    <div style={{fontSize:30,fontWeight:900,margin:"2px 0 6px",color:phTh.text}}>${formatMoney(phoneWallet.balance || 0)}</div>
                    {phoneWallet.summary && <div style={{fontSize:12,color:phTh.textSub,lineHeight:1.6,marginBottom:10}}>{displayWalletText(phoneWallet.summary)}</div>}
                    <div style={{display:"flex",gap:8,marginBottom:10}}>
                      <button className="mp-ibtn" style={{...phBtn,flex:1}} disabled={walletGenLoading} onClick={() => generateCharacterWallet(selectedChar, { mode: "refresh" })}>{walletGenLoading ? t("loading") : t("refreshWallet")}</button>
                      <button className="mp-ibtn" style={{...phBtn,flex:1}} disabled={walletGenLoading} onClick={() => regenerateCharacterWallet(selectedChar)}>{walletGenLoading ? t("updating") : t("generate")}</button>
                    </div>
                    <div style={{fontSize:13,fontWeight:800,marginBottom:6,color:phTh.text}}>{tr("近期流水", "Recent transactions", "最近の取引", "최근 거래")}</div>
                    <div style={{display:"grid",gap:8,maxHeight:360,overflowY:"auto"}}>
                      {(phoneWallet.transactions || []).slice(0, 12).map((t) => (
                        <div key={t.id} style={{display:"flex",justifyContent:"space-between",gap:8,fontSize:12,padding:"7px 9px",borderRadius:10,background:"rgba(255,255,255,.62)"}}>
                          <div>
                            <div>{displayWalletText(t.note)}</div>
                            <div style={{fontSize:10,color:"var(--mp-txt-l)"}}>{new Date(t.time).toLocaleString("zh-TW")}</div>
                          </div>
                          <div style={{fontWeight:800,color:t.type==="expense"?"#e53935":"#2e7d32"}}>{t.type==="expense"?"-":"+"}{formatMoney(t.amount)}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          {characters.length > 0 && selectedChar && phonePage === "chatlist" && (
            <div style={{position:"relative",height:"100%",minHeight:640,background:phoneWallpaperCss(phTh),padding:"14px 10px 24px"}}>
              <button className="mp-back" style={{position:"absolute",left:12,top:12,zIndex:5}} onClick={closeApp}>←</button>
              <div style={{padding:"2px 8px 0 56px",display:"flex",justifyContent:"space-between",fontWeight:700,color:phTh.textSub,fontSize:13}}>
                <span>{phoneTime}</span><span>{phoneDate}</span>
              </div>
              <div className="mp-sc" style={{padding:10,marginTop:12,...phPanel}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <button className="mp-ibtn" style={phBtn} onClick={(e) => { e.stopPropagation(); armAppClickSuppression(); setPhonePage("desktop"); }}>{t("backToDesktop")}</button>
                <div style={{fontSize:12,color:phTh.textSub}}>{tr("只讀聊天列表", "Read-only chat list", "閲覧専用チャット一覧", "읽기 전용 채팅 목록")}</div>
                <button className="mp-ibtn" style={{...phBtn,marginLeft:"auto"}} disabled={phoneGenLoading} onClick={() => generatePhoneNpcChats(selectedChar)}>
                  {phoneGenLoading ? t("loading") : t("refreshOtherChats")}
                </button>
                <button className="mp-ibtn" style={phBtn} disabled={phonePlayerContactLoading} onClick={() => refreshPhonePlayerContact(selectedChar)}>
                  {phonePlayerContactLoading ? t("loading") : tr("刷新玩家聊天室", "Refresh player chat", "プレイヤーチャット更新", "플레이어 채팅 새로고침")}
                </button>
              </div>
              <div style={{fontSize:10,color:phTh.textSub,margin:"-2px 0 8px 2px"}}>
                {tr("快取：", "Cache: ", "キャッシュ: ", "캐시: ")}{phoneInboxCache[selectedChar.id]?.updatedAt ? new Date(phoneInboxCache[selectedChar.id].updatedAt).toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"}) : "--:--"}
              </div>
              <div style={{display:"grid",gap:8}}>
                {allThreads.map((t) => {
                  const last = (t.messages || [])[t.messages.length - 1];
                  return (
                    <button key={t.id} className="mp-cc" style={{textAlign:"left",background:"#fff"}} onClick={() => { if (Date.now() > suppressAppClickUntilRef.current) { setPhoneActiveThreadId(t.id); setPhonePage("thread"); } }}>
                      <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
                        <div style={{fontWeight:700,fontSize:13}}>{t.name}</div>
                        <div style={{fontSize:10,color:"var(--mp-txt-l)"}}>{last?.time ? new Date(last.time).toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"}) : ""}</div>
                      </div>
                      <div style={{fontSize:11,color:"var(--mp-txt-l)",marginTop:2}}>{t.relation || ""}</div>
                      <div style={{fontSize:11,color:"var(--mp-txt)",marginTop:5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{last?.text || tr("目前無訊息", "No messages yet", "まだメッセージがありません", "아직 메시지가 없습니다")}</div>
                    </button>
                  );
                })}
              </div>
              </div>
            </div>
          )}
          {characters.length > 0 && selectedChar && phonePage === "thread" && (
            <div style={{position:"relative",height:"100%",minHeight:640,background:phoneWallpaperCss(phTh),padding:"14px 10px 24px"}}>
              <button className="mp-back" style={{position:"absolute",left:12,top:12,zIndex:5}} onClick={closeApp}>←</button>
              <div style={{padding:"2px 8px 0 56px",display:"flex",justifyContent:"space-between",fontWeight:700,color:phTh.textSub,fontSize:13}}>
                <span>{phoneTime}</span><span>{phoneDate}</span>
              </div>
              <div className="mp-sc" style={{padding:10,marginTop:12,...phPanel}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <button className="mp-ibtn" style={phBtn} onClick={(e) => { e.stopPropagation(); armAppClickSuppression(); setPhonePage("chatlist"); }}>{t("backToList")}</button>
                <div style={{fontWeight:700,fontSize:13,color:phTh.text}}>{activeThread?.name || t("chatroom")}</div>
                <span style={{fontSize:10,color:phTh.textSub}}>{tr("唯讀", "Read only", "閲覧専用", "읽기 전용")}</span>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:430,overflowY:"auto",border:"1px solid var(--mp-border)",borderRadius:12,padding:8,background:"rgba(255,255,255,.45)"}}>
                {(activeThread?.messages || []).map((m) => (
                  <div key={m.id} style={{display:"flex",justifyContent:m.from==="char"?"flex-end":"flex-start"}}>
                    <div style={{maxWidth:"82%",fontSize:12,lineHeight:1.45,padding:"7px 10px",borderRadius:10,background:m.from==="char"?`linear-gradient(135deg, ${phTh.accent}cc, ${phTh.accent})`:"#fff",color:m.from==="char"?"#fff":"var(--mp-txt)",border:m.from==="char"?"none":"1px solid var(--mp-border)"}}>
                      {m.text}
                    </div>
                  </div>
                ))}
                {(!activeThread || (activeThread.messages || []).length === 0) && <div style={{fontSize:11,color:phTh.textSub,textAlign:"center"}}>{t("noMessages")}</div>}
              </div>
              </div>
            </div>
          )}
          {characters.length > 0 && selectedChar && AI_APP_PAGES.includes(phonePage) && (() => {
            const appId = phonePage;
            const th = sanitizePhoneTheme(phoneAppCache[selectedChar.id]?.theme?.data);
            const meta = PHONE_APP_META[appId];
            const cache = phoneAppCache[selectedChar.id]?.[appId] || null;
            const data = cache?.data || null;
            const busy = phoneAppGenLoading === appId;
            const cardS = { background: th.card, border: `1px solid ${th.cardBorder}` };

            return (
              <div style={{ position: "relative", height: "100%", minHeight: 640, background: phoneWallpaperCss(th), padding: "14px 14px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                <button className="mp-back" style={{ position: "absolute", left: 12, top: 12, zIndex: 5 }} onClick={closeApp}>←</button>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, color: th.textSub, fontSize: 13, padding: "2px 8px 0 56px" }}>
                  <span>{phoneTime}</span><span>{phoneDate}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button className="mp-ibtn" onClick={(e) => { e.stopPropagation(); armAppClickSuppression(); setPhonePage("desktop"); setDiaryPage(0); }}>{t("backToDesktop")}</button>
                  <div style={{ fontSize: 14, fontWeight: 900, color: th.text }}>{meta.icon} {meta.name}</div>
                </div>

                {/* ===== 空狀態：無快取，等玩家按生成 ===== */}
                {!data && (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, textAlign: "center", padding: "0 20px" }}>
                    <div style={{ ...cardS, width: 76, height: 76, borderRadius: 22, display: "grid", placeItems: "center", fontSize: 36 }}>{meta.icon}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: th.text }}>{tr("還沒有內容", "Nothing here yet", "まだ何もありません", "아직 내용이 없습니다")}</div>
                    <div style={{ fontSize: 11.5, color: th.textSub, lineHeight: 1.8 }}>
                      {tr(`按下生成，讓 AI 依 ${selectedChar.name} 的人設佈置${meta.name}`, `Tap generate and AI will fill this app in ${selectedChar.name}'s style`, `生成を押すと ${selectedChar.name} らしく埋めます`, `생성을 누르면 ${selectedChar.name}답게 채워줍니다`)}
                    </div>
                    <button className="mp-save" style={{ background: th.accent, marginTop: 6 }} disabled={busy} onClick={() => generatePhoneApp(selectedChar, appId)}>
                      {busy ? t("generating") : `✦ ${t("generate")}${meta.name}`}
                    </button>
                    <div style={{ fontSize: 10, color: th.textSub, opacity: .8, lineHeight: 1.7 }}>
                      {tr("只在按下時呼叫 AI・生成後存快取，不會自動刷新", "AI runs only when you tap · cached afterwards", "押した時だけAIを呼び、以後はキャッシュ表示", "누를 때만 AI 호출 · 이후 캐시 표시")}
                    </div>
                  </div>
                )}

                {/* ===== 相簿 ===== */}
                {data && appId === "gallery" && (
                  <div style={{ flex: 1, overflowY: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignContent: "start" }}>
                    {data.photos.map((p, i) => (
                      <div key={i} style={{ ...cardS, borderRadius: 10, padding: 6 }}>
                        <div style={{ height: 88, borderRadius: 6, background: `linear-gradient(150deg, ${p.tone}, ${mixHex(p.tone, th.mode === "dark" ? "#000000" : "#ffffff")})` }} />
                        <div style={{ fontSize: 10, color: th.text, marginTop: 6 }}>{p.caption}</div>
                        <div style={{ fontSize: 9, color: th.textSub }}>{p.time}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ===== 音樂 ===== */}
                {data && appId === "music" && (
                  <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                    {data.nowPlaying && (
                      <div style={{ ...cardS, borderRadius: 18, padding: 16, textAlign: "center" }}>
                        <div style={{ width: 110, height: 110, margin: "0 auto", borderRadius: 14, background: `linear-gradient(150deg, ${th.accent}44, ${th.accent}11)`, display: "grid", placeItems: "center", fontSize: 38 }}>🎧</div>
                        <div style={{ fontSize: 15, fontWeight: 900, color: th.text, marginTop: 12 }}>{data.nowPlaying.title}</div>
                        <div style={{ fontSize: 11, color: th.textSub, marginTop: 2 }}>{data.nowPlaying.artist}</div>
                        <div style={{ height: 3, borderRadius: 99, background: th.cardBorder, marginTop: 12 }}>
                          <div style={{ width: `${Math.round(data.nowPlaying.progress * 100)}%`, height: "100%", borderRadius: 99, background: th.accent }} />
                        </div>
                      </div>
                    )}
                    <div style={{ fontSize: 11, fontWeight: 700, color: th.textSub, letterSpacing: 1 }}>{selectedChar.name}{tr("的歌單", "'s playlist", "のプレイリスト", "의 플레이리스트")}</div>
                    {data.playlist.map((s, i) => (
                      <div key={i} style={{ ...cardS, borderRadius: 10, padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div><div style={{ fontSize: 11.5, color: th.text, fontWeight: 700 }}>{s.title}</div><div style={{ fontSize: 9.5, color: th.textSub }}>{s.artist}</div></div>
                        <span style={{ fontSize: 10, color: th.textSub }}>{s.length}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* ===== 地圖 ===== */}
                {data && appId === "map" && (
                  <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ height: 150, borderRadius: 16, border: `1px solid ${th.cardBorder}`, position: "relative", overflow: "hidden",
                      background: `repeating-linear-gradient(0deg, ${th.cardBorder} 0 1px, transparent 1px 26px), repeating-linear-gradient(90deg, ${th.cardBorder} 0 1px, transparent 1px 26px), ${th.card}` }}>
                      {data.places.slice(0, 3).map((p, i) => (
                        <div key={i} style={{ position: "absolute", top: [34, 92, 60][i], left: [52, 170, 110][i], width: 10, height: 10, borderRadius: "50%", background: th.accent, boxShadow: `0 0 0 5px ${th.accent}38` }} />
                      ))}
                      <div style={{ position: "absolute", bottom: 6, right: 10, fontSize: 9, color: th.textSub, fontFamily: "monospace" }}>{tr("示意足跡", "footprints (illustrative)", "足跡イメージ", "발자취(예시)")}</div>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: th.textSub, letterSpacing: 1 }}>{tr("常去地點", "Frequent places", "よく行く場所", "자주 가는 곳")}</div>
                    {data.places.map((p, i) => (
                      <div key={i} style={{ ...cardS, borderRadius: 10, padding: "9px 12px", display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 16 }}>{p.emoji}</span>
                        <div><div style={{ fontSize: 11.5, color: th.text, fontWeight: 700 }}>{p.name}</div><div style={{ fontSize: 9.5, color: th.textSub }}>{p.note}</div></div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ===== 商店 ===== */}
                {data && appId === "shop" && (
                  <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: th.textSub, letterSpacing: 1 }}>{tr("最近訂單", "Recent orders", "最近の注文", "최근 주문")}</div>
                    {data.orders.map((o) => (
                      <div key={o.id} style={{ ...cardS, borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 18 }}>{o.emoji}</span>
                        <div style={{ flex: 1 }}><div style={{ fontSize: 11.5, color: th.text, fontWeight: 700 }}>{o.item}</div><div style={{ fontSize: 9.5, color: th.textSub }}>{o.date}</div></div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 11.5, color: th.text, fontWeight: 700 }}>${formatMoney(o.price)}</div>
                          <div style={{ fontSize: 9, color: o.status === "shipping" ? "#E6B45A" : "#6FBF8E" }}>{o.status === "shipping" ? tr("配送中", "Shipping", "配送中", "배송 중") : tr("已送達", "Delivered", "配達済み", "배송 완료")}</div>
                        </div>
                      </div>
                    ))}
                    <div style={{ fontSize: 10, color: th.textSub, lineHeight: 1.7, padding: "4px 2px" }}>
                      {characterWallets[selectedChar.id]
                        ? tr("訂單已同步到錢包流水", "Orders synced to wallet", "注文はウォレットに同期済み", "주문이 지갑에 동기화됨")
                        : tr("角色錢包尚未生成，訂單暫未寫入流水；生成錢包後刷新商店即可同步", "Wallet not generated yet; refresh shop after generating it to sync", "ウォレット未生成のため未同期。生成後にショップを更新してください", "지갑 미생성 상태. 지갑 생성 후 상점을 새로고침하면 동기화됩니다")}
                    </div>
                  </div>
                )}

                {/* ===== 日記（追加式，自帶頁碼與「寫新的一篇」） ===== */}
                {data && appId === "diary" && (() => {
                  const entries = data.entries || [];
                  const cur = entries[Math.min(diaryPage, entries.length - 1)];
                  return (
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, overflow: "hidden" }}>
                      <div style={{ flex: 1, overflowY: "auto", background: "#F3EEE2", borderRadius: 12, padding: "18px 16px", boxShadow: "inset 0 0 30px rgba(120,100,60,.12)", position: "relative" }}>
                        <div style={{ position: "absolute", top: 10, left: 14, fontSize: 16, transform: "rotate(-12deg)" }}>🖇️</div>
                        <div style={{ fontSize: 10, color: "#A89A7E", textAlign: "right" }}>{new Date(cur.time).toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</div>
                        <div style={{ fontSize: 13, fontWeight: 900, color: "#4A4336", marginTop: 8 }}>{cur.title}</div>
                        <div style={{ fontSize: 11.5, color: "#5C5546", lineHeight: 2.1, marginTop: 12, whiteSpace: "pre-wrap" }}>{cur.body}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          {entries.map((e, i) => (
                            <button key={e.id} onClick={() => setDiaryPage(i)} style={{ width: 10, height: 10, padding: 0, border: "none", borderRadius: "50%", cursor: "pointer", background: i === diaryPage ? th.accent : th.cardBorder }} />
                          ))}
                        </div>
                        <span style={{ fontSize: 10, color: th.textSub }}>{diaryPage + 1} / {entries.length} 篇</span>
                        <button className="mp-ibtn" style={{ marginLeft: "auto", color: th.accent, borderColor: `${th.accent}66` }} disabled={busy}
                          onClick={() => generatePhoneApp(selectedChar, "diary")}>
                          {busy ? t("loading") : tr("✦ 寫新的一篇", "✦ New entry", "✦ 新しいページ", "✦ 새 일기")}
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* ===== 瀏覽器 ===== */}
                {data && appId === "browser" && (
                  <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ ...cardS, borderRadius: 99, padding: "9px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12 }}>🔍</span><span style={{ fontSize: 11, color: th.textSub }}>{tr("搜尋或輸入網址", "Search or enter URL", "検索またはURL", "검색 또는 URL 입력")}</span>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: th.textSub, letterSpacing: 1, margin: "6px 0 2px" }}>{tr("搜尋紀錄", "Search history", "検索履歴", "검색 기록")}</div>
                    {data.searches.map((s, i) => (
                      <div key={i} style={{ ...cardS, borderRadius: 10, padding: "9px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11.5, color: th.text }}>{s.query}</span>
                        <span style={{ fontSize: 9.5, color: th.textSub }}>{s.time}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* ===== 使用紀錄 ===== */}
                {data && appId === "usage" && (
                  <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ ...cardS, borderRadius: 16, padding: "14px 16px" }}>
                      <div style={{ fontSize: 10, color: th.textSub }}>{tr("今日螢幕時間", "Screen time today", "本日の使用時間", "오늘 스크린 타임")}</div>
                      <div style={{ fontSize: 30, fontWeight: 900, color: th.text, fontFamily: "var(--mp-fontd)", marginTop: 4 }}>
                        {Math.floor(data.totalMinutes / 60)}<span style={{ fontSize: 14 }}>{tr("小時", "h", "時間", "시간")}</span>{data.totalMinutes % 60}<span style={{ fontSize: 14 }}>{tr("分", "m", "分", "분")}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 44, marginTop: 12 }}>
                        {data.hourly.map((v, i) => {
                          const max = Math.max(...data.hourly, 1);
                          return <div key={i} style={{ flex: 1, height: `${Math.max(4, (v / max) * 100)}%`, background: v >= max * 0.7 ? th.accent : th.cardBorder, borderRadius: "3px 3px 0 0" }} />;
                        })}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8.5, color: th.textSub, marginTop: 4 }}><span>0</span><span>6</span><span>12</span><span>18</span><span>24</span></div>
                      {data.summary && <div style={{ fontSize: 10, color: th.textSub, marginTop: 8 }}>{data.summary}</div>}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: th.textSub, letterSpacing: 1 }}>{tr("App 使用排行", "Top apps", "アプリ別", "앱 사용 순위")}</div>
                    {data.apps.map((a, i) => {
                      const maxM = Math.max(...data.apps.map((x) => x.minutes), 1);
                      return (
                        <div key={i} style={{ ...cardS, borderRadius: 10, padding: "8px 12px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
                            <span style={{ color: th.text }}>{a.icon} {a.name}</span><span style={{ color: th.textSub }}>{a.minutes} {tr("分", "min", "分", "분")}</span>
                          </div>
                          <div style={{ height: 3, borderRadius: 99, background: th.cardBorder, marginTop: 6 }}>
                            <div style={{ width: `${Math.round((a.minutes / maxM) * 100)}%`, height: "100%", borderRadius: 99, background: th.accent }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ===== 快取列 + 刷新（日記除外——它有自己的「寫新的一篇」） ===== */}
                {data && appId !== "diary" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 10, color: th.textSub }}>
                      {tr("快取 ", "Cache ", "キャッシュ ", "캐시 ")}{cache?.updatedAt ? new Date(cache.updatedAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
                    </span>
                    <button className="mp-ibtn" style={{ marginLeft: "auto", color: th.accent, borderColor: `${th.accent}66` }} disabled={busy} onClick={() => generatePhoneApp(selectedChar, appId)}>
                      {busy ? t("loading") : `↻ ${t("refresh")}${meta.name}`}
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    );
}
