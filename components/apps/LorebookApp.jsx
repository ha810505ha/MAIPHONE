import React from "react";
import { exportToastMessage } from "../../utils/exportFile";

export default function LorebookApp({
  lorebooks, setLorebooks, activeLorebookId, setActiveLorebookId,
  editingLorebookBook, setEditingLorebookBook, editingLorebookEntry, setEditingLorebookEntry,
  pendingLorebookExport, setPendingLorebookExport, viewingLorebookEntry, setViewingLorebookEntry,
  lorebookImportInputRef, closeApp, t, tr, sanitizeText, downloadJsonFile, showToast, gid, notify, ask,
}) {
    const activeBook = lorebooks.find((b) => b.id === activeLorebookId) || null;
    const entries = activeBook?.entries || [];
    const sortedEntries = [...entries].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const sortedBooks = [...lorebooks].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const exportLorebook = async (book) => {
      if (!book) return;
      const safeName = sanitizeText(book.name || "lorebook", 80)
        .replace(/[\\/:*?"<>|]+/g, "-")
        .trim() || "lorebook";
      try {
        const result = await downloadJsonFile({
          format: "maliphone-lorebook",
          version: 1,
          exportedAt: new Date().toISOString(),
          lorebook: {
            name: book.name || "",
            description: book.description || "",
            enabled: book.enabled !== false,
            entries: (book.entries || []).map((entry) => ({
              title: entry.title || "",
              keywords: Array.isArray(entry.keywords) ? entry.keywords : [],
              content: entry.content || "",
              enabled: entry.enabled !== false,
            })),
          },
        }, `${safeName}.malilorebook.json`);
        const message = exportToastMessage(result, tr);
        if (message) showToast(`${tr("世界書", "Lorebook", "世界観", "월드북")}${message}`);
      } catch (error) {
        showToast(`${tr("匯出失敗", "Export failed", "書き出しに失敗しました", "내보내기 실패")}：${sanitizeText(error?.message || "Unknown error", 80)}`);
      }
    };
    const normalizeImportedLorebook = (rawBook, fallbackName) => {
      if (!rawBook || typeof rawBook !== "object") return null;
      const rawEntries = Array.isArray(rawBook.entries)
        ? rawBook.entries
        : rawBook.entries && typeof rawBook.entries === "object"
          ? Object.values(rawBook.entries)
          : [];
      const now = Date.now();
      const normalizedEntries = rawEntries.map((entry, index) => {
        if (!entry || typeof entry !== "object") return null;
        const rawKeywords = entry.keywords ?? entry.keys ?? entry.key ?? [];
        const keywords = (Array.isArray(rawKeywords) ? rawKeywords : String(rawKeywords || "").split(","))
          .map((keyword) => sanitizeText(String(keyword).trim(), 32))
          .filter(Boolean)
          .slice(0, 20);
        const title = sanitizeText(
          entry.title || entry.comment || entry.name || keywords[0] || `${tr("條目", "Entry", "項目", "항목")} ${index + 1}`,
          120
        );
        return {
          id: gid(),
          title,
          keywords,
          content: sanitizeText(entry.content || entry.text || "", 3000),
          enabled: typeof entry.enabled === "boolean" ? entry.enabled : !entry.disable,
          updatedAt: now + index,
        };
      }).filter(Boolean);
      return {
        id: gid(),
        name: sanitizeText(rawBook.name || rawBook.title || fallbackName || tr("匯入的世界書", "Imported lorebook", "インポートした世界観", "가져온 월드북"), 80),
        description: sanitizeText(rawBook.description || "", 400),
        enabled: rawBook.enabled !== false,
        updatedAt: now,
        entries: normalizedEntries,
      };
    };
    const importLorebookFile = async (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        const fallbackName = file.name.replace(/(?:\.malilorebook)?\.json$/i, "");
        const candidates = Array.isArray(parsed?.lorebooks)
          ? parsed.lorebooks
          : Array.isArray(parsed?.state?.lorebooks)
            ? parsed.state.lorebooks
            : [parsed?.lorebook || parsed];
        const importedBooks = candidates
          .map((book, index) => normalizeImportedLorebook(book, candidates.length > 1 ? `${fallbackName} ${index + 1}` : fallbackName))
          .filter(Boolean);
        if (importedBooks.length === 0) throw new Error(tr("找不到可匯入的世界書", "No importable lorebook found", "インポートできる世界観が見つかりません", "가져올 수 있는 월드북을 찾을 수 없습니다"));
        setLorebooks((prev) => [...importedBooks, ...prev]);
        setActiveLorebookId(importedBooks[0].id);
        showToast(tr(`已匯入 ${importedBooks.length} 本世界書`, `Imported ${importedBooks.length} lorebook(s)`, `${importedBooks.length}件の世界観をインポートしました`, `월드북 ${importedBooks.length}개를 가져왔습니다`));
      } catch (err) {
        showToast(`${tr("世界書匯入失敗", "Lorebook import failed", "世界観のインポートに失敗しました", "월드북 가져오기에 실패했습니다")}：${sanitizeText(err?.message || tr("檔案格式錯誤", "Invalid file format", "ファイル形式が正しくありません", "파일 형식이 올바르지 않습니다"), 120)}`);
      }
    };
    const saveBook = () => {
      if (!editingLorebookBook?.name?.trim()) return showToast(tr("請輸入世界書名稱", "Please enter a lorebook name", "ワールドブック名を入力してください", "월드북 이름을 입력해주세요"));
        const payload = {
          id: editingLorebookBook.id || gid(),
          name: sanitizeText(editingLorebookBook.name, 80),
          description: sanitizeText(editingLorebookBook.description, 400),
          enabled: true,
          updatedAt: Date.now(),
          entries: editingLorebookBook.id ? (lorebooks.find((b) => b.id === editingLorebookBook.id)?.entries || []) : [],
        };
      setLorebooks((prev) => {
        const idx = prev.findIndex((x) => x.id === payload.id);
        if (idx < 0) return [payload, ...prev];
        const next = [...prev];
        next[idx] = payload;
        return next;
      });
      setActiveLorebookId(payload.id);
      setEditingLorebookBook(null);
      notify(tr("世界書已儲存", "Lorebook saved", "ワールドブックを保存しました", "월드북이 저장되었습니다"), "Lorebook saved");
    };
    const saveEntry = () => {
      if (!activeBook) return;
      if (!editingLorebookEntry?.title?.trim()) return showToast(tr("請輸入條目標題", "Please enter an entry title", "項目タイトルを入力してください", "항목 제목을 입력해주세요"));
      const keywords = editingLorebookEntry.keywords.split(",").map((k) => sanitizeText(k.trim(), 32)).filter(Boolean).slice(0, 20);
      const payload = {
        id: editingLorebookEntry.id || gid(),
        title: sanitizeText(editingLorebookEntry.title, 120),
        keywords,
        content: sanitizeText(editingLorebookEntry.content, 3000),
        enabled: !!editingLorebookEntry.enabled,
        updatedAt: Date.now(),
      };
      setLorebooks((prev) => prev.map((b) => {
        if (b.id !== activeBook.id) return b;
        const entriesNext = [...(b.entries || [])];
        const idx = entriesNext.findIndex((x) => x.id === payload.id);
        if (idx < 0) entriesNext.unshift(payload);
        else entriesNext[idx] = payload;
        return { ...b, entries: entriesNext, updatedAt: Date.now() };
      }));
      setEditingLorebookEntry(null);
      notify(tr("條目已儲存", "Entry saved", "エントリを保存しました", "항목이 저장되었습니다"), "Entry saved");
    };
    const deleteBook = (id) => {
      if (!ask("確定要刪除這本世界書嗎？", "Delete this lorebook?")) return;
      setLorebooks((prev) => prev.filter((x) => x.id !== id));
      if (activeLorebookId === id) setActiveLorebookId(null);
      notify(tr("世界書已刪除", "Lorebook deleted", "ワールドブックを削除しました", "월드북이 삭제되었습니다"), "Lorebook deleted");
    };
    const deleteEntry = (id) => {
      if (!activeBook) return;
      if (!ask("確定要刪除這個條目嗎？", "Delete this entry?")) return;
      setLorebooks((prev) => prev.map((b) => b.id === activeBook.id ? { ...b, entries: (b.entries || []).filter((x) => x.id !== id), updatedAt: Date.now() } : b));
      notify(tr("條目已刪除", "Entry deleted", "項目を削除しました", "항목이 삭제되었습니다"), "Entry deleted");
    };
    return (
      <div className="mp-page">
          <div className="mp-hdr"><div className="mp-back" onClick={() => { if (activeBook) setActiveLorebookId(null); else closeApp(); }}>←</div><div className="mp-htitle">{tr("世界書", "Lorebook", "世界観", "월드북")}</div></div>
        <div className="mp-cm">
          {!activeBook ? <>
              <div style={{display:"flex",gap:8}}>
                <button className="mp-add" style={{flex:1}} onClick={() => setEditingLorebookBook({ id: null, name: "", description: "", enabled: true })}>{tr("新增世界書", "Add lorebook", "世界観を追加", "월드북 추가")}</button>
                <button className="mp-add" style={{flex:1}} onClick={() => lorebookImportInputRef.current?.click()}>{t("import")}</button>
                <input ref={lorebookImportInputRef} type="file" accept="application/json,.json" hidden onChange={importLorebookFile} />
              </div>
            <div style={{height:8}} />
            {sortedBooks.length === 0 ? <div className="mp-empty"><div className="mp-empty-i">📚</div><div className="mp-empty-t">{tr("目前沒有世界書", "No lorebooks yet", "まだ世界観がありません", "아직 월드북이 없습니다")}</div></div> : sortedBooks.map((b) => (
              <div key={b.id} className="mp-cc">
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                    <div style={{fontWeight:700,fontSize:13}}>{b.name}</div>
                  </div>
                <div style={{fontSize:11,color:"var(--mp-txt-l)",marginTop:4}}>{tr("條目", "Entries", "項目", "항목")}：{(b.entries || []).length}</div>
                {b.description && <div className="mp-lorebook-description" style={{fontSize:12,lineHeight:1.55,marginTop:8}}>{b.description}</div>}
                <div style={{display:"flex",gap:6,marginTop:10}}>
                  <button className="mp-ibtn-chat" onClick={() => setActiveLorebookId(b.id)}>{tr("展開", "Open", "開く", "열기")}</button>
                    <button className="mp-ibtn" onClick={() => setEditingLorebookBook({ id: b.id, name: b.name || "", description: b.description || "", enabled: true })}>{tr("編輯", "Edit", "編集", "편집")}</button>
                    <button className="mp-ibtn-r" onClick={() => deleteBook(b.id)}>{tr("刪除", "Delete", "削除", "삭제")}</button>
                  </div>
                </div>
            ))}
          </> : <>
            <div className="mp-cc" style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                <div style={{fontWeight:700,fontSize:14}}>{activeBook.name}</div>
                <div style={{display:"flex",gap:6}}>
                  <button className="mp-ibtn" onClick={() => setPendingLorebookExport(activeBook)}>{t("export")}</button>
                  <button className="mp-ibtn" onClick={() => setActiveLorebookId(null)}>{t("backToList")}</button>
                </div>
              </div>
              {activeBook.description && <div className="mp-lorebook-description" style={{fontSize:12,color:"var(--mp-txt-l)",marginTop:6}}>{activeBook.description}</div>}
            </div>
            <button className="mp-add" onClick={() => setEditingLorebookEntry({ id: null, title: "", keywords: "", content: "", enabled: true })}>{tr("新增條目", "Add entry", "項目を追加", "항목 추가")}</button>
            <div style={{height:8}} />
            {sortedEntries.length === 0 ? <div className="mp-empty"><div className="mp-empty-i">📖</div><div className="mp-empty-t">{tr("這本世界書尚無條目", "This lorebook has no entries yet", "この世界観にはまだ項目がありません", "이 월드북에는 아직 항목이 없습니다")}</div></div> : sortedEntries.map((e) => (
              <div key={e.id} className="mp-cc">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                  <div style={{fontWeight:700,fontSize:13}}>{e.title}</div>
                  <span className={`mp-active-badge ${e.enabled ? "mp-badge-enabled" : "mp-badge-disabled"}`}>{e.enabled ? tr("啟用", "Enabled", "有効", "활성") : tr("停用", "Disabled", "無効", "비활성")}</span>
                </div>
                <div style={{fontSize:11,color:"var(--mp-txt-l)",marginTop:4}}>{tr("關鍵字", "Keywords", "キーワード", "키워드")}：{(e.keywords||[]).join("、") || tr("無", "None", "なし", "없음")}</div>
                <div style={{fontSize:12,lineHeight:1.55,marginTop:8,display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical",overflow:"hidden",whiteSpace:"pre-wrap"}}>{e.content || ""}</div>
                <div style={{display:"flex",gap:6,marginTop:10}}>
                  <button className="mp-ibtn mp-ibtn-view" onClick={() => setViewingLorebookEntry(e)}>{tr("展開", "Open", "開く", "열기")}</button>
                  <button className="mp-ibtn" onClick={() => setLorebooks((prev) => prev.map((b) => b.id === activeBook.id ? { ...b, entries: (b.entries || []).map((x) => x.id === e.id ? { ...x, enabled: !x.enabled, updatedAt: Date.now() } : x), updatedAt: Date.now() } : b))}>{e.enabled ? tr("停用", "Disable", "無効", "비활성") : tr("啟用", "Enable", "有効", "활성")}</button>
                  <div style={{marginLeft:"auto"}} />
                  <button className="mp-ibtn-r" onClick={() => deleteEntry(e.id)}>{tr("刪除", "Delete", "削除", "삭제")}</button>
                </div>
              </div>
            ))}
          </>}
        </div>
        {pendingLorebookExport && (
          <div className="mp-overlay" onClick={() => setPendingLorebookExport(null)}>
            <div className="mp-modal" onClick={(ev) => ev.stopPropagation()}>
              <div className="mp-modal-t">{tr("確認匯出世界書", "Confirm lorebook export", "世界観の書き出し確認", "월드북 내보내기 확인")}</div>
              <div style={{fontSize:13,lineHeight:1.65,color:"var(--mp-txt)",marginTop:8}}>
                {tr("即將匯出", "You are about to export", "書き出す世界観", "내보낼 월드북")}：<strong>{pendingLorebookExport.name || tr("未命名世界書", "Untitled lorebook", "無題の世界観", "이름 없는 월드북")}</strong>
              </div>
              <div style={{fontSize:11,color:"var(--mp-txt-l)",marginTop:4}}>
                {tr("條目", "Entries", "項目", "항목")}：{(pendingLorebookExport.entries || []).length}
              </div>
              <div style={{display:"flex",gap:8,marginTop:16}}>
                <button className="mp-save" style={{flex:1,background:"linear-gradient(135deg,#b0bec5,#90a4ae)"}} onClick={() => setPendingLorebookExport(null)}>{t("cancel")}</button>
                <button className="mp-save" style={{flex:1}} onClick={() => { exportLorebook(pendingLorebookExport); setPendingLorebookExport(null); }}>{tr("確認匯出", "Confirm export", "書き出す", "내보내기 확인")}</button>
              </div>
            </div>
          </div>
        )}
        {viewingLorebookEntry && (
          <div className="mp-overlay" onClick={() => setViewingLorebookEntry(null)}>
            <div className="mp-modal" onClick={(ev) => ev.stopPropagation()}>
              <div className="mp-modal-t" style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                <span>{viewingLorebookEntry.title || t("title")}</span>
                <span className={`mp-active-badge ${viewingLorebookEntry.enabled ? "mp-badge-enabled" : "mp-badge-disabled"}`}>{viewingLorebookEntry.enabled?t("enable"):t("disable")}</span>
              </div>
              <div className="mp-row"><div className="mp-lbl">{t("keywords")}</div><div style={{fontSize:12,color:"var(--mp-txt-l)"}}>{(viewingLorebookEntry.keywords || []).join("、") || "無"}</div></div>
              <div className="mp-row"><div className="mp-lbl">{t("content")}</div><div className="mp-lorebook-content">{viewingLorebookEntry.content || ""}</div></div>
              <div style={{display:"flex",gap:8,marginTop:8}}>
                <button className="mp-save" style={{flex:1,background:"linear-gradient(135deg,#b0bec5,#90a4ae)"}} onClick={() => setViewingLorebookEntry(null)}>{t("close")}</button>
                <button className="mp-save" style={{flex:1}} onClick={() => { setViewingLorebookEntry(null); setEditingLorebookEntry({ id: viewingLorebookEntry.id, title: viewingLorebookEntry.title || "", keywords: (viewingLorebookEntry.keywords || []).join(", "), content: viewingLorebookEntry.content || "", enabled: !!viewingLorebookEntry.enabled }); }}>{t("edit")}</button>
              </div>
            </div>
          </div>
        )}
        {editingLorebookBook && (
          <div className="mp-overlay" onClick={() => setEditingLorebookBook(null)}>
            <div className="mp-modal" onClick={(ev) => ev.stopPropagation()}>
              <div className="mp-modal-t">{editingLorebookBook.id ? tr("編輯世界書", "Edit lorebook", "世界観を編集", "월드북 편집") : tr("新增世界書", "Add lorebook", "世界観を追加", "월드북 추가")}</div>
              <div className="mp-row"><div className="mp-lbl">{tr("名稱", "Name", "名前", "이름")} *</div><input className="mp-sinp" value={editingLorebookBook.name} onChange={(ev)=>setEditingLorebookBook((s)=>({ ...s, name: ev.target.value }))} placeholder={tr("例如：學園設定、組織規範", "e.g. school rules, organization rules", "例: 学園設定、組織規範", "예: 학교 설정, 조직 규정")} /></div>
              <div className="mp-row"><div className="mp-lbl">{tr("描述", "Description", "説明", "설명")}</div><textarea className="mp-ta" value={editingLorebookBook.description} onChange={(ev)=>setEditingLorebookBook((s)=>({ ...s, description: ev.target.value }))} style={{minHeight:100,resize:"vertical"}} /></div>
                <div style={{display:"flex",gap:8,marginTop:8}}>
                <button className="mp-save" style={{flex:1,background:"linear-gradient(135deg,#b0bec5,#90a4ae)"}} onClick={() => setEditingLorebookBook(null)}>{tr("取消", "Cancel", "キャンセル", "취소")}</button>
                <button className="mp-save" style={{flex:1}} onClick={saveBook}>{tr("儲存", "Save", "保存", "저장")}</button>
              </div>
            </div>
          </div>
        )}
        {editingLorebookEntry && (
          <div className="mp-overlay" onClick={() => setEditingLorebookEntry(null)}>
            <div className="mp-modal" onClick={(ev) => ev.stopPropagation()}>
              <div className="mp-modal-t">{editingLorebookEntry.id ? tr("編輯條目", "Edit entry", "項目を編集", "항목 편집") : tr("新增條目", "Add entry", "項目を追加", "항목 추가")}</div>
              <div className="mp-row"><div className="mp-lbl">{tr("標題", "Title", "タイトル", "제목")} *</div><input className="mp-sinp" value={editingLorebookEntry.title} onChange={(ev)=>setEditingLorebookEntry((s)=>({ ...s, title: ev.target.value }))} placeholder={tr("例如：學校、地區、組織", "e.g. school, district, organization", "例: 学校、地域、組織", "예: 학교, 지역, 조직")} /></div>
              <div className="mp-row"><div className="mp-lbl">{tr("關鍵字", "Keywords", "キーワード", "키워드")} ({tr("逗號分隔", "Comma-separated", "カンマ区切り", "쉼표로 구분")})</div><input className="mp-sinp" value={editingLorebookEntry.keywords} onChange={(ev)=>setEditingLorebookEntry((s)=>({ ...s, keywords: ev.target.value }))} placeholder={tr("例如：十支局, 受訓, 規範", "e.g. ten squads, training, rules", "例: 十支局、訓練、規範", "예: 10부서, 훈련, 규정")} /></div>
              <div className="mp-row"><div className="mp-lbl">{tr("內容", "Content", "内容", "내용")}</div><textarea className="mp-ta" value={editingLorebookEntry.content} onChange={(ev)=>setEditingLorebookEntry((s)=>({ ...s, content: ev.target.value }))} style={{minHeight:160,resize:"vertical"}} /></div>
              <div className="mp-row" style={{display:"flex",alignItems:"center",gap:8}}><input id="lb_enabled" type="checkbox" checked={!!editingLorebookEntry.enabled} onChange={(ev)=>setEditingLorebookEntry((s)=>({ ...s, enabled: ev.target.checked }))} /><label htmlFor="lb_enabled" className="mp-lbl" style={{margin:0}}>{tr("啟用", "Enable", "有効", "활성")} {tr("此條目", "this entry", "この項目", "이 항목")}</label></div>
              <div style={{display:"flex",gap:8,marginTop:8}}>
                <button className="mp-save" style={{flex:1,background:"linear-gradient(135deg,#b0bec5,#90a4ae)"}} onClick={() => setEditingLorebookEntry(null)}>{tr("取消", "Cancel", "キャンセル", "취소")}</button>
                <button className="mp-save" style={{flex:1}} onClick={saveEntry}>{tr("儲存", "Save", "保存", "저장")}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
}
