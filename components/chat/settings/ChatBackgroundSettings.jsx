import React from "react";

export default function ChatBackgroundSettings({ currentChatChar, chatSettingsBackgroundOpen, setChatSettingsBackgroundOpen, chatBackgrounds, normalizeChatBackground, getChatBackgroundLayerStyle, getChatBackgroundBlurFilter, onChatBackgroundFile, chatBgEditor, setChatBgEditor, updateChatBackground, tr }) {
  return (
    <div className="mp-cc">
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
        onClick={() => {
          setChatSettingsBackgroundOpen((v) => {
            const next = !v;
            if (!next) setChatBgEditor(null);
            return next;
          });
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700 }}>{tr("聊天室背景", "Chat background", "チャット背景", "채팅 배경")}</div>
        <div style={{ fontSize: 11, color: "var(--mp-txt-l)" }}>
          {chatSettingsBackgroundOpen ? tr("收合", "Collapse", "折りたたむ", "접기") : tr("展開", "Expand", "展開", "펼치기")} · {normalizeChatBackground(chatBackgrounds?.[currentChatChar.id] || {}).src ? tr("已設定", "Set", "設定済み", "설정됨") : tr("未設定", "Not set", "未設定", "미설정")}
        </div>
      </div>
      {chatSettingsBackgroundOpen && (<>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div
          style={{
            width: 72,
            height: 112,
            borderRadius: 14,
            overflow: "hidden",
            border: "1px solid rgba(231,197,214,.8)",
            background: "linear-gradient(135deg,#fff,#f7eef6)",
            boxShadow: "0 2px 8px rgba(0,0,0,.04)",
            position: "relative",
          }}
        >
          {normalizeChatBackground(chatBackgrounds?.[currentChatChar.id] || {}).src && (
            <div
              style={{
                ...getChatBackgroundLayerStyle(chatBackgrounds?.[currentChatChar.id] || {}),
                filter: getChatBackgroundBlurFilter(chatBackgrounds?.[currentChatChar.id] || {}),
              }}
            />
          )}
        </div>
        <input
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          id={`chat-bg-${currentChatChar.id}`}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onChatBackgroundFile(currentChatChar.id, file);
            e.target.value = "";
          }}
        />
        <button className="mp-ibtn" style={{ padding: "6px 12px", fontSize: 12, lineHeight: 1 }} onClick={() => document.getElementById(`chat-bg-${currentChatChar.id}`)?.click()}>
          {tr("上傳", "Upload", "アップロード", "업로드")}
        </button>
        <button className="mp-ibtn" style={{ padding: "6px 12px", fontSize: 12, lineHeight: 1 }} onClick={() => {
          const current = normalizeChatBackground(chatBackgrounds?.[currentChatChar.id] || {});
          setChatBgEditor({
            charId: currentChatChar.id,
            ...current,
            dragging: false,
            dragStartX: 0,
            dragStartY: 0,
            startX: 0,
            startY: 0,
          });
        }}>
          {tr("調整", "Adjust", "調整", "조정")}
        </button>
        <button className="mp-ibtn-r" style={{ padding: "6px 12px", fontSize: 12, lineHeight: 1 }} onClick={() => { updateChatBackground(currentChatChar.id, ""); setChatBgEditor(null); }}>
          {tr("清除", "Clear", "クリア", "지우기")}
        </button>
      </div>
      <div style={{ fontSize: 11, color: "var(--mp-txt-l)", marginTop: 6 }}>
        {tr("未設定時會維持原本底色。", "If not set, the default background color stays.", "未設定の場合は既定の背景色のままです。", "미설정 시 기본 배경색을 유지합니다.")}
      </div>
      {chatBgEditor?.charId === currentChatChar.id && chatBgEditor.src && (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "rgba(255,255,255,.72)", border: "1px solid rgba(231,197,214,.55)" }}>
          <div
            style={{
              width: "100%",
              aspectRatio: "9 / 16",
              maxHeight: 360,
              borderRadius: 14,
              overflow: "hidden",
              position: "relative",
              background: "#f8f1f6",
              touchAction: "none",
              border: "1px solid rgba(231,197,214,.6)",
              marginBottom: 10,
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,.45)",
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch (_) {}
              setChatBgEditor((s) => s ? { ...s, dragging: true, dragStartX: e.clientX || 0, dragStartY: e.clientY || 0, startX: s.x || 0, startY: s.y || 0 } : s);
            }}
            onPointerMove={(e) => {
              if (!chatBgEditor?.dragging) return;
              e.preventDefault();
              const dx = ((e.clientX || 0) - (chatBgEditor.dragStartX || 0)) / 2;
              const dy = ((e.clientY || 0) - (chatBgEditor.dragStartY || 0)) / 2;
              setChatBgEditor((s) => s ? { ...s, x: Math.max(-50, Math.min(50, (s.startX || 0) - dx)), y: Math.max(-50, Math.min(50, (s.startY || 0) - dy)) } : s);
            }}
            onPointerUp={(e) => {
              try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch (_) {}
              setChatBgEditor((s) => s ? { ...s, dragging: false } : s);
            }}
            onPointerCancel={(e) => {
              try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch (_) {}
              setChatBgEditor((s) => s ? { ...s, dragging: false } : s);
            }}
            >
              <div
                style={{
                  ...getChatBackgroundLayerStyle(chatBgEditor),
                  filter: getChatBackgroundBlurFilter(chatBgEditor),
                }}
              />
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: "linear-gradient(rgba(255,255,255,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.18) 1px, transparent 1px)",
                backgroundSize: "24px 24px",
                backgroundPosition: "center center",
                mixBlendMode: "soft-light",
                opacity: .55,
                pointerEvents: "none",
              }}
            />
            <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, transform: "translateX(-50%)", background: "rgba(255,255,255,.58)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, transform: "translateY(-50%)", background: "rgba(255,255,255,.58)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", left: "50%", top: "50%", width: 12, height: 12, transform: "translate(-50%, -50%)", borderRadius: 999, border: "2px solid rgba(255,255,255,.92)", boxShadow: "0 0 0 2px rgba(244,143,177,.22)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,.08)" }} />
            <div style={{ position: "absolute", inset: 0, border: "2px solid rgba(255,255,255,.88)", borderRadius: 14, boxShadow: "0 0 0 9999px rgba(255,255,255,.10)", pointerEvents: "none" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "var(--mp-txt-l)" }}>{tr("縮放", "Zoom", "ズーム", "확대")}</span>
            <input
              type="range"
              min="1"
              max="2.2"
              step="0.01"
              value={chatBgEditor.zoom || 1}
              onChange={(e) => setChatBgEditor((s) => s ? { ...s, zoom: Number(e.target.value) } : s)}
              style={{ flex: 1 }}
            />
            <button
              className="mp-ibtn"
              style={{ padding: "6px 10px", fontSize: 11, lineHeight: 1 }}
              onClick={() => {
                const current = normalizeChatBackground(chatBackgrounds?.[currentChatChar.id] || {});
                setChatBgEditor({ charId: currentChatChar.id, ...current, dragging: false, dragStartX: 0, dragStartY: 0, startX: 0, startY: 0 });
              }}
            >
              {tr("重置", "Reset", "リセット", "초기화")}
            </button>
            <button
              className="mp-ibtn"
              style={{ padding: "6px 10px", fontSize: 11, lineHeight: 1 }}
              onClick={() => setChatBgEditor((s) => s ? { ...s, blur: 0 } : s)}
            >
              {tr("無模糊", "No blur", "ぼかしなし", "흐림 없음")}
            </button>
            <button
              className="mp-save"
              style={{ padding: "6px 10px", fontSize: 11, lineHeight: 1, minWidth: 72 }}
              onClick={() => {
                updateChatBackground(currentChatChar.id, {
                  src: chatBgEditor.src,
                  x: chatBgEditor.x,
                  y: chatBgEditor.y,
                  zoom: chatBgEditor.zoom,
                  blur: chatBgEditor.blur,
                });
                setChatBgEditor((s) => s ? { ...s, dragging: false } : s);
              }}
            >
              {tr("套用", "Apply", "適用", "적용")}
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <span style={{ fontSize: 11, color: "var(--mp-txt-l)" }}>{tr("模糊", "Blur", "ぼかし", "흐림")}</span>
            <input
              type="range"
              min="0"
              max="24"
              step="1"
              value={chatBgEditor.blur || 0}
              onChange={(e) => setChatBgEditor((s) => s ? { ...s, blur: Number(e.target.value) } : s)}
              style={{ flex: 1 }}
            />
            <span style={{ width: 32, textAlign: "right", fontSize: 11, color: "var(--mp-txt-l)" }}>{Math.round(chatBgEditor.blur || 0)}px</span>
          </div>
        </div>
      )}
      </>)}
    </div>
  );
}
