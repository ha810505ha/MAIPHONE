import {
  compressChatBackgroundFile,
  getChatBackgroundBlurFilter as createBlurFilter,
  getChatBackgroundLayerStyle as createLayerStyle,
  normalizeChatBackground as normalizeBackground,
} from "../../services/images/chatBackgroundService";

export default function useChatBackground({ setChatBackgrounds, setChatBgEditor, sanitizeImageUrl, showToast, tr }) {
  const normalizeChatBackground = (background) => normalizeBackground(background, sanitizeImageUrl);
  const getChatBackgroundLayerStyle = (background, extraScale = 1, fitAxis = "height") => createLayerStyle(background, normalizeChatBackground, extraScale, fitAxis);
  const getChatBackgroundBlurFilter = (background) => createBlurFilter(background, normalizeChatBackground);
  const updateChatBackground = (characterId, background) => {
    setChatBackgrounds((previous) => ({ ...previous, [characterId]: normalizeChatBackground(background) }));
  };
  const onChatBackgroundFile = (characterId, file) => {
    if (!characterId || !file) return;
    compressChatBackgroundFile(file, {
      sanitizeImageUrl,
      onSuccess: (source) => {
        const next = { src: source, x: 0, y: 0, zoom: 1, blur: 0 };
        updateChatBackground(characterId, next);
        setChatBgEditor({ charId: characterId, ...next, dragging: false, dragStartX: 0, dragStartY: 0, startX: 0, startY: 0 });
        showToast(tr("聊天室背景已更新", "Chat background updated", "チャット背景を更新しました", "채팅 배경이 업데이트되었습니다"));
      },
      onError: (reason) => {
        if (reason === "unsupported") return showToast(tr("圖片格式不支援", "Unsupported image format", "画像形式に対応していません", "이미지 형식을 지원하지 않습니다"));
        if (reason === "too_large") return showToast(tr("圖片壓縮後仍過大，請改用尺寸更小或內容較簡單的圖片", "The image is still too large after compression. Please use a smaller or simpler image.", "圧縮後も画像が大きすぎます。もっと小さい、またはシンプルな画像を使ってください。", "압축 후에도 이미지가 너무 큽니다. 더 작거나 단순한 이미지를 사용해주세요."));
        if (reason === "load") return showToast(tr("圖片讀取失敗", "Image load failed", "画像の読み込みに失敗しました", "이미지 읽기에 실패했습니다"));
        showToast(tr("圖片處理失敗", "Image processing failed", "画像処理に失敗しました", "이미지 처리에 실패했습니다"));
      },
    });
  };
  return { normalizeChatBackground, getChatBackgroundLayerStyle, getChatBackgroundBlurFilter, updateChatBackground, onChatBackgroundFile };
}
