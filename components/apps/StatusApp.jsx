import React, { useRef, useState } from "react";
import { useGacha } from "../../contexts/GachaContext";
import { SpecialMemoryModal } from "../gacha/SpecialMemoryCard";
import { splitArchivedMemories } from "../../services/chat/memoryRecall";
import {
  DEFAULT_MEMORY_COMPRESS_PROMPT,
  MEMORY_COMPRESSION,
  isSummaryMemory,
  isUsingDefaultCompressPrompt,
} from "../../services/chat/memoryCompression";

const SPECIAL_MEMORY_FRAME = { SSR: "#c99a4b", SR: "#8f6cc9", R: "#6f9cc9" };
const VAULT_PAGE_SIZE = 5;

// 壓縮視窗：確認要壓哪幾條，並就地開放改寫提示詞（改壞了也救得回來，因為摘要可手動編輯）。
function MemoryCompressModal({ tr, charName, selected, prompt, onPrompt, applyUserPlaceholder, onCancel, onConfirm, busy }) {
  // 記憶原文一律存 {{user}}，換人格才不會混進舊名字；只有顯示時才換成目前人格的稱呼。
  const showText = (text) => (applyUserPlaceholder ? applyUserPlaceholder(text) : text);
  const [promptOpen, setPromptOpen] = useState(false);
  const usingDefault = isUsingDefaultCompressPrompt(prompt);
  return (
    <div className="mp-overlay" onClick={onCancel}>
      <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mp-modal-t">{tr("壓縮記憶", "Compress memories", "記憶を圧縮", "기억 압축")}</div>
        <div style={{ fontSize: 12, color: "var(--mp-txt-l)", marginBottom: 8 }}>
          {tr(`將 ${selected.length} 條記憶整併成一條摘要。原文不會刪除，會移入塵封書庫，隨時可以還原。`, `Merge ${selected.length} memories into one summary. The originals are archived, not deleted, and can be reverted anytime.`, `${selected.length} 件の記憶を1つの要約にまとめます。原文は削除されず封印書庫に移り、いつでも元に戻せます。`, `${selected.length}개의 기억을 하나의 요약으로 합칩니다. 원문은 삭제되지 않고 봉인 서고로 이동하며 언제든 되돌릴 수 있습니다.`)}
        </div>
        <div style={{ maxHeight: 150, overflowY: "auto", fontSize: 12, lineHeight: 1.6, marginBottom: 8 }}>
          {selected.map((m, i) => (
            <div key={m.id} style={{ padding: "3px 0", borderBottom: "1px solid var(--mp-line)" }}>
              {i + 1}. {showText(m.text)}{m.pinned ? ` · ${tr("已釘選", "Pinned", "固定済み", "고정됨")}` : ""}
            </div>
          ))}
        </div>
        {selected.some((m) => m.pinned) && (
          <div style={{ fontSize: 11, color: "var(--mp-warn, #c9743f)", marginBottom: 8 }}>
            ⚠ {tr("選取中包含釘選的記憶，壓縮後原文一樣會被塵封。", "Your selection includes pinned memories; their originals will still be archived.", "選択に固定済みの記憶が含まれています。原文はやはり封印されます。", "선택에 고정된 기억이 포함되어 있습니다. 원문은 그대로 봉인됩니다.")}
          </div>
        )}
        <div className="mp-sec-t mp-sec-t-toggle" onClick={() => setPromptOpen((v) => !v)}>
          <span>{tr("自訂提示詞", "Custom prompt", "プロンプトをカスタマイズ", "프롬프트 사용자화")}{usingDefault ? "" : " ·"}</span>
          <span className="mp-sec-toggle-tag">{promptOpen ? tr("收起", "Collapse", "折りたたむ", "접기") : tr("展開", "Expand", "展開", "펼치기")}</span>
        </div>
        {promptOpen && (
          <>
            <div style={{ fontSize: 11, color: "var(--mp-txt-l)", padding: "4px 0" }}>
              {tr("可用 {{char}} 代入角色名、{{memories}} 代入選取的記憶。清空即還原預設。", "Use {{char}} for the character name and {{memories}} for the selected memories. Clear the field to restore the default.", "{{char}} はキャラ名、{{memories}} は選択した記憶に置き換わります。空にすると既定に戻ります。", "{{char}}는 캐릭터 이름, {{memories}}는 선택한 기억으로 치환됩니다. 비우면 기본값으로 돌아갑니다.")}
            </div>
            <textarea
              className="mp-ta"
              rows={8}
              value={prompt || DEFAULT_MEMORY_COMPRESS_PROMPT}
              onChange={(e) => onPrompt(e.target.value)}
              style={{ minHeight: 150, lineHeight: 1.6 }}
            />
            <button className="mp-gbtn" disabled={usingDefault} onClick={() => onPrompt("")} style={{ marginTop: 4 }}>
              {tr("還原預設提示詞", "Restore the default prompt", "既定のプロンプトに戻す", "기본 프롬프트로 복원")}
            </button>
          </>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button className="mp-gbtn" onClick={onCancel} disabled={busy}>{tr("取消", "Cancel", "キャンセル", "취소")}</button>
          <button className="mp-gbtn" onClick={onConfirm} disabled={busy}>
            {busy ? tr("壓縮中...", "Compressing...", "圧縮中...", "압축 중...") : tr("開始壓縮", "Compress", "圧縮する", "압축")}
          </button>
        </div>
      </div>
    </div>
  );
}

// 塵封書庫：活躍區溢出時記憶會被移到這裡，不進提示詞但原文完整保留，玩家可搜尋與撈回。
function ArchivedMemoryVault({ tr, charId, memories, applyUserPlaceholder, onRestore, onDelete }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  if (!memories.length) return null;
  const keyword = query.trim().toLowerCase();
  const filtered = keyword
    ? memories.filter((m) => String(m.text || "").toLowerCase().includes(keyword))
    : memories;
  const sorted = [...filtered].sort((a, b) => (b.date || 0) - (a.date || 0));
  const pageCount = Math.max(1, Math.ceil(sorted.length / VAULT_PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), pageCount - 1);
  const pageItems = sorted.slice(safePage * VAULT_PAGE_SIZE, (safePage + 1) * VAULT_PAGE_SIZE);
  return (
    <div style={{ marginTop: 10 }}>
      <div className="mp-sec-t mp-sec-t-toggle" onClick={() => setOpen((v) => !v)}>
        <span>🗝 {tr("塵封書庫", "Archive", "封印書庫", "봉인 서고")} ({memories.length})</span>
        <span className="mp-sec-toggle-tag">{open ? tr("收起", "Collapse", "折りたたむ", "접기") : tr("展開", "Expand", "展開", "펼치기")}</span>
      </div>
      {open && (
        <>
          <div style={{ fontSize: 11, color: "var(--mp-txt-l)", padding: "4px 2px 6px" }}>
            {tr("這些記憶不會進入對話，但原文完整保留，可隨時取回。", "These memories stay out of conversations, but the full text is kept and can be restored anytime.", "これらの記憶は会話に入りませんが、原文はそのまま保持され、いつでも戻せます。", "이 기억들은 대화에 들어가지 않지만 원문이 그대로 보존되며 언제든 되돌릴 수 있습니다.")}
          </div>
          <input
            className="mp-sinp"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(0); }}
            placeholder={tr("搜尋塵封記憶", "Search the archive", "封印書庫を検索", "봉인 서고 검색")}
            style={{ marginBottom: 6 }}
          />
          {sorted.length === 0
            ? <div style={{ fontSize: 11, color: "var(--mp-txt-l)", textAlign: "center", padding: 6 }}>{tr("沒有符合的記憶", "No matching memories", "一致する記憶がありません", "일치하는 기억이 없습니다")}</div>
            : <div className="mp-tl">
              {pageItems.map((m) => (
                <div key={m.id} className="mp-tl-item">
                  <div className="mp-tl-dot" style={{ top: 6, opacity: 0.5 }} />
                  <div className="mp-mem" style={{ opacity: 0.72 }}>{applyUserPlaceholder(m.text)}</div>
                  <div className="mp-mem-d" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                    <span>{new Date(m.date).toLocaleDateString("zh-TW")}</span>
                    <span style={{ display: "flex", gap: 6 }}>
                      <button className="mp-ibtn" onClick={() => onRestore(charId, m.id)}>↩</button>
                      <button className="mp-ibtn-r" onClick={() => onDelete(charId, m.id)}>🗑</button>
                    </span>
                  </div>
                </div>
              ))}
            </div>}
          {pageCount > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8 }}>
              <button type="button" className="mp-ibtn" disabled={safePage <= 0} onClick={() => setPage(safePage - 1)}>‹</button>
              <span style={{ fontSize: 11, color: "var(--mp-txt-l)" }}>{safePage + 1} / {pageCount}</span>
              <button type="button" className="mp-ibtn" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>›</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function StatusApp({
  closeApp, t, tr, characters, chatHistory, memories, posts, sanitizeUserImageUrl,
  statusMemoryPages = {}, setStatusMemoryPages,
  statusExpandedCharId, setStatusExpandedCharId, statusMemoryExpandedCharId, setStatusMemoryExpandedCharId,
  refreshCharacterStatus, statusRefreshingIds, activeMemoryId, setActiveMemoryId, setMemoryEditor,
  togglePinMemory, deleteMemory, generateMemory, archiveMemory, restoreMemory, compressMemories, revertMemorySummary,
  memoryPrompt, genLoading, applyUserPlaceholder, playerProfile,
}) {
  const { specialMemories } = useGacha();
  const [viewingSpecialMemory, setViewingSpecialMemory] = useState(null);
  // 壓縮的多選狀態綁在角色上，切到別的角色卡就自動失效，避免跨角色誤選。
  const [compressCharId, setCompressCharId] = useState(null);
  const [compressSelection, setCompressSelection] = useState([]);
  const [compressConfirmOpen, setCompressConfirmOpen] = useState(false);
  const exitCompressMode = () => { setCompressCharId(null); setCompressSelection([]); setCompressConfirmOpen(false); };
  const toggleCompressPick = (memoryId) => setCompressSelection((prev) => (
    prev.includes(memoryId) ? prev.filter((id) => id !== memoryId) : [...prev, memoryId]
  ));
  // 桌面滑鼠不會拖動 overflow 容器、滾輪只捲垂直，所以縮圖列自己接手；觸控維持原生捲動
  const specialDragRef = useRef(null);
  const specialDragHandlers = {
    onWheel: (e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) e.currentTarget.scrollLeft += e.deltaY; },
    onPointerDown: (e) => { if (e.pointerType !== "mouse") return; specialDragRef.current = { x: e.clientX, left: e.currentTarget.scrollLeft, moved: false }; },
    onPointerMove: (e) => {
      const drag = specialDragRef.current;
      if (!drag || e.pointerType !== "mouse") return;
      const dx = e.clientX - drag.x;
      if (Math.abs(dx) > 4) drag.moved = true;
      e.currentTarget.scrollLeft = drag.left - dx;
    },
    onPointerUp: () => { setTimeout(() => { specialDragRef.current = null; }, 0); },
    onPointerLeave: () => { specialDragRef.current = null; },
  };
  return (
      <div className="mp-page">
        <div className="mp-hdr"><div className="mp-back" onClick={closeApp}>←</div><div className="mp-htitle">{t("status")}</div></div>
        <div className="mp-cm">
          {characters.length === 0 ? <div className="mp-empty"><div className="mp-empty-i">🧩</div><div className="mp-empty-t">{tr("目前尚未建立角色", "No characters yet", "まだキャラがありません", "아직 캐릭터가 없습니다")}</div></div>
          : characters.map(c => {
            const msgs = chatHistory[c.id] || [];
            const dialogueMsgs = msgs.filter((m) => m.role === "user" || m.role === "assistant");
            const { active: mems, archived: archivedMems } = splitArchivedMemories(memories[c.id] || []);
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
            const specials = specialMemories.filter((m) => String(m.characterId) === String(c.id));
            return (
              <div key={c.id} className="mp-sc">
                <div className="mp-sc-ban" />
                <div className="mp-sc-avl">{sanitizeUserImageUrl(c.avatar) ? <img src={sanitizeUserImageUrl(c.avatar)} alt="" /> : "🦊"}</div>
                <div className="mp-sc-body">
                  <div className="mp-sc-nm">{c.name}</div>
                  <div style={{fontSize:12,color:"var(--mp-txt-l)",marginTop:4,lineHeight:1.5}}>{(c.statusText || tr("尚無狀態", "No status yet", "まだステータスがありません", "아직 상태가 없습니다")).slice(0,80)}</div>
                  {c.statusUpdatedAt ? <div style={{fontSize:10,color:"var(--mp-txt-l)",opacity:.8,marginTop:2}}>{tr("更新時間", "Updated", "更新時刻", "업데이트 시간")}：{new Date(c.statusUpdatedAt).toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"})}</div> : null}
                  <div style={{marginTop:6}}>
                    <button type="button" className="mp-ibtn" disabled={!!statusRefreshingIds?.[c.id]} onClick={(event) => { event.stopPropagation(); void refreshCharacterStatus(c.id, true); }}>{statusRefreshingIds?.[c.id] ? tr("更新中...", "Updating...", "更新中...", "업데이트 중...") : tr("更新狀態", "Refresh status", "ステータスを更新", "상태 새로고침")}</button>
                  </div>
                  {c.tags?.length > 0 && <div className="mp-sc-tags">{c.tags.map((t,i) => <span key={i} className="mp-tag">{t}</span>)}</div>}
                  {c.creator && <div style={{fontSize:10,color:"var(--mp-txt-l)",marginTop:4}}>by {c.creator}</div>}
                  <div className="mp-sc-stats">
                    <div className="mp-stat"><div className="mp-stat-v">{conversationCount}</div><div className="mp-stat-lb">{tr("訊息", "Messages", "メッセージ", "메시지")}</div></div>
                    <div className="mp-stat"><div className="mp-stat-v">{days}</div><div className="mp-stat-lb">{tr("互動天數", "Days", "日数", "일수")}</div></div>
                    <div className="mp-stat"><div className="mp-stat-v">{mems.length}</div><div className="mp-stat-lb">{tr("記憶", "Memories", "記憶", "기억")}</div></div>
                    <div className="mp-stat"><div className="mp-stat-v">{specials.length}</div><div className="mp-stat-lb">{tr("特別記憶", "Special", "特別な記憶", "특별한 기억")}</div></div>
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
                    : <div className="mp-tl">{(() => {
                      const sortedMems = [...mems].sort((a, b) => {
                      if (!!b.pinned !== !!a.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
                      return (b.date || 0) - (a.date || 0);
                      });
                      const pageSize = 5;
                      const pageCount = Math.max(1, Math.ceil(sortedMems.length / pageSize));
                      const page = Math.min(Math.max(0, Number(statusMemoryPages[c.id]) || 0), pageCount - 1);
                      const pageMems = sortedMems.slice(page * pageSize, (page + 1) * pageSize);
                      return <>
                      {pageMems.map((m,i) => {
                      const picking = compressCharId === c.id;
                      const picked = picking && compressSelection.includes(m.id);
                      return (
                      <div key={m.id || i} className="mp-tl-item">
                        <div className="mp-tl-dot" style={{top:6}} />
                        <div
                          className="mp-mem"
                          style={picked ? { outline: "2px solid var(--mp-acc)", borderRadius: 8 } : undefined}
                          onClick={() => (picking ? toggleCompressPick(m.id) : setActiveMemoryId((p) => (p === m.id ? null : m.id)))}
                        >{picking ? `${picked ? "☑" : "☐"} ` : ""}{applyUserPlaceholder(m.text)}</div>
                        <div className="mp-mem-d" style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:6}}>
                          <span>
                            {new Date(m.date).toLocaleDateString("zh-TW")}
                            {m.pinned ? ` · ${tr("已釘選", "Pinned", "固定済み", "고정됨")}` : ""}
                            {isSummaryMemory(m) ? ` · ${tr(`摘要（${m.sourceIds.length} 條）`, `Summary (${m.sourceIds.length})`, `要約（${m.sourceIds.length} 件）`, `요약 (${m.sourceIds.length}개)`)}` : ""}
                          </span>
                          <span style={{display:"flex",gap:6}}>
                            {isSummaryMemory(m) && !picking && (
                              <button
                                className={`mp-ibtn ${activeMemoryId===m.id?"":"mp-ibtn-hidden"}`}
                                title={tr("還原成原本的記憶", "Revert to the original memories", "元の記憶に戻す", "원래 기억으로 되돌리기")}
                                onClick={() => revertMemorySummary(c.id, m.id)}
                              >⤺</button>
                            )}
                            <button className={`mp-ibtn ${activeMemoryId===m.id?"":"mp-ibtn-hidden"}`} onClick={() => setMemoryEditor({ charId: c.id, memoryId: m.id, text: m.text || "" })}>✎</button>
                            <button className={`mp-ibtn ${activeMemoryId===m.id?"":"mp-ibtn-hidden"}`} onClick={() => togglePinMemory(c.id, m.id)}>{m.pinned ? "📌" : "📍"}</button>
                            <button
                              className={`mp-ibtn ${activeMemoryId===m.id?"":"mp-ibtn-hidden"}`}
                              title={tr("移入塵封書庫", "Move to the archive", "封印書庫へ移す", "봉인 서고로 이동")}
                              onClick={() => archiveMemory(c.id, m.id)}
                            >🗝</button>
                            <button className={`mp-ibtn-r ${activeMemoryId===m.id?"":"mp-ibtn-hidden"}`} onClick={() => deleteMemory(c.id, m.id)}>🗑</button>
                          </span>
                        </div>
                      </div>
                      );})}
                      {pageCount > 1 && <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:8}}>
                        <button type="button" className="mp-ibtn" disabled={page <= 0} onClick={() => setStatusMemoryPages?.((prev) => ({...prev, [c.id]: Math.max(0, page - 1)}))}>‹</button>
                        <span style={{fontSize:11,color:"var(--mp-txt-l)"}}>{page + 1} / {pageCount}</span>
                        <button type="button" className="mp-ibtn" disabled={page >= pageCount - 1} onClick={() => setStatusMemoryPages?.((prev) => ({...prev, [c.id]: Math.min(pageCount - 1, page + 1)}))}>›</button>
                      </div>}
                      </>;
                    })()}</div>}
                        {compressCharId === c.id ? (
                          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
                            <span style={{ fontSize: 11, color: "var(--mp-txt-l)" }}>
                              {tr(`已選 ${compressSelection.length} 條`, `${compressSelection.length} selected`, `${compressSelection.length} 件選択`, `${compressSelection.length}개 선택`)}
                            </span>
                            <button className="mp-gbtn" onClick={exitCompressMode}>{tr("取消", "Cancel", "キャンセル", "취소")}</button>
                            <button
                              className="mp-gbtn"
                              disabled={compressSelection.length < MEMORY_COMPRESSION.minSelection || genLoading}
                              onClick={() => setCompressConfirmOpen(true)}
                            >{tr("壓縮所選", "Compress selected", "選択を圧縮", "선택 항목 압축")}</button>
                          </div>
                        ) : (
                          <button className="mp-gbtn" onClick={() => generateMemory(c)} disabled={genLoading}>{genLoading ? tr("生成中...", "Generating...", "生成中...", "생성 중...") : tr("生成記憶", "Generate memory", "記憶を生成", "기억 생성")}</button>
                        )}
                        {compressCharId !== c.id && mems.length >= MEMORY_COMPRESSION.minSelection && (
                          <button className="mp-gbtn" onClick={() => { setCompressCharId(c.id); setCompressSelection([]); }} style={{ marginTop: 6 }}>
                            {tr("壓縮記憶", "Compress memories", "記憶を圧縮", "기억 압축")}
                          </button>
                        )}
                        <ArchivedMemoryVault
                          tr={tr}
                          charId={c.id}
                          memories={archivedMems}
                          applyUserPlaceholder={applyUserPlaceholder}
                          onRestore={restoreMemory}
                          onDelete={deleteMemory}
                        />
                      </>
                    )}
                  </div>
                  {specials.length > 0 && <div className="mp-sec">
                    <div className="mp-sec-t">✦ {tr("特別記憶", "Special memories", "特別な記憶", "특별한 기억")}</div>
                    <div style={{display:"flex",gap:8,overflowX:"auto",padding:"6px 2px 4px",scrollbarWidth:"none",cursor:"grab",touchAction:"pan-x"}} {...specialDragHandlers}>
                      {specials.map((m) => (
                        <button key={m.id} type="button"
                          style={{flex:"0 0 auto",width:76,position:"relative",border:`1.5px solid ${SPECIAL_MEMORY_FRAME[m.itemRarity] || SPECIAL_MEMORY_FRAME.R}`,borderRadius:12,background:"var(--mp-surface)",padding:"9px 5px 7px",display:"flex",flexDirection:"column",alignItems:"center",gap:4}}
                          onClick={() => { if (specialDragRef.current?.moved) return; setViewingSpecialMemory({ memory: m, character: c }); }}>
                          {m.pinned && <span style={{position:"absolute",top:-7,right:-6,width:17,height:17,borderRadius:"50%",display:"grid",placeItems:"center",fontSize:10,lineHeight:1,color:"#fff",background:"radial-gradient(circle at 35% 30%,#eed49a,#c99a4b)",border:"1px solid #b8894040",boxShadow:"0 2px 5px rgba(160,115,40,.45)"}}>✦</span>}
                          <span style={{fontSize:22,lineHeight:1}}>{m.itemIcon || "🌸"}</span>
                          <span style={{fontSize:9.5,fontWeight:700,color:"var(--mp-txt)",width:"100%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textAlign:"center"}}>{m.title}</span>
                          <span style={{fontSize:8.5,fontWeight:800,color:SPECIAL_MEMORY_FRAME[m.itemRarity] || SPECIAL_MEMORY_FRAME.R}}>{m.itemRarity}</span>
                        </button>
                      ))}
                    </div>
                  </div>}
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
        {viewingSpecialMemory && <SpecialMemoryModal
          memory={viewingSpecialMemory.memory}
          characterAvatar={sanitizeUserImageUrl(viewingSpecialMemory.character?.avatar)}
          playerAvatar={sanitizeUserImageUrl(playerProfile?.avatar)}
          playerName={String(playerProfile?.name || "").trim() || "你"}
          onClose={() => setViewingSpecialMemory(null)}
        />}
        {compressConfirmOpen && (() => {
          const char = characters.find((item) => item.id === compressCharId);
          const pool = splitArchivedMemories(memories[compressCharId] || []).active;
          const selected = compressSelection.map((id) => pool.find((m) => m.id === id)).filter(Boolean);
          if (!char || !selected.length) return null;
          return <MemoryCompressModal
            tr={tr}
            charName={char.name}
            selected={selected}
            prompt={memoryPrompt?.value || ""}
            onPrompt={(text) => memoryPrompt?.onChange?.(text)}
            applyUserPlaceholder={applyUserPlaceholder}
            busy={genLoading}
            onCancel={() => setCompressConfirmOpen(false)}
            onConfirm={async () => {
              const result = await compressMemories(char, compressSelection);
              if (result?.status === "compressed") exitCompressMode();
            }}
          />;
        })()}
      </div>
  );
}
