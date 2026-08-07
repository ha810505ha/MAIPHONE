import React, { useEffect, useMemo, useRef, useState } from "react";
import ChatMessageRenderer from "./ChatMessageRenderer";
import { downloadImageFile } from "../../utils/exportFile";
import MotionPresence from "../motion/MotionPresence.jsx";

const LIMITS = { messages: 15, images: 4, outputHeight: 8000, width: 430, scale: 2 };

const canvasToPngBlob = (canvas) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG 圖片產生失敗")), "image/png");
});

const normalizeModernColors = (value) => String(value || "").replace(/color\(srgb\s+([^)]*)\)/gi, (_, body) => {
  const [channels, alphaPart] = body.split("/").map((part) => part.trim());
  const values = channels.split(/\s+/).slice(0, 3).map((part) => Math.round(Math.max(0, Math.min(1, Number.parseFloat(part))) * 255));
  if (values.length !== 3 || values.some((part) => !Number.isFinite(part))) return "rgba(0,0,0,0)";
  const alpha = alphaPart == null ? 1 : Math.max(0, Math.min(1, Number.parseFloat(alphaPart)));
  return `rgba(${values[0]},${values[1]},${values[2]},${Number.isFinite(alpha) ? alpha : 1})`;
});

const screenshotFallback = (property) => ({
  color: "#4b3741",
  "background-color": "transparent",
  "background-image": "none",
  "border-top-color": "#ead8df",
  "border-right-color": "#ead8df",
  "border-bottom-color": "#ead8df",
  "border-left-color": "#ead8df",
  "outline-color": "#c85a7e",
  "box-shadow": "none",
  "text-shadow": "none",
  "text-decoration-color": "#4b3741",
}[property] || "transparent");

const sanitizeScreenshotCloneColors = (clonedDocument) => {
  const root = clonedDocument.querySelector("[data-chat-screenshot-capture]");
  if (!root) return;
  const properties = ["color", "background-color", "background-image", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color", "outline-color", "box-shadow", "text-shadow", "text-decoration-color"];
  [root, ...root.querySelectorAll("*")].forEach((node) => {
    const computed = clonedDocument.defaultView?.getComputedStyle(node);
    if (!computed) return;
    properties.forEach((property) => {
      const value = computed.getPropertyValue(property);
      if (!value) return;
      const normalized = normalizeModernColors(value);
      const safeValue = /color-mix\(|\bvar\(/i.test(normalized)
        ? screenshotFallback(property)
        : normalized;
      if (safeValue !== value) node.style.setProperty(property, safeValue, "important");
    });
  });
};

const getCaptureSafeCss = (isNightTheme) => {
  const palette = isNightTheme
    ? { page: "#181420", surface: "#2f2440", text: "#f0e6f5", muted: "#b8a8c9", line: "#4a3a61", accent: "#f48fb1", accentSoft: "#4b3a62", user: "#d95e88" }
    : { page: "#fffafc", surface: "#fff", text: "#4b3741", muted: "#927482", line: "#ead8df", accent: "#c85a7e", accentSoft: "#fde4ec", user: "#df7196" };
  return `
    .mp-chat-capture{--mp-txt:${palette.text}!important;--mp-txt-l:${palette.muted}!important;--mp-surface:${palette.surface}!important;--mp-line:${palette.line}!important;--mp-pink-dk:${palette.accent}!important;--mp-pink-lt:${palette.accentSoft}!important;--mp-glass:${palette.surface}!important;--mp-glass-b:${palette.line}!important;--mp-glass-s:none!important;background:${palette.page}!important;color:${palette.text}!important}
    .mp-chat-capture,.mp-chat-capture *{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
    .mp-chat-capture .mp-msg-ai{background:${palette.surface}!important;color:${palette.text}!important;border-color:${palette.line}!important;box-shadow:0 4px 12px rgba(76,47,62,.12)!important}
    .mp-chat-capture .mp-msg-user{background:${palette.user}!important;color:#fff!important;box-shadow:0 4px 12px rgba(136,58,87,.18)!important}
    .mp-chat-capture .mp-msg-note,.mp-chat-capture .mp-thought-content{background:${palette.surface}!important;color:${palette.text}!important;border-color:${palette.line}!important}
    .mp-chat-capture .mp-hdr,.mp-chat-capture .mp-inp-bar{background:${palette.surface}!important;border-color:${palette.line}!important;color:${palette.text}!important}
    .mp-chat-capture .mp-inp{background:${isNightTheme ? "#251c32" : "#fffafc"}!important;color:${palette.muted}!important;border-color:${palette.line}!important}
    .mp-chat-capture *::before,.mp-chat-capture *::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
  `;
};

export default function ChatScreenshotModal({ open, onClose, onReselect, messages, initialSelectedIds = [], character, modelShort, sceneBar, mode, rendererProps, backgroundUrl, isNightTheme = false, tr }) {
  const captureRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [renderedOutputHeight, setRenderedOutputHeight] = useState(0);
  const candidates = useMemo(() => (messages || []).filter((message) => message?.id), [messages]);
  const selected = useMemo(() => {
    const ids = new Set(initialSelectedIds);
    return candidates.filter((message) => ids.has(message.id));
  }, [candidates, initialSelectedIds]);
  const stats = useMemo(() => ({
    chars: selected.reduce((sum, message) => sum + String(message.content || "").length, 0),
    images: selected.filter((message) => message.image).length,
  }), [selected]);

  useEffect(() => {
    if (!open) {
      setRenderedOutputHeight(0);
      return undefined;
    }
    const element = captureRef.current;
    if (!element) return undefined;
    const measure = () => setRenderedOutputHeight(Math.ceil(element.scrollHeight * LIMITS.scale));
    const frame = requestAnimationFrame(measure);
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(element);
    const images = Array.from(element.querySelectorAll("img"));
    images.forEach((image) => {
      image.addEventListener("load", measure);
      image.addEventListener("error", measure);
    });
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      images.forEach((image) => {
        image.removeEventListener("load", measure);
        image.removeEventListener("error", measure);
      });
    };
  }, [open, selected]);

  const validate = () => {
    if (!selected.length) return tr("沒有可截圖的訊息，請重新選取", "No messages selected; choose the range again", "メッセージが選択されていません。選び直してください", "선택된 메시지가 없습니다. 다시 선택하세요");
    if (selected.length > LIMITS.messages) return tr("選取範圍超過 15 則，請縮短範圍", "The range exceeds 15 messages", "範囲が15件を超えています", "선택 범위가 15개를 넘습니다");
    if (stats.images > LIMITS.images) return tr("選取範圍超過 4 張圖片，請縮短範圍", "The range contains more than 4 images", "画像が4枚を超えています", "이미지가 4장을 넘습니다");
    if (renderedOutputHeight > LIMITS.outputHeight) return tr("截圖內容過長，請縮短選取範圍", "The screenshot is too tall; shorten the selected range", "画像が長すぎます。選択範囲を短くしてください", "캡처가 너무 깁니다. 선택 범위를 줄여 주세요");
    return "";
  };
  const issue = validate();

  const capture = async () => {
    if (issue) { setError(issue); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const element = captureRef.current;
      if (!element) throw new Error(tr("截圖畫面尚未準備完成", "Screenshot is not ready", "画像の準備ができていません", "캡처 화면이 준비되지 않았습니다"));
      const images = Array.from(element.querySelectorAll("img"));
      await Promise.all(images.map((image) => image.complete ? Promise.resolve() : new Promise((resolve) => { image.onload = resolve; image.onerror = resolve; })));
      if (element.scrollHeight * LIMITS.scale > LIMITS.outputHeight) throw new Error(tr("截圖內容過長，請縮短選取範圍", "The screenshot is too tall; shorten the selected range", "画像が長すぎます。選択範囲を短くしてください", "캡처가 너무 깁니다. 선택 범위를 줄여 주세요"));
      const pageBackground = window.getComputedStyle(element.closest(".mp-page") || element).background;
      if (pageBackground && pageBackground !== "none") element.style.background = pageBackground;
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(element, { backgroundColor: isNightTheme ? "#181420" : "#fffafc", scale: LIMITS.scale, useCORS: true, logging: false, width: LIMITS.width, windowWidth: LIMITS.width, onclone: sanitizeScreenshotCloneColors });
      const blob = await canvasToPngBlob(canvas);
      const safeName = String(character?.name || "chat").replace(/[\\/:*?"<>|]+/g, "_");
      const result = await downloadImageFile(blob, `${safeName}-chat-${new Date().toISOString().slice(0, 10)}.png`, { preferBrowserDownload: true });
      if (result?.method === "native-filesystem") setNotice(`已儲存到 Documents/${result.path}`);
      else if (result?.method !== "cancelled") setNotice(tr("PNG 已下載", "PNG downloaded", "PNGを保存しました", "PNG를 저장했습니다"));
    } catch (reason) {
      setError(reason?.message || tr("截圖產生或儲存失敗", "Failed to create or save screenshot", "画像の作成または保存に失敗しました", "캡처 생성 또는 저장에 실패했습니다"));
    } finally { setBusy(false); }
  };

  const staticRendererProps = { ...rendererProps, messages: selected, activeMessageId: null, setActiveMessageId: () => {}, highlightedThoughtMessageId: null, isTyping: false, startNoticeLongPress: () => {}, cancelNoticeLongPress: () => {}, retryChatFromNotice: () => {}, deleteChatMessage: () => {}, setMessageEditor: () => {}, renderCharacterVoiceAction: () => null };

  return <MotionPresence show={open}>
  {open && <div className="mp-overlay" style={{ zIndex: 120 }} onClick={busy ? undefined : onClose}>
    <div className="mp-modal" style={{ width: "min(86%,360px)", padding: 16 }} onClick={(event) => event.stopPropagation()}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div className="mp-modal-t" style={{ flex: 1, margin: 0 }}>{tr("確認聊天截圖", "Confirm screenshot", "チャット画像の確認", "채팅 캡처 확인")}</div>
        <button type="button" aria-label={tr("關閉", "Close", "閉じる", "닫기")} disabled={busy} onClick={onClose} style={{ width: 30, height: 30, border: 0, borderRadius: "50%", background: "var(--mp-pink-lt)", color: "var(--mp-txt)", fontSize: 17 }}>×</button>
      </div>
      <div style={{ marginTop: 12, padding: "11px 12px", borderRadius: 13, background: "color-mix(in srgb,var(--mp-pink) 8%,var(--mp-surface))", color: "var(--mp-txt)", fontSize: 12, lineHeight: 1.7 }}>
        已選取 <b>{selected.length}</b> 則 · <b>{stats.chars}</b> 字 · <b>{stats.images}</b> 張圖片
        {renderedOutputHeight > 0 && <> · 輸出高度 <b>{renderedOutputHeight.toLocaleString()}</b> / {LIMITS.outputHeight.toLocaleString()} px</>}
      </div>
      {(issue || error) && <div style={{ marginTop: 9, color: "#d94b68", fontSize: 11, lineHeight: 1.5 }}>{error || issue}</div>}
      {notice && <div style={{ marginTop: 9, color: "#4a9b68", fontSize: 11, lineHeight: 1.5 }}>{notice}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 13 }}>
        <button type="button" className="mp-save" style={{ flex: 1, background: "linear-gradient(135deg,#b0bec5,#90a4ae)" }} disabled={busy} onClick={onReselect}>{tr("重新選取", "Reselect", "選び直す", "다시 선택")}</button>
        <button type="button" className="mp-save" style={{ flex: 1 }} disabled={busy || !!issue} onClick={capture}>{busy ? tr("產生中…", "Creating…", "作成中…", "생성 중…") : tr("儲存 PNG", "Save PNG", "PNGを保存", "PNG 저장")}</button>
      </div>
    </div>
    <div aria-hidden="true" style={{ position: "fixed", left: -12000, top: 0, width: LIMITS.width, pointerEvents: "none" }}>
      <div ref={captureRef} data-chat-screenshot-capture className={`mp-chat-capture mp-chat-mode-${mode}`} style={{ boxSizing: "border-box", width: LIMITS.width, minHeight: 860, display: "flex", flexDirection: "column", overflow: "hidden", background: isNightTheme ? "linear-gradient(180deg,#241b33,#181420)" : "linear-gradient(180deg,#fce4ec,#fffafc)", color: "var(--mp-txt)" }}>
        <style>{`${getCaptureSafeCss(isNightTheme)}.mp-chat-capture .mp-mode-sep:before{background:linear-gradient(90deg,transparent,rgba(95,118,131,.4))}.mp-chat-capture .mp-mode-sep:after{background:linear-gradient(90deg,rgba(95,118,131,.4),transparent)}.mp-chat-capture .mp-mode-sep span{border-color:rgba(95,118,131,.22)}`}</style>
        <div className="mp-hdr" style={{ minHeight: 64, boxSizing: "border-box" }}>
          <div className="mp-back">←</div>
          <span style={{ color: "var(--mp-pink-dk)", fontSize: 17 }}>♥</span>
          <div className="mp-htitle" style={{ flex: 1, minWidth: 0 }}>{character?.name || ""}</div>
          <div style={{ minWidth: 62, height: 38, display: "grid", placeItems: "center", border: "1px solid var(--mp-line)", borderRadius: 12, background: "var(--mp-glass)", color: "var(--mp-txt)", fontSize: 11, fontWeight: 800 }}>{modelShort || "AI"}</div>
          <div style={{ minWidth: 54, height: 38, display: "grid", placeItems: "center", border: "1px solid var(--mp-line)", borderRadius: 12, background: "var(--mp-glass)", color: "var(--mp-txt)", fontSize: 11, fontWeight: 800 }}>{tr("設定", "Settings", "設定", "설정")}</div>
        </div>
        <div style={{ position: "relative", minHeight: 0, overflow: "hidden", flex: "1 0 auto", display: "flex", flexDirection: "column" }}>
          {backgroundUrl && <><div style={{ position: "absolute", inset: 0, background: `url(${backgroundUrl}) center/cover`, zIndex: 0 }} /><div style={{ position: "absolute", inset: 0, background: isNightTheme ? "rgba(18,12,28,.46)" : "rgba(255,255,255,.52)", zIndex: 0 }} /></>}
          {sceneBar && <div style={{ position: "relative", zIndex: 1 }}>{sceneBar}</div>}
          <div className="mp-msgs" style={{ position: "relative", zIndex: 1, height: "auto", minHeight: 650, overflow: "visible", flex: "1 0 auto", paddingTop: 12, paddingBottom: 18 }}><ChatMessageRenderer {...staticRendererProps} tr={tr} /></div>
        </div>
        <div className="mp-inp-bar" style={{ minHeight: 68, boxSizing: "border-box" }}>
          <div className="mp-btn mp-btn-img" style={{ display: "grid", placeItems: "center" }}>＋</div>
          <div className="mp-inp" style={{ flex: 1, color: "var(--mp-txt-l)", display: "flex", alignItems: "center" }}>{tr("輸入訊息...", "Type a message...", "メッセージを入力...", "메시지를 입력...")}</div>
          <div className="mp-btn mp-btn-send" style={{ display: "grid", placeItems: "center" }}>➤</div>
        </div>
      </div>
    </div>
  </div>}
  </MotionPresence>;
}
