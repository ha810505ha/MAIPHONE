import React from "react";
import { sanitizeUserImageUrl } from "../../utils/coreUtils";

export default function GroupMemberPicker({
  characters,
  selectedIds,
  setSelectedIds,
  search,
  setSearch,
  tr,
  showToast,
}) {
  return (
    <>
      <input
        className="mp-sinp"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={tr("搜尋角色名稱", "Search characters", "キャラを検索", "캐릭터 검색")}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 11, color: "var(--mp-txt-l)", marginTop: 6 }}>
        <span>{tr("最多 5 位角色", "Up to 5 characters", "最大5人まで", "최대 5명")}</span>
        <span>{tr("已選", "Selected", "選択", "선택")} {selectedIds.length}/5</span>
      </div>
      <div style={{ marginTop: 6, maxHeight: 300, overflowY: "auto", paddingRight: 2 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 4 }}>
          {characters
            .filter((character) => character.name?.includes(search.trim()) || !search.trim())
            .map((character) => {
              const selected = selectedIds.includes(character.id);
              const disabled = !selected && selectedIds.length >= 5;
              const avatar = sanitizeUserImageUrl(character.avatar);
              return (
                <button
                  key={character.id}
                  type="button"
                  className="mp-group-pick"
                  style={{
                    minHeight: 94,
                    border: "none",
                    boxShadow: "none",
                    opacity: disabled ? 0.45 : (selected ? 1 : 0.5),
                    background: "transparent",
                  }}
                  onClick={() => {
                    if (selected) {
                      setSelectedIds((previous) => previous.filter((id) => id !== character.id));
                      return;
                    }
                    if (selectedIds.length >= 5) {
                      showToast(tr("最多只能加入 5 位角色", "You can add up to 5 characters", "追加できるのは最大5人です", "최대 5명까지만 추가할 수 있습니다"));
                      return;
                    }
                    setSelectedIds((previous) => [...previous, character.id]);
                  }}
                >
                  <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", borderRadius: 14, overflow: "hidden", background: "transparent", display: "flex", alignItems: "end", justifyContent: "start" }}>
                    {avatar ? (
                      <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", background: "linear-gradient(135deg,#fce4ec,#e1f5fe)", color: "#5c6f7b", fontSize: 24, fontWeight: 800 }}>
                        {character.name?.[0] || "🙂"}
                      </div>
                    )}
                    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "12px 5px 6px", background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.48) 100%)", color: "#fff", fontSize: 11, fontWeight: 700, lineHeight: 1.05, boxSizing: "border-box" }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{character.name}</div>
                    </div>
                    {selected && <div style={{ position: "absolute", top: 4, right: 4, width: 16, height: 16, borderRadius: 999, background: "rgba(184,122,65,.95)", color: "#fff", display: "grid", placeItems: "center", fontSize: 10, boxShadow: "0 4px 10px rgba(0,0,0,.18)" }}>✓</div>}
                  </div>
                </button>
              );
            })}
        </div>
      </div>
    </>
  );
}
