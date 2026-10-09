import React, { useState } from "react";
import { useGacha } from "../../contexts/GachaContext";
import { SpecialMemoryModal } from "../gacha/SpecialMemoryCard";
import { splitArchivedMemories } from "../../services/chat/memoryRecall";
import { AppHeader, LargeTitle, LargeTitleHeader, SUB_PAGE_CLASS, useLargeTitle } from "../shell/LargeTitle";
import SegmentedControl from "../common/SegmentedControl";
import {
  DEFAULT_MEMORY_COMPRESS_PROMPT,
  MEMORY_COMPRESSION,
  isSummaryMemory,
  isUsingDefaultCompressPrompt,
} from "../../services/chat/memoryCompression";
import { AvatarFallback } from "../common/Avatar";
import Icon from "../common/Icon";

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
  statusExpandedCharId, setStatusExpandedCharId,
  refreshCharacterStatus, statusRefreshingIds, setMemoryEditor,
  togglePinMemory, deleteMemory, generateMemory, archiveMemory, restoreMemory, compressMemories, revertMemorySummary,
  memoryPrompt, genLoading, applyUserPlaceholder, playerProfile, activeCharId,
}) {
  const largeTitle = useLargeTitle();
  const { specialMemories } = useGacha();
  const [viewingSpecialMemory, setViewingSpecialMemory] = useState(null);
  // MP-016：第一層是所有角色的總覽，點進角色才看概況／記憶／特別記憶。打開哪位角色沿用 statusExpandedCharId。
  const [detailTab, setDetailTab] = useState("overview");
  // 壓縮的多選狀態綁在角色上，切到別的角色就自動失效，避免跨角色誤選。
  const [compressCharId, setCompressCharId] = useState(null);
  const [compressSelection, setCompressSelection] = useState([]);
  const [compressConfirmOpen, setCompressConfirmOpen] = useState(false);
  const exitCompressMode = () => { setCompressCharId(null); setCompressSelection([]); setCompressConfirmOpen(false); };
  const toggleCompressPick = (memoryId) => setCompressSelection((prev) => (
    prev.includes(memoryId) ? prev.filter((id) => id !== memoryId) : [...prev, memoryId]
  ));
  const uiLocale = (typeof document !== "undefined" && document.documentElement.lang) || "zh-TW";
  const fmtDate = (time) => (time ? new Date(time).toLocaleDateString(uiLocale, { year: "numeric", month: "long", day: "numeric" }) : "--");
  const fmtTime = (time) => new Date(time).toLocaleTimeString(uiLocale, { hour: "2-digit", minute: "2-digit" });
  const relativeDay = (time) => {
    if (!time) return tr("還沒聊過", "Not yet", "まだ", "아직 없음");
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const diff = Math.floor((startOfToday.getTime() - new Date(time).setHours(0, 0, 0, 0)) / 86400000);
    if (diff <= 0) return tr("今天", "Today", "今日", "오늘");
    if (diff === 1) return tr("昨天", "Yesterday", "昨日", "어제");
    if (diff < 7) return tr(`${diff} 天前`, `${diff} days ago`, `${diff}日前`, `${diff}일 전`);
    return fmtDate(time);
  };
  const avatarOf = (c) => (sanitizeUserImageUrl(c.avatar) ? <img src={sanitizeUserImageUrl(c.avatar)} alt="" /> : <AvatarFallback name={c.name} />);
  const companionTag = <span className="mp-status-tag">{tr("陪伴中", "Companion", "パートナー", "동행 중")}</span>;

  // 每位角色的紀錄都從現有資料即時算出，不另外存。
  const statsOf = (c) => {
    const msgs = chatHistory[c.id] || [];
    const dialogueMsgs = msgs.filter((m) => m.role === "user" || m.role === "assistant");
    const { active, archived } = splitArchivedMemories(memories[c.id] || []);
    const uMsgs = dialogueMsgs.filter((m) => m.role === "user").length;
    const aMsgs = new Set(dialogueMsgs.filter((m) => m.role === "assistant").map((m) => m.replyGroupId || m.id)).size;
    const specials = specialMemories.filter((m) => String(m.characterId) === String(c.id));
    return {
      dialogueMsgs, uMsgs, aMsgs, conversationCount: uMsgs + aMsgs,
      days: msgs.length > 0 ? Math.max(1, Math.ceil((Date.now() - msgs[0].time) / 86400000)) : 0,
      firstTime: dialogueMsgs[0]?.time || 0,
      lastTime: dialogueMsgs[dialogueMsgs.length - 1]?.time || 0,
      mems: active, archivedMems: archived, specials,
      postCount: posts.filter((p) => p.charId === c.id).length,
    };
  };
  // 里程碑：只用已有的時間戳推算（第一次聊天、訊息數、認識天數、第一則記憶、第一張特別記憶），不呼叫 AI。
  const milestonesOf = (s) => {
    const items = [];
    if (s.firstTime) items.push({ time: s.firstTime, text: tr("第一次聊天", "First chat", "初めての会話", "첫 대화") });
    [100, 500, 1000].forEach((count) => {
      const msg = s.dialogueMsgs[count - 1];
      if (msg) items.push({ time: msg.time, text: tr(`第 ${count} 則訊息`, `${count}th message`, `${count} 通目のメッセージ`, `${count}번째 메시지`) });
    });
    [30, 100, 365].forEach((dayCount) => {
      if (s.firstTime && s.days >= dayCount) items.push({ time: s.firstTime + (dayCount - 1) * 86400000, text: tr(`認識滿 ${dayCount} 天`, `${dayCount} days together`, `出会って ${dayCount} 日`, `만난 지 ${dayCount}일`) });
    });
    const memoryDates = [...s.mems, ...s.archivedMems].map((m) => Number(m.date) || 0).filter(Boolean);
    if (memoryDates.length) items.push({ time: Math.min(...memoryDates), text: tr("第一則記憶", "First memory", "最初の記憶", "첫 기억") });
    const firstSpecial = [...s.specials].filter((m) => m.createdAt).sort((a, b) => a.createdAt - b.createdAt)[0];
    if (firstSpecial) items.push({ time: firstSpecial.createdAt, gold: true, text: tr(`第一張特別記憶「${firstSpecial.title}」`, `First special memory: “${firstSpecial.title}”`, `最初の特別な記憶「${firstSpecial.title}」`, `첫 특별한 기억 「${firstSpecial.title}」`) });
    return items.sort((a, b) => b.time - a.time);
  };

  // 陪伴中的角色排第一，其餘沿用聯絡人的共用排序與釘選。
  const ordered = activeCharId
    ? [...characters.filter((c) => c.id === activeCharId), ...characters.filter((c) => c.id !== activeCharId)]
    : characters;
  const openChar = characters.find((c) => c.id === statusExpandedCharId) || null;
  const openCharacter = (id) => { exitCompressMode(); setDetailTab("overview"); setStatusExpandedCharId(id); };
  const closeCharacter = () => { exitCompressMode(); setStatusExpandedCharId(null); };

  const modals = <>
    {viewingSpecialMemory && <SpecialMemoryModal
      memory={viewingSpecialMemory.memory}
      characterAvatar={sanitizeUserImageUrl(viewingSpecialMemory.character?.avatar)}
      playerAvatar={sanitizeUserImageUrl(playerProfile?.avatar)}
      playerName={String(playerProfile?.name || "").trim() || tr("你", "You", "あなた", "나")}
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
  </>;

  // ===== 第二層：角色頁 =====
  if (openChar) {
    const c = openChar;
    const s = statsOf(c);
    const milestones = milestonesOf(s);
    const refreshing = !!statusRefreshingIds?.[c.id];
    return (
      <div className={SUB_PAGE_CLASS}>
        <AppHeader title={c.name} onBack={closeCharacter} backLabel={tr("返回狀態", "Back to Status", "ステータスに戻る", "상태로 돌아가기")} />
        <div className="mp-cm">
          <div className="mp-status-hero">
            <span className="mp-status-av lg">{avatarOf(c)}</span>
            <div className="mp-status-hero-name">{c.name}{c.id === activeCharId && companionTag}</div>
            <div className="mp-status-hero-days">
              {tr("已經認識", "Together for", "出会って", "만난 지")}<b>{s.days}</b>{tr(`天・聊了 ${s.conversationCount} 則`, ` days · ${s.conversationCount} messages`, `日・${s.conversationCount} 通`, `일 · ${s.conversationCount}개 대화`)}
            </div>
            <div className="mp-status-hero-text">{c.statusText || tr("尚無狀態", "No status yet", "まだステータスがありません", "아직 상태가 없습니다")}</div>
            <div className="mp-status-hero-meta">
              {c.statusUpdatedAt ? <span>{tr(`${fmtTime(c.statusUpdatedAt)} 更新`, `Updated ${fmtTime(c.statusUpdatedAt)}`, `${fmtTime(c.statusUpdatedAt)} 更新`, `${fmtTime(c.statusUpdatedAt)} 업데이트`)}</span> : null}
              <button type="button" className="mp-status-refresh" disabled={refreshing} onClick={() => void refreshCharacterStatus(c.id, true)}>
                {refreshing ? tr("更新中...", "Updating...", "更新中...", "업데이트 중...") : tr("↻ 更新狀態", "↻ Refresh status", "↻ ステータスを更新", "↻ 상태 새로고침")}
              </button>
            </div>
          </div>
          <SegmentedControl
            items={[
              { id: "overview", label: tr("概況", "Overview", "概要", "개요") },
              { id: "memories", label: tr("記憶", "Memories", "記憶", "기억") },
              { id: "specials", label: tr("特別記憶", "Special", "特別な記憶", "특별한 기억") },
            ]}
            value={detailTab}
            onChange={(next) => { exitCompressMode(); setDetailTab(next); }}
            ariaLabel={tr(`${c.name} 的紀錄`, `${c.name}'s records`, `${c.name}の記録`, `${c.name}의 기록`)}
          />

          {detailTab === "overview" && <>
            <div className="mp-status-stats">
              {[
                [s.conversationCount, tr("訊息", "Messages", "メッセージ", "메시지")],
                [s.mems.length, tr("記憶", "Memories", "記憶", "기억")],
                [s.specials.length, tr("特別記憶", "Special", "特別な記憶", "특별한 기억")],
                [s.postCount, tr("貼文", "Posts", "投稿", "게시물")],
              ].map(([value, label]) => <div key={label}><b>{value}</b><small>{label}</small></div>)}
            </div>
            <div className="mp-list-section">{tr("對話紀錄", "Chat record", "会話の記録", "대화 기록")}</div>
            <div className="mp-group mp-status-kv">
              <div><span>{tr("你傳的訊息", "Your messages", "あなたのメッセージ", "내가 보낸 메시지")}</span><span>{tr(`${s.uMsgs} 則`, `${s.uMsgs}`, `${s.uMsgs} 通`, `${s.uMsgs}개`)}</span></div>
              <div><span>{tr(`${c.name} 的回覆`, `${c.name}'s replies`, `${c.name}の返信`, `${c.name}의 답장`)}</span><span>{tr(`${s.aMsgs} 則`, `${s.aMsgs}`, `${s.aMsgs} 通`, `${s.aMsgs}개`)}</span></div>
              <div><span>{tr("首次對話", "First chat", "最初の会話", "첫 대화")}</span><span>{fmtDate(s.firstTime)}</span></div>
              <div><span>{tr("最近對話", "Latest chat", "最近の会話", "최근 대화")}</span><span>{relativeDay(s.lastTime)}</span></div>
              <div><span>{tr("互動天數", "Days together", "交流日数", "교류 일수")}</span><span>{tr(`${s.days} 天`, `${s.days} days`, `${s.days} 日`, `${s.days}일`)}</span></div>
            </div>
            {milestones.length > 0 && <>
              <div className="mp-list-section">{tr("里程碑", "Milestones", "マイルストーン", "마일스톤")}</div>
              <div className="mp-status-milestones">
                {milestones.map((item) => (
                  <div key={`${item.time}-${item.text}`} className={item.gold ? "gold" : ""}>
                    {item.text}<small>{fmtDate(item.time)}</small>
                  </div>
                ))}
              </div>
            </>}
          </>}

          {detailTab === "memories" && <>
            <div className="mp-status-count">
              <b>{tr(`共 ${s.mems.length} 則記憶`, `${s.mems.length} memories`, `記憶 ${s.mems.length} 件`, `기억 ${s.mems.length}개`)}</b>
              {s.archivedMems.length > 0 && <span>{tr(`另有塵封 ${s.archivedMems.length} 則`, `${s.archivedMems.length} archived`, `封印 ${s.archivedMems.length} 件`, `봉인 ${s.archivedMems.length}개`)}</span>}
            </div>
            {s.mems.length === 0
              ? <div className="mp-status-empty">{tr("目前尚無記憶，點擊下方按鈕可生成", "No memories yet. Tap the button below to generate one.", "まだ記憶がありません。下のボタンで生成できます。", "아직 기억이 없습니다. 아래 버튼을 눌러 생성할 수 있습니다.")}</div>
              : <div className="mp-tl">{(() => {
                const sortedMems = [...s.mems].sort((a, b) => {
                  if (!!b.pinned !== !!a.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
                  return (b.date || 0) - (a.date || 0);
                });
                const pageSize = 5;
                const pageCount = Math.max(1, Math.ceil(sortedMems.length / pageSize));
                const page = Math.min(Math.max(0, Number(statusMemoryPages[c.id]) || 0), pageCount - 1);
                const pageMems = sortedMems.slice(page * pageSize, (page + 1) * pageSize);
                return <>
                  {pageMems.map((m, i) => {
                    const picking = compressCharId === c.id;
                    const picked = picking && compressSelection.includes(m.id);
                    return (
                      <div key={m.id || i} className="mp-tl-item">
                        <div className="mp-tl-dot" style={{ top: 6 }} />
                        <div
                          className="mp-mem"
                          style={picked ? { outline: "2px solid var(--mp-acc)", borderRadius: 8 } : undefined}
                          onClick={() => (picking ? toggleCompressPick(m.id) : undefined)}
                        >{picking ? `${picked ? "☑" : "☐"} ` : ""}{applyUserPlaceholder(m.text)}</div>
                        <div className="mp-mem-d" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                          <span>
                            {fmtDate(m.date)}
                            {m.pinned ? ` · ${tr("已釘選", "Pinned", "固定済み", "고정됨")}` : ""}
                            {isSummaryMemory(m) ? ` · ${tr(`摘要（${m.sourceIds.length} 條）`, `Summary (${m.sourceIds.length})`, `要約（${m.sourceIds.length} 件）`, `요약 (${m.sourceIds.length}개)`)}` : ""}
                          </span>
                          {/* 操作鈕直接顯示：以前要先點一下記憶才會出現，很難發現 */}
                          {!picking && <span style={{ display: "flex", gap: 6 }}>
                            {isSummaryMemory(m) && (
                              <button className="mp-ibtn" title={tr("還原成原本的記憶", "Revert to the original memories", "元の記憶に戻す", "원래 기억으로 되돌리기")} onClick={() => revertMemorySummary(c.id, m.id)}>⤺</button>
                            )}
                            <button className="mp-ibtn" title={tr("編輯", "Edit", "編集", "편집")} onClick={() => setMemoryEditor({ charId: c.id, memoryId: m.id, text: m.text || "" })}>✎</button>
                            <button className="mp-ibtn" title={m.pinned ? tr("取消釘選", "Unpin", "固定解除", "고정 해제") : tr("釘選", "Pin", "固定", "고정")} onClick={() => togglePinMemory(c.id, m.id)}>{m.pinned ? "📌" : "📍"}</button>
                            <button className="mp-ibtn" title={tr("移入塵封書庫", "Move to the archive", "封印書庫へ移す", "봉인 서고로 이동")} onClick={() => archiveMemory(c.id, m.id)}>🗝</button>
                            <button className="mp-ibtn-r" title={tr("刪除", "Delete", "削除", "삭제")} onClick={() => deleteMemory(c.id, m.id)}>🗑</button>
                          </span>}
                        </div>
                      </div>
                    );
                  })}
                  {pageCount > 1 && <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8 }}>
                    <button type="button" className="mp-ibtn" disabled={page <= 0} onClick={() => setStatusMemoryPages?.((prev) => ({ ...prev, [c.id]: Math.max(0, page - 1) }))}>‹</button>
                    <span style={{ fontSize: 11, color: "var(--mp-txt-l)" }}>{page + 1} / {pageCount}</span>
                    <button type="button" className="mp-ibtn" disabled={page >= pageCount - 1} onClick={() => setStatusMemoryPages?.((prev) => ({ ...prev, [c.id]: Math.min(pageCount - 1, page + 1) }))}>›</button>
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
            {compressCharId !== c.id && s.mems.length >= MEMORY_COMPRESSION.minSelection && (
              <button className="mp-gbtn" onClick={() => { setCompressCharId(c.id); setCompressSelection([]); }} style={{ marginTop: 6 }}>
                {tr("壓縮記憶", "Compress memories", "記憶を圧縮", "기억 압축")}
              </button>
            )}
            <ArchivedMemoryVault
              tr={tr}
              charId={c.id}
              memories={s.archivedMems}
              applyUserPlaceholder={applyUserPlaceholder}
              onRestore={restoreMemory}
              onDelete={deleteMemory}
            />
          </>}

          {detailTab === "specials" && <>
            <div className="mp-status-count"><b>{tr(`共 ${s.specials.length} 張特別記憶`, `${s.specials.length} special memories`, `特別な記憶 ${s.specials.length} 枚`, `특별한 기억 ${s.specials.length}장`)}</b></div>
            {s.specials.length === 0
              ? <div className="mp-status-empty">{tr("還沒有特別記憶，抽卡劇情結束時有機會獲得", "No special memories yet — they can come from gacha episodes.", "まだ特別な記憶はありません。ガチャのエピソードで手に入ることがあります", "아직 특별한 기억이 없어요. 가챠 에피소드에서 얻을 수 있어요")}</div>
              : <div className="mp-status-specials">
                {s.specials.map((m) => (
                  <button key={m.id} type="button" style={{ borderColor: SPECIAL_MEMORY_FRAME[m.itemRarity] || SPECIAL_MEMORY_FRAME.R }} onClick={() => setViewingSpecialMemory({ memory: m, character: c })}>
                    {m.pinned && <span className="mp-status-special-pin" aria-hidden="true">✦</span>}
                    <span className="mp-status-special-icon">{m.itemIcon || "🌸"}</span>
                    <span className="mp-status-special-title">{m.title}</span>
                    <span className="mp-status-special-rarity" style={{ color: SPECIAL_MEMORY_FRAME[m.itemRarity] || SPECIAL_MEMORY_FRAME.R }}>{m.itemRarity}</span>
                  </button>
                ))}
              </div>}
          </>}
        </div>
        {modals}
      </div>
    );
  }

  // ===== 第一層：所有角色總覽 =====
  return (
    <div className={largeTitle.pageClassName}>
      <LargeTitleHeader title={t("status")} onBack={closeApp} backLabel={tr("返回首頁", "Back to Home", "ホームに戻る", "홈으로 돌아가기")} />
      <div className="mp-cm" onScroll={largeTitle.onScroll}>
        <LargeTitle title={t("status")} subtitle={characters.length ? tr("角色們的近況與我們的紀錄", "What everyone's up to, and our story so far", "キャラたちの近況とふたりの記録", "캐릭터들의 근황과 우리의 기록") : null} />
        {characters.length === 0
          ? <div className="mp-empty"><div className="mp-empty-icon" aria-hidden="true"><Icon name="users" size={34} /></div><div className="mp-empty-t">{tr("目前尚未建立角色", "No characters yet", "まだキャラがありません", "아직 캐릭터가 없습니다")}</div></div>
          : ordered.map((c) => {
            const s = statsOf(c);
            const companion = c.id === activeCharId;
            return (
              <button key={c.id} type="button" className={`mp-status-card ${companion ? "companion" : ""}`} onClick={() => openCharacter(c.id)}>
                <span className="mp-status-card-top">
                  <span className="mp-status-av">{avatarOf(c)}</span>
                  <span className="mp-status-card-copy">
                    <span className="mp-status-card-name">
                      <b>{c.name}</b>{companion && companionTag}
                      <span className="mp-status-days">{s.days}<small>{tr("天", "d", "日", "일")}</small></span>
                    </span>
                    <span className="mp-status-card-text">{c.statusText || tr("尚無狀態", "No status yet", "まだステータスがありません", "아직 상태가 없습니다")}</span>
                    <span className="mp-status-card-sub">
                      {c.statusUpdatedAt ? tr(`${fmtTime(c.statusUpdatedAt)} 更新・`, `Updated ${fmtTime(c.statusUpdatedAt)} · `, `${fmtTime(c.statusUpdatedAt)} 更新・`, `${fmtTime(c.statusUpdatedAt)} 업데이트 · `) : ""}
                      {tr(`最後聊天：${relativeDay(s.lastTime)}`, `Last chat: ${relativeDay(s.lastTime)}`, `最後の会話：${relativeDay(s.lastTime)}`, `마지막 대화: ${relativeDay(s.lastTime)}`)}
                    </span>
                  </span>
                </span>
                <span className="mp-status-chips">
                  <span>{tr("訊息", "Messages", "メッセージ", "메시지")} <b>{s.conversationCount}</b> {tr("則", "", "通", "개")}</span>
                  <span>{tr("記憶", "Memories", "記憶", "기억")} <b>{s.mems.length}</b> {tr("則", "", "件", "개")}</span>
                  <span>{tr("特別記憶", "Special", "特別な記憶", "특별한 기억")} <b>{s.specials.length}</b> {tr("張", "", "枚", "장")}</span>
                  <span>{tr("貼文", "Posts", "投稿", "게시물")} <b>{s.postCount}</b> {tr("篇", "", "件", "개")}</span>
                </span>
              </button>
            );
          })}
      </div>
      {modals}
    </div>
  );
}
