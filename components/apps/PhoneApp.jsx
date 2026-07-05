import React from "react";

export default function PhoneApp({
  phoneViewCharId, setPhoneViewCharId, phonePage, setPhonePage, phoneActiveThreadId, setPhoneActiveThreadId,
  characters, chatHistory, phoneInboxCache, characterWallets, closeApp, t, tr, sanitizeUserImageUrl,
  renderAppIcon, phoneGenLoading, generatePhoneNpcChats, walletGenLoading, generateCharacterWallet,
  regenerateCharacterWallet, formatMoney, displayWalletText, armAppClickSuppression, suppressAppClickUntilRef, gid,
}) {
    const selectedCharId = phoneViewCharId || null;
    const selectedChar = characters.find((c) => c.id === selectedCharId) || null;
    const playerMsgs = selectedChar ? (chatHistory[selectedChar.id] || []).slice(-20) : [];
    const npcThreads = selectedChar ? (phoneInboxCache[selectedChar.id]?.threads || []) : [];
    const now = new Date();
    const phoneTime = now.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false });
    const phoneDate = now.toLocaleDateString("zh-TW", { month: "2-digit", day: "2-digit" });
    const allThreads = [
      {
        id: "player",
        name: "你",
        relation: "玩家",
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
    armAppClickSuppression();
    setPhonePage("desktop");
  };
    const phoneWallet = selectedChar ? characterWallets[selectedChar.id] : null;
    const inImmersivePhone = phonePage === "desktop" || phonePage === "chatlist" || phonePage === "thread" || phonePage === "wallet";
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
          {characters.length > 0 && phonePage !== "desktop" && phonePage !== "chatlist" && phonePage !== "thread" && phonePage !== "wallet" && (
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
          {characters.length > 0 && selectedChar && phonePage === "desktop" && (
            <div style={{position:"relative",height:"100%",minHeight:640,background:"linear-gradient(180deg,#ffd2e6 0%,#d1ecff 100%)",padding:"14px 14px 24px"}}>
              <button className="mp-back" style={{position:"absolute",left:12,top:12,zIndex:5}} onClick={closeApp}>←</button>
              <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,color:"#29485d",fontSize:13,padding:"2px 8px 0 56px"}}>
                <span>{phoneTime}</span>
                <span>{phoneDate}</span>
              </div>
              <div style={{marginTop:14,background:"rgba(255,255,255,.45)",borderRadius:14,padding:"10px 12px"}}>
            <div style={{fontSize:12,color:"#39596e"}}>{selectedChar.name} {t("phone")}</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:12,marginTop:16}}>
                <button className="mp-icon" style={{background:"rgba(255,255,255,.62)"}} onClick={(e) => { e.stopPropagation(); armAppClickSuppression(); setPhonePage("chatlist"); }}>
                  <div className="mp-icon-c mp-icon-c-img">{renderAppIcon({ id: "chat", name: "聊天", icon: "💬", iconUrl: "./app-icons/chat.png?v=1.1.5" }, 56)}</div>
                  <span className="mp-icon-l">{t("chat")}</span>
                </button>
                <button className="mp-icon" style={{background:"rgba(255,255,255,.62)"}} onClick={(e) => { e.stopPropagation(); armAppClickSuppression(); setPhonePage("wallet"); }}>
                  <div className="mp-icon-c mp-icon-c-img">{renderAppIcon({ id: "wallet", name: "錢包", icon: "💳", iconUrl: "./app-icons/wallet.png?v=1.1.5" }, 56)}</div>
                  <span className="mp-icon-l">{t("wallet")}</span>
                </button>
                {[
                  { icon: "📷", label: tr("相機", "Camera", "カメラ", "카메라") },
                  { icon: "⚙️", label: t("settings") },
                ].map((item, idx) => (
                  <div key={idx} className="mp-icon" style={{opacity:.45,background:"rgba(255,255,255,.45)"}}>
                    <div className="mp-icon-c">{renderAppIcon({ name: item.label, icon: item.icon })}</div>
                    <span className="mp-icon-l">🔒</span>
                  </div>
                ))}
              </div>
              <div style={{marginTop:18,display:"flex",gap:6}}>
                <button className="mp-ibtn" onClick={(e) => { e.stopPropagation(); armAppClickSuppression(); setPhonePage("picker"); }}>{tr("換角色", "Switch character", "キャラを切り替え", "캐릭터 전환")}</button>
                <button className="mp-ibtn" disabled={phoneGenLoading} onClick={() => generatePhoneNpcChats(selectedChar)}>
                  {phoneGenLoading ? t("loading") : t("refreshOtherChats")}
                </button>
                <span style={{fontSize:10,color:"#5f7f93",marginLeft:"auto",alignSelf:"center"}}>
                  {tr("快取：", "Cache: ", "キャッシュ: ", "캐시: ")}{phoneInboxCache[selectedChar.id]?.updatedAt ? new Date(phoneInboxCache[selectedChar.id].updatedAt).toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"}) : "--:--"}
                </span>
              </div>
              <div style={{position:"absolute",left:"50%",bottom:10,transform:"translateX(-50%)",width:120,height:5,borderRadius:999,background:"rgba(28,44,55,.3)"}} />
            </div>
          )}
          {characters.length > 0 && selectedChar && phonePage === "wallet" && (
            <div style={{position:"relative",height:"100%",minHeight:640,background:"linear-gradient(180deg,#ffd2e6 0%,#d1ecff 100%)",padding:"14px 10px 24px"}}>
              <button className="mp-back" style={{position:"absolute",left:12,top:12,zIndex:5}} onClick={closeApp}>←</button>
              <div style={{padding:"2px 8px 0 56px",display:"flex",justifyContent:"space-between",fontWeight:700,color:"#29485d",fontSize:13}}>
                <span>{phoneTime}</span><span>{phoneDate}</span>
              </div>
              <div className="mp-sc" style={{padding:10,marginTop:12,background:"rgba(255,255,255,.5)"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <button className="mp-ibtn" onClick={(e) => { e.stopPropagation(); armAppClickSuppression(); setPhonePage("desktop"); }}>{t("backToDesktop")}</button>
                <div style={{fontWeight:700,fontSize:13}}>{selectedChar.name} {t("wallet")}</div>
                </div>
                {!phoneWallet ? (
                  <div>
                    <div style={{fontSize:12,color:"var(--mp-txt-l)",lineHeight:1.7}}>{tr("尚未生成角色錢包。", "This character wallet hasn't been generated yet.", "まだキャラクターのウォレットが生成されていません。", "아직 캐릭터 지갑이 생성되지 않았습니다.")}</div>
                    <button className="mp-save" style={{marginTop:10}} disabled={walletGenLoading} onClick={() => generateCharacterWallet(selectedChar)}>{walletGenLoading ? t("generating") : t("generate")}</button>
                  </div>
                ) : (
                  <>
                    <div style={{fontSize:12,color:"var(--mp-txt-l)"}}>{tr("可用餘額", "Available balance", "利用可能残高", "사용 가능 잔액")}</div>
                    <div style={{fontSize:30,fontWeight:900,margin:"2px 0 6px"}}>${formatMoney(phoneWallet.balance || 0)}</div>
                    {phoneWallet.summary && <div style={{fontSize:12,color:"var(--mp-txt-l)",lineHeight:1.6,marginBottom:10}}>{displayWalletText(phoneWallet.summary)}</div>}
                    <div style={{display:"flex",gap:8,marginBottom:10}}>
                      <button className="mp-ibtn" style={{flex:1}} disabled={walletGenLoading} onClick={() => generateCharacterWallet(selectedChar, { mode: "refresh" })}>{walletGenLoading ? t("loading") : t("refreshWallet")}</button>
                      <button className="mp-ibtn" style={{flex:1}} disabled={walletGenLoading} onClick={() => regenerateCharacterWallet(selectedChar)}>{walletGenLoading ? t("updating") : t("generate")}</button>
                    </div>
                    <div style={{fontSize:13,fontWeight:800,marginBottom:6}}>{tr("近期流水", "Recent transactions", "最近の取引", "최근 거래")}</div>
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
            <div style={{position:"relative",height:"100%",minHeight:640,background:"linear-gradient(180deg,#ffd2e6 0%,#d1ecff 100%)",padding:"14px 10px 24px"}}>
              <button className="mp-back" style={{position:"absolute",left:12,top:12,zIndex:5}} onClick={closeApp}>←</button>
              <div style={{padding:"2px 8px 0 56px",display:"flex",justifyContent:"space-between",fontWeight:700,color:"#29485d",fontSize:13}}>
                <span>{phoneTime}</span><span>{phoneDate}</span>
              </div>
              <div className="mp-sc" style={{padding:10,marginTop:12,background:"rgba(255,255,255,.5)"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <button className="mp-ibtn" onClick={(e) => { e.stopPropagation(); armAppClickSuppression(); setPhonePage("desktop"); }}>{t("backToDesktop")}</button>
                <div style={{fontSize:12,color:"var(--mp-txt-l)"}}>{tr("只讀聊天列表", "Read-only chat list", "閲覧専用チャット一覧", "읽기 전용 채팅 목록")}</div>
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
            <div style={{position:"relative",height:"100%",minHeight:640,background:"linear-gradient(180deg,#ffd2e6 0%,#d1ecff 100%)",padding:"14px 10px 24px"}}>
              <button className="mp-back" style={{position:"absolute",left:12,top:12,zIndex:5}} onClick={closeApp}>←</button>
              <div style={{padding:"2px 8px 0 56px",display:"flex",justifyContent:"space-between",fontWeight:700,color:"#29485d",fontSize:13}}>
                <span>{phoneTime}</span><span>{phoneDate}</span>
              </div>
              <div className="mp-sc" style={{padding:10,marginTop:12,background:"rgba(255,255,255,.5)"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <button className="mp-ibtn" onClick={(e) => { e.stopPropagation(); armAppClickSuppression(); setPhonePage("chatlist"); }}>{t("backToList")}</button>
                <div style={{fontWeight:700,fontSize:13}}>{activeThread?.name || t("chatroom")}</div>
                <span style={{fontSize:10,color:"var(--mp-txt-l)"}}>{tr("唯讀", "Read only", "閲覧専用", "읽기 전용")}</span>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:430,overflowY:"auto",border:"1px solid var(--mp-border)",borderRadius:12,padding:8,background:"rgba(255,255,255,.45)"}}>
                {(activeThread?.messages || []).map((m) => (
                  <div key={m.id} style={{display:"flex",justifyContent:m.from==="char"?"flex-end":"flex-start"}}>
                    <div style={{maxWidth:"82%",fontSize:12,lineHeight:1.45,padding:"7px 10px",borderRadius:10,background:m.from==="char"?"linear-gradient(135deg,#f48fb1,#ec407a)":"#fff",color:m.from==="char"?"#fff":"var(--mp-txt)",border:m.from==="char"?"none":"1px solid var(--mp-border)"}}>
                      {m.text}
                    </div>
                  </div>
                ))}
                {(!activeThread || (activeThread.messages || []).length === 0) && <div style={{fontSize:11,color:"var(--mp-txt-l)",textAlign:"center"}}>{t("noMessages")}</div>}
              </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
}
