import React from "react";

export default function StatusApp({
  closeApp, t, tr, characters, chatHistory, memories, posts, sanitizeUserImageUrl,
  statusExpandedCharId, setStatusExpandedCharId, statusMemoryExpandedCharId, setStatusMemoryExpandedCharId,
  refreshCharacterStatus, activeMemoryId, setActiveMemoryId, setMemoryEditor,
  togglePinMemory, deleteMemory, generateMemory, genLoading,
}) {
  return (
      <div className="mp-page">
        <div className="mp-hdr"><div className="mp-back" onClick={closeApp}>←</div><div className="mp-htitle">{t("status")}</div></div>
        <div className="mp-cm">
          {characters.length === 0 ? <div className="mp-empty"><div className="mp-empty-i">🧩</div><div className="mp-empty-t">{tr("目前尚未建立角色", "No characters yet", "まだキャラがありません", "아직 캐릭터가 없습니다")}</div></div>
          : characters.map(c => {
            const msgs = chatHistory[c.id] || [];
            const dialogueMsgs = msgs.filter((m) => m.role === "user" || m.role === "assistant");
            const mems = memories[c.id] || [];
            const uMsgs = dialogueMsgs.filter(m => m.role === "user").length;
            const assistantReplyKeys = new Set(
              dialogueMsgs
                .filter((m) => m.role === "assistant")
                .map((m) => m.replyGroupId || m.id)
            );
            const aMsgs = assistantReplyKeys.size;
            const conversationCount = uMsgs + aMsgs;
            const firstD = dialogueMsgs.length > 0 ? new Date(dialogueMsgs[0].time).toLocaleDateString("zh-TW") : "--";
            const lastD = dialogueMsgs.length > 0 ? new Date(dialogueMsgs[dialogueMsgs.length-1].time).toLocaleDateString("zh-TW") : "--";
            const days = msgs.length > 0 ? Math.max(1, Math.ceil((Date.now() - msgs[0].time) / 86400000)) : 0;
            const exp = statusExpandedCharId === c.id;
            const memoryExpanded = statusMemoryExpandedCharId === c.id;
            return (
              <div key={c.id} className="mp-sc">
                <div className="mp-sc-ban" />
                <div className="mp-sc-avl">{sanitizeUserImageUrl(c.avatar) ? <img src={sanitizeUserImageUrl(c.avatar)} alt="" /> : "🦊"}</div>
                <div className="mp-sc-body">
                  <div className="mp-sc-nm">{c.name}</div>
                  <div style={{fontSize:12,color:"var(--mp-txt-l)",marginTop:4,lineHeight:1.5}}>{(c.statusText || tr("尚無狀態", "No status yet", "まだステータスがありません", "아직 상태가 없습니다")).slice(0,80)}</div>
                  {c.statusUpdatedAt ? <div style={{fontSize:10,color:"var(--mp-txt-l)",opacity:.8,marginTop:2}}>{tr("更新時間", "Updated", "更新時刻", "업데이트 시간")}：{new Date(c.statusUpdatedAt).toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"})}</div> : null}
                  <div style={{marginTop:6}}>
                    <button className="mp-ibtn" onClick={()=>refreshCharacterStatus(c.id, true)}>{tr("刷新狀態", "Refresh status", "ステータスを更新", "상태 새로고침")}</button>
                  </div>
                  {c.tags?.length > 0 && <div className="mp-sc-tags">{c.tags.map((t,i) => <span key={i} className="mp-tag">{t}</span>)}</div>}
                  {c.creator && <div style={{fontSize:10,color:"var(--mp-txt-l)",marginTop:4}}>by {c.creator}</div>}
                  <div className="mp-sc-stats">
                    <div className="mp-stat"><div className="mp-stat-v">{conversationCount}</div><div className="mp-stat-lb">{tr("訊息", "Messages", "メッセージ", "메시지")}</div></div>
                    <div className="mp-stat"><div className="mp-stat-v">{days}</div><div className="mp-stat-lb">{tr("互動天數", "Days", "日数", "일수")}</div></div>
                    <div className="mp-stat"><div className="mp-stat-v">{mems.length}</div><div className="mp-stat-lb">{tr("記憶", "Memories", "記憶", "기억")}</div></div>
                    <div className="mp-stat"><div className="mp-stat-v">{posts.filter(p=>p.charId===c.id).length}</div><div className="mp-stat-lb">{tr("貼文", "Posts", "投稿", "게시물")}</div></div>
                  </div>
                  <div className="mp-sec">
                    <div className="mp-sec-t">{tr("對話摘要", "Conversation summary", "会話要約", "대화 요약")}</div>
                    <div className="mp-sec-ct">
                      <div className="mp-sec-row"><span>{tr("使用者訊息", "User messages", "ユーザーメッセージ", "사용자 메시지")}</span><span style={{color:"var(--mp-pink-dk)"}}>{uMsgs}</span></div>
                      <div className="mp-sec-row"><span>{c.name} {tr("回覆", "replies", "の返信", "응답")}</span><span style={{color:"var(--mp-purple)"}}>{aMsgs}</span></div>
                      <div className="mp-sec-row"><span>{tr("首次對話", "First chat", "最初の会話", "첫 대화")}</span><span>{firstD}</span></div>
                      <div className="mp-sec-row"><span>{tr("最近對話", "Latest chat", "最近の会話", "최근 대화")}</span><span>{lastD}</span></div>
                    </div>
                  </div>
                  <div className="mp-sec">
                    <div
                      className="mp-sec-t mp-sec-t-toggle"
                      onClick={() => setStatusMemoryExpandedCharId(memoryExpanded ? null : c.id)}
                    >
                      <span>{tr("記憶片段", "Memory snippets", "記憶スニペット", "기억 조각")}</span>
                      <span className="mp-sec-toggle-tag">{memoryExpanded ? tr("收起", "Collapse", "折りたたむ", "접기") : tr("展開", "Expand", "展開", "펼치기")}</span>
                    </div>
                    {memoryExpanded && (
                      <>
                        {mems.length === 0 ? <div style={{fontSize:11,color:"var(--mp-txt-l)",textAlign:"center",padding:6}}>{tr("目前尚無記憶，點擊下方按鈕可生成", "No memories yet. Tap the button below to generate one.", "まだ記憶がありません。下のボタンで生成できます。", "아직 기억이 없습니다. 아래 버튼을 눌러 생성할 수 있습니다.")}</div>
                    : <div className="mp-tl">{[...mems].sort((a, b) => {
                      if (!!b.pinned !== !!a.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
                      return (b.date || 0) - (a.date || 0);
                    }).slice(0, 5).map((m,i) => (
                      <div key={m.id || i} className="mp-tl-item">
                        <div className="mp-tl-dot" style={{top:6}} />
                        <div className="mp-mem" onClick={() => setActiveMemoryId((p) => (p === m.id ? null : m.id))}>{m.text}</div>
                        <div className="mp-mem-d" style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:6}}>
                          <span>{new Date(m.date).toLocaleDateString("zh-TW")}{m.pinned ? ` · ${tr("已釘選", "Pinned", "固定済み", "고정됨")}` : ""}</span>
                          <span style={{display:"flex",gap:6}}>
                            <button className={`mp-ibtn ${activeMemoryId===m.id?"":"mp-ibtn-hidden"}`} onClick={() => setMemoryEditor({ charId: c.id, memoryId: m.id, text: m.text || "" })}>✎</button>
                            <button className={`mp-ibtn ${activeMemoryId===m.id?"":"mp-ibtn-hidden"}`} onClick={() => togglePinMemory(c.id, m.id)}>{m.pinned ? "📌" : "📍"}</button>
                            <button className={`mp-ibtn-r ${activeMemoryId===m.id?"":"mp-ibtn-hidden"}`} onClick={() => deleteMemory(c.id, m.id)}>🗑</button>
                          </span>
                        </div>
                      </div>
                    ))}</div>}
                        <button className="mp-gbtn" onClick={() => generateMemory(c)} disabled={genLoading}>{genLoading ? tr("生成中...", "Generating...", "生成中...", "생성 중...") : tr("生成記憶", "Generate memory", "記憶を生成", "기억 생성")}</button>
                      </>
                    )}
                  </div>
                  <div className="mp-sec">
                    <div className="mp-sec-t" style={{cursor:"pointer"}} onClick={() => setStatusExpandedCharId(exp ? null : c.id)}>
                      {tr("角色設定", "Character settings", "キャラ設定", "캐릭터 설정")} {exp ? tr("收起", "Collapse", "折りたたむ", "접기") : tr("展開", "Expand", "展開", "펼치기")}
                    </div>
                    {exp && (
                      <div className="mp-persona">
                        {c.description && <><strong>{tr("角色設定", "Description", "説明", "설명")}：</strong>{c.description}{"\n\n"}</>}
                        {c.systemPrompt && <><strong>{tr("System Prompt", "System prompt", "システムプロンプト", "시스템 프롬프트")}：</strong>{c.systemPrompt}{"\n\n"}</>}
                        {c.personality && <><strong>{tr("個性", "Personality", "個性", "개성")}：</strong>{c.personality}{"\n\n"}</>}
                        {c.scenario && <><strong>{tr("情境", "Scenario", "シナリオ", "상황")}：</strong>{c.scenario}</>}
                        {!c.description && !c.systemPrompt && !c.personality && !c.scenario && (
                          <div style={{color:"var(--mp-txt-l)"}}>{tr("目前沒有可顯示的角色設定。", "No character settings to display yet.", "表示できるキャラ設定はまだありません。", "표시할 캐릭터 설정이 없습니다.")}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
  );
}
