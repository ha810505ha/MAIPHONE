const CHAT_IMAGE_MAX_BYTES = 1024 * 1024;

/**
 * Owns chat image input normalization and compression before an image enters
 * the message composer. The controller keeps the byte budget in one place so
 * future chat-image features do not grow the root phone component again.
 */
export default function useChatImageController({
  setChatImage,
  sanitizeImageUrl,
  showToast,
  tr,
}) {
  const handleImgUp = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || "");
      const safe = sanitizeImageUrl(raw);
      if (!safe) {
        showToast(tr("圖片格式不支援", "Unsupported image format", "画像形式に対応していません", "이미지 형식을 지원하지 않습니다"));
        return;
      }
      const image = new Image();
      image.onload = () => {
        const { width, height } = image;
        const candidates = [
          { maxEdge: 1280, quality: 0.8 },
          { maxEdge: 1024, quality: 0.72 },
          { maxEdge: 896, quality: 0.65 },
          { maxEdge: 768, quality: 0.58 },
        ];
        let picked = null;
        for (const candidate of candidates) {
          const maxSide = Math.max(width, height);
          const scale = maxSide > candidate.maxEdge ? (candidate.maxEdge / maxSide) : 1;
          const targetW = Math.max(1, Math.round(width * scale));
          const targetH = Math.max(1, Math.round(height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = targetW;
          canvas.height = targetH;
          const context = canvas.getContext("2d");
          if (!context) continue;
          context.drawImage(image, 0, 0, targetW, targetH);
          const output = canvas.toDataURL("image/jpeg", candidate.quality);
          const data = output.split(",")[1] || "";
          const bytes = Math.floor((data.length * 3) / 4);
          picked = {
            data,
            mime: "image/jpeg",
            bytes,
            width: targetW,
            height: targetH,
            quality: candidate.quality,
          };
          if (bytes <= CHAT_IMAGE_MAX_BYTES) break;
        }
        if (!picked || picked.bytes > CHAT_IMAGE_MAX_BYTES) {
          setChatImage(null);
          showToast(tr(
            "圖片壓縮到最低設定後仍超過 1MB，請改用裁切圖或內容更簡單的圖片",
            "Even after maximum compression, the image is still over 1MB. Please use a cropped or simpler image.",
            "最小圧縮後も1MBを超えています。トリミングした画像か、よりシンプルな画像を使ってください。",
            "최저 압축 후에도 1MB를 초과합니다. 잘라낸 이미지나 더 단순한 이미지를 사용해주세요.",
          ));
          return;
        }
        setChatImage(picked);
        showToast(`已壓縮圖片 ${picked.width}x${picked.height} / ${Math.round(picked.bytes / 1024)}KB`);
      };
      image.onerror = () => showToast(tr("圖片讀取失敗", "Image load failed", "画像の読み込みに失敗しました", "이미지 읽기에失敗しました"));
      image.src = safe;
    };
    reader.onerror = () => showToast(tr("圖片讀取失敗", "Image load failed", "画像の読み込みに失敗しました", "이미지 읽기에失敗しました"));
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  return { handleImgUp };
}
