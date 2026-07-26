import { useEffect, useState } from "react";
import { getGalleryImageUrl, releaseGalleryImageUrl } from "../../services/images/galleryImageStorage.js";

/**
 * 只在 enabled=true 時讀取相簿 Blob，並保證卸載、切換 id 或非同步競態時釋放 Object URL。
 * 縮圖元件應把 enabled 接到 IntersectionObserver，避免離屏圖片進入記憶體。
 */
export default function useGalleryImageUrl(id, enabled = true) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    let active = true;
    let acquired = false;
    setUrl("");
    if (!id || !enabled) return () => { active = false; };

    getGalleryImageUrl(id).then((nextUrl) => {
      if (!nextUrl) return;
      acquired = true;
      if (active) setUrl(nextUrl);
      else releaseGalleryImageUrl(id);
    }).catch(() => {
      if (active) setUrl("");
    });

    return () => {
      active = false;
      if (acquired) releaseGalleryImageUrl(id);
    };
  }, [id, enabled]);

  return url;
}
