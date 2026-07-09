import React from "react";

export default function ChatLorebookSettings({ chatSettingsLorebookOpen, setChatSettingsLorebookOpen, binding, lorebooks, chatSettingsExpandedBooks, setChatSettingsExpandedBooks, toggleChatLorebookBook, setAllChatLorebookEntries, toggleChatLorebookEntry, cycleChatLorebookEntryMode, currentChatChar, armAppClickSuppression, tr }) {
  return (
    <div className="mp-cc">
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
        onClick={() => setChatSettingsLorebookOpen((v) => !v)}
      >
        <div style={{ fontSize: 13, fontWeight: 700 }}>{tr("世界書綁定", "Lorebook binding", "ワールドブック連携", "월드북 연결")}</div>
        <div style={{ fontSize: 11, color: "var(--mp-txt-l)" }}>{chatSettingsLorebookOpen ? `${tr("收合", "Collapse", "折りたたむ", "접기")} · ${binding.enabledBookIds.length} ${tr("啟用", "enabled", "有効", "활성화")}` : `${tr("展開", "Expand", "展開", "펼치기")} · ${binding.enabledBookIds.length} ${tr("啟用", "enabled", "有効", "활성화")}`}</div>
      </div>
      {chatSettingsLorebookOpen && (
        <div style={{ marginTop: 8 }}>
          {(lorebooks || []).length === 0 && <div style={{ fontSize: 11, color: "var(--mp-txt-l)" }}>{tr("尚無世界書", "No lorebooks yet", "まだ世界観がありません", "아직 월드북이 없습니다")}</div>}
          {(lorebooks || []).map((book) => {
            const bookOn = binding.enabledBookIds.includes(book.id);
            const isExpanded = !!chatSettingsExpandedBooks[book.id];
            return (
              <div key={book.id} style={{ marginBottom: 10, border: "1px solid rgba(244,143,177,.2)", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, padding: "10px 10px 8px", background: "rgba(244,143,177,.08)" }}>
                  <input type="checkbox" checked={bookOn} onChange={() => toggleChatLorebookBook(currentChatChar.id, book.id)} />
                  <span style={{ flex: 1 }}>{book.name || tr("未命名世界書", "Untitled lorebook", "無題の世界観", "이름 없는 월드북")}</span>
                  <span style={{ fontSize: 10, color: "var(--mp-txt-l)", fontWeight: 600 }}>{(book.entries || []).length} {tr("條目", "entries", "項目", "항목")}</span>
                  <button
                    className="mp-ibtn"
                    style={{ padding: "2px 8px", fontSize: 10 }}
                    onClick={(e) => { e.stopPropagation(); armAppClickSuppression(); setChatSettingsExpandedBooks((prev) => ({ ...prev, [book.id]: !isExpanded })); }}
                  >
                    {isExpanded ? tr("收合", "Collapse", "折りたたむ", "접기") : tr("展開", "Expand", "展開", "펼치기")}
                  </button>
                </div>
                {isExpanded && (
                  <div style={{ padding: "8px 10px 10px", background: "#fff" }}>
                    <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                      <button className="mp-ibtn" style={{ fontSize: 10, padding: "2px 8px" }} disabled={!bookOn} onClick={(e) => { e.stopPropagation(); armAppClickSuppression(); setAllChatLorebookEntries(currentChatChar.id, book, true); }}>Select all</button>
                      <button className="mp-ibtn" style={{ fontSize: 10, padding: "2px 8px" }} disabled={!bookOn} onClick={(e) => { e.stopPropagation(); armAppClickSuppression(); setAllChatLorebookEntries(currentChatChar.id, book, false); }}>Select none</button>
                      {!bookOn && <span style={{ fontSize: 10, color: "var(--mp-txt-l)", marginLeft: "auto" }}>Enable this lorebook first</span>}
                    </div>
                    <div style={{ display: "grid", gap: 6, maxHeight: 220, overflowY: "auto", paddingRight: 2 }}>
                    {(book.entries || []).map((entry) => {
                      const entryOn = Object.prototype.hasOwnProperty.call(binding.entryOverrides, entry.id)
                        ? !!binding.entryOverrides[entry.id]
                        : !!entry.enabled;
                      const mode = binding.entryModes?.[entry.id] || "AUTO";
                      const modeColor = mode === "PIN" ? "#1e88e5" : "#43a047";
                      return (
                        <label key={entry.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--mp-txt-l)", padding: "4px 2px" }}>
                          <input type="checkbox" checked={entryOn} disabled={!bookOn} onChange={() => toggleChatLorebookEntry(currentChatChar.id, entry.id, !!entry.enabled)} />
                          <span style={{flex:1}}>{entry.title || "Untitled entry"}</span>
                          <button
                            className="mp-ibtn"
                            disabled={!bookOn}
                            style={{ fontSize: 10, padding: "1px 8px", borderColor: modeColor, color: modeColor }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              armAppClickSuppression();
                              cycleChatLorebookEntryMode(currentChatChar.id, entry.id);
                            }}
                            title={tr("AUTO=keyword match, PIN=pinned", "AUTO=keyword match, PIN=pinned", "AUTO=キーワード一致、PIN=固定", "AUTO=키워드 일치, PIN=고정")}
                          >
                            {mode}
                          </button>
                        </label>
                      );
                    })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
