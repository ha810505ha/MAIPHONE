import { useRef, useState } from "react";
import { calculateCropDrag, createImageCropState, drawCoverCrop } from "../../utils/imageCrop";

const AVATAR_INPUT_MAX_SIDE = 1024;
const AVATAR_OUTPUT_SIZE = 320;
const AVATAR_JPEG_QUALITY = 0.86;

export default function usePlayerProfileController({
  initialProfile,
  notify,
  sanitizeImage,
  tr,
}) {
  const [playerProfile, setPlayerProfile] = useState(initialProfile);
  const [playerAvatarCrop, setPlayerAvatarCrop] = useState(null);
  const playerAvatarRef = useRef(null);

  const notifyAvatarError = (key, translations) => notify(key, tr(...translations));

  const handlePlayerAvatarUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const safeSource = sanitizeImage(String(reader.result || ""));
      if (!safeSource) {
        notifyAvatarError("頭像格式不支援", [
          "頭像格式不支援",
          "Unsupported avatar format",
          "アバター形式に対応していません",
          "아바타 형식을 지원하지 않습니다",
        ]);
        return;
      }

      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, AVATAR_INPUT_MAX_SIDE / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) return;

        context.drawImage(image, 0, 0, width, height);
        const processed = sanitizeImage(canvas.toDataURL("image/jpeg", AVATAR_JPEG_QUALITY));
        if (!processed) {
          notifyAvatarError("頭像處理失敗", [
            "頭像處理失敗",
            "Avatar processing failed",
            "アバターの処理に失敗しました",
            "아바타 처리가 실패했습니다",
          ]);
          return;
        }
        setPlayerAvatarCrop(createImageCropState({ src: processed, width, height }));
      };
      image.onerror = () => notifyAvatarError("圖片讀取失敗", [
        "圖片讀取失敗",
        "Image load failed",
        "画像の読み込みに失敗しました",
        "이미지 읽기에 실패했습니다",
      ]);
      image.src = safeSource;
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const applyPlayerAvatarCrop = () => {
    if (!playerAvatarCrop?.src) return;

    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = AVATAR_OUTPUT_SIZE;
      canvas.height = AVATAR_OUTPUT_SIZE;
      const context = canvas.getContext("2d");
      if (!context) return;

      drawCoverCrop(context, image, playerAvatarCrop, AVATAR_OUTPUT_SIZE);
      const safeAvatar = sanitizeImage(canvas.toDataURL("image/jpeg", AVATAR_JPEG_QUALITY));
      if (!safeAvatar) {
        notifyAvatarError("頭像處理失敗", [
          "頭像處理失敗",
          "Avatar processing failed",
          "アバターの処理に失敗しました",
          "아바타 처리가 실패했습니다",
        ]);
        return;
      }

      setPlayerProfile((profile) => ({ ...(profile || {}), avatar: safeAvatar }));
      setPlayerAvatarCrop(null);
      notify("大頭貼已更新", tr(
        "大頭貼已更新",
        "Avatar updated",
        "アバターを更新しました",
        "프로필 사진이 업데이트되었습니다",
      ));
    };
    image.onerror = () => notifyAvatarError("圖片讀取失敗", [
      "圖片讀取失敗",
      "Image load failed",
      "画像の読み込みに失敗しました",
      "이미지 읽기에 실패했습니다",
    ]);
    image.src = playerAvatarCrop.src;
  };

  const startPlayerAvatarDrag = (event) => {
    if (!playerAvatarCrop) return;
    const pointerX = event.clientX ?? event.touches?.[0]?.clientX ?? 0;
    const pointerY = event.clientY ?? event.touches?.[0]?.clientY ?? 0;
    setPlayerAvatarCrop((crop) => ({
      ...(crop || {}),
      dragging: true,
      dragStartX: pointerX,
      dragStartY: pointerY,
      startPanX: crop?.panX || 0,
      startPanY: crop?.panY || 0,
    }));
  };

  const movePlayerAvatarDrag = (event) => {
    setPlayerAvatarCrop((crop) => {
      if (!crop?.dragging) return crop;
      const pointerX = event.clientX ?? event.touches?.[0]?.clientX ?? 0;
      const pointerY = event.clientY ?? event.touches?.[0]?.clientY ?? 0;
      return { ...crop, ...calculateCropDrag(crop, pointerX, pointerY) };
    });
  };

  const endPlayerAvatarDrag = () => {
    setPlayerAvatarCrop((crop) => crop ? { ...crop, dragging: false } : crop);
  };

  const onPlayerAvatarPointerDown = (event) => {
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {}
    startPlayerAvatarDrag(event);
  };

  const onPlayerAvatarPointerMove = (event) => {
    if (!playerAvatarCrop?.dragging) return;
    event.preventDefault();
    movePlayerAvatarDrag(event);
  };

  const onPlayerAvatarPointerUp = (event) => {
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {}
    endPlayerAvatarDrag();
  };

  return {
    applyPlayerAvatarCrop,
    handlePlayerAvatarUpload,
    onPlayerAvatarPointerDown,
    onPlayerAvatarPointerMove,
    onPlayerAvatarPointerUp,
    playerAvatarCrop,
    playerAvatarRef,
    playerProfile,
    setPlayerAvatarCrop,
    setPlayerProfile,
  };
}
