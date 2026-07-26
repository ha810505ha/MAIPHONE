import React from "react";

export default function ChatRoomSwitcher({ open, onClose, rooms, activeRoomId, onSwitchRoom, onCreateRoom, onRenameRoom, onDeleteRoom, onOpenSettings, tr }) {
  if (!open || !Array.isArray(rooms) || !rooms.length) return null;
  const formatUpdatedAt = (value) => {
    const time = Number(value) || 0;
    if (!time) return "";
    const date = new Date(time);
    return date.toLocaleDateString(undefined, { month: "numeric", day: "numeric" }) + " " + date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  };
  return (
    <div className="mp-overlay" style={{zIndex:90,alignItems:"flex-end",padding:0}} onClick={onClose}>
      <div style={{width:"100%",maxHeight:"72vh",overflowY:"auto",background:"var(--mp-surface)",borderRadius:"22px 22px 0 0",padding:"10px 14px 18px",boxShadow:"0 -12px 36px rgba(0,0,0,.2)"}} onClick={(event) => event.stopPropagation()}>
        <div style={{width:38,height:4,borderRadius:99,background:"color-mix(in srgb,var(--mp-txt-l) 35%,transparent)",margin:"0 auto 12px"}} />
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <div style={{fontSize:15,fontWeight:900,color:"var(--mp-txt)"}}>{tr("切換對話", "Switch chat", "会話を切り替え", "대화 전환")}</div>
          <button type="button" className="mp-ibtn" onClick={onClose}>×</button>
        </div>
        <div style={{display:"grid",gap:7}}>
          {rooms.map((room) => {
            const active = room.id === activeRoomId;
            return <button key={room.id} type="button" onClick={() => { onSwitchRoom?.(room.id); onClose?.(); }} style={{display:"flex",alignItems:"center",gap:10,width:"100%",border:active?"1px solid var(--mp-pink)":"1px solid color-mix(in srgb,var(--mp-txt-l) 18%,transparent)",borderRadius:14,padding:"10px 12px",background:active?"color-mix(in srgb,var(--mp-pink) 10%,var(--mp-surface))":"color-mix(in srgb,var(--mp-surface) 92%,var(--mp-txt) 8%)",color:"var(--mp-txt)",textAlign:"left"}}>
              <span style={{width:20,color:active?"var(--mp-pink-dk)":"transparent",fontWeight:900}}>✓</span>
              <span style={{flex:1,minWidth:0}}><b style={{display:"block",fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{room.title || tr("未命名對話", "Untitled chat", "無題の会話", "제목 없는 대화")}</b><small style={{display:"block",marginTop:3,color:"var(--mp-txt-l)",fontSize:9}}>{(room.messages || []).length} {tr("則訊息", "messages", "件のメッセージ", "개 메시지")} · {(room.memories || []).length} {tr("則記憶", "memories", "件の記憶", "개 기억")}{formatUpdatedAt(room.updatedAt) ? ` · ${formatUpdatedAt(room.updatedAt)}` : ""}</small></span>
            </button>;
          })}
        </div>
        <button type="button" className="mp-save" style={{marginTop:12}} onClick={() => { onCreateRoom?.(); onClose?.(); }}>＋ {tr("開始新對話", "Start a new chat", "新しい会話を始める", "새 대화 시작")}</button>
        <div style={{display:"flex",gap:7,marginTop:8}}>
          <button type="button" className="mp-ibtn" style={{flex:1}} onClick={() => { onRenameRoom?.(); onClose?.(); }}>✎ {tr("重新命名", "Rename", "名前を変更", "이름 변경")}</button>
          <button type="button" className="mp-ibtn-r" style={{flex:1}} disabled={rooms.length <= 1} onClick={() => { onDeleteRoom?.(); onClose?.(); }}>× {tr("刪除目前對話", "Delete current", "現在の会話を削除", "현재 대화 삭제")}</button>
        </div>
        <button type="button" style={{width:"100%",border:0,background:"transparent",color:"var(--mp-txt-l)",padding:"12px 4px 2px",fontSize:11,fontWeight:700}} onClick={() => { onClose?.(); onOpenSettings?.(); }}>{tr("聊天室設定…", "Chat settings…", "チャット設定…", "채팅 설정…")}</button>
      </div>
    </div>
  );
}
