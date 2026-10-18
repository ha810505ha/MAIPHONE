export const CLOUD_MEDIA_SYNC_TEXT = {
  uploadConfirm: {
    "zh-TW": "同步前請先確認你已有本機備份。這會用此裝置的存檔覆蓋雲端存檔，並上傳頭像、背景與桌布；聊天圖片、相簿、語音快取與 API Key 不會上傳。要繼續嗎？",
    "zh-CN": "同步前请先确认你已有本地备份。这会用此设备的存档覆盖云端存档，并上传头像、背景与壁纸；聊天图片、相册、语音缓存与 API Key 不会上传。要继续吗？",
    en: "Make sure you have a local backup first. This replaces the cloud save with this device's save and uploads avatars, backgrounds, and wallpapers. Chat images, the gallery, voice cache, and API keys are not uploaded. Continue?",
    ja: "先にローカルバックアップがあることを確認してください。この端末のセーブデータでクラウドのセーブデータを上書きし、アバター、背景、壁紙をアップロードします。チャット画像、アルバム、音声キャッシュ、API キーはアップロードされません。続行しますか？",
    ko: "먼저 로컬 백업이 있는지 확인하세요. 이 기기의 저장 데이터로 클라우드 저장 데이터를 덮어쓰고 아바타, 배경, 배경화면을 업로드합니다. 채팅 이미지, 앨범, 음성 캐시, API 키는 업로드되지 않습니다. 계속할까요?",
  },
  downloadConfirm: {
    "zh-TW": "同步前請先確認你已有本機備份。這會以雲端存檔更新此裝置，並補上尚未設定的頭像、背景與桌布；本機已有圖片、相簿與 API Key 會保留。要繼續嗎？",
    "zh-CN": "同步前请先确认你已有本地备份。这会以云端存档更新此设备，并补上尚未设置的头像、背景与壁纸；本地已有图片、相册与 API Key 会保留。要继续吗？",
    en: "Make sure you have a local backup first. This updates this device from the cloud save and fills empty avatar, background, and wallpaper fields. Existing local images, the gallery, and API keys are kept. Continue?",
    ja: "先にローカルバックアップがあることを確認してください。クラウドのセーブデータでこの端末を更新し、未設定のアバター、背景、壁紙を補います。端末にある画像、アルバム、API キーは保持されます。続行しますか？",
    ko: "먼저 로컬 백업이 있는지 확인하세요. 클라우드 저장 데이터로 이 기기를 업데이트하고 비어 있는 아바타, 배경, 배경화면을 채웁니다. 기존 로컬 이미지, 앨범, API 키는 유지됩니다. 계속할까요?",
  },
  description: {
    "zh-TW": "目前採手動上傳與下載，同步整份存檔、設定、頭像、背景與桌布。下載圖片只補空欄位，保留本機已有圖片；聊天圖片、相簿、語音快取與 API Key 只留在此裝置。雲端較新時會先提醒，被取代的版本會保留在「雲端舊版本」。",
    "zh-CN": "当前采用手动上传与下载，同步整份存档、设置、头像、背景与壁纸。下载图片只补空字段，保留本地已有图片；聊天图片、相册、语音缓存与 API Key 只留在此设备。云端较新时会先提醒，被替换的版本会保留在“云端旧版本”。",
    en: "Upload and download manually to sync your whole save, settings, avatars, backgrounds, and wallpapers. Downloads fill empty image fields and keep existing local images. Chat images, the gallery, voice cache, and API keys stay on this device. You will be warned when the cloud is newer, and replaced versions are kept under \"Older cloud versions\".",
    ja: "手動のアップロードとダウンロードで、セーブデータ全体、設定、アバター、背景、壁紙を同期します。画像は未設定の項目だけ補い、端末にある画像は保持します。チャット画像、アルバム、音声キャッシュ、API キーはこの端末にのみ保存されます。クラウドの方が新しいときは事前にお知らせし、置き換えられたバージョンは「クラウドの過去バージョン」に保存されます。",
    ko: "수동 업로드와 다운로드로 전체 저장 데이터, 설정, 아바타, 배경, 배경화면을 동기화합니다. 이미지는 빈 항목만 채우며 기존 로컬 이미지는 유지합니다. 채팅 이미지, 앨범, 음성 캐시, API 키는 이 기기에만 남습니다. 클라우드가 더 최신이면 먼저 알려 드리며, 교체된 버전은 '클라우드 이전 버전'에 보관됩니다.",
  },
  uploaded: {
    "zh-TW": "已上傳 {count} 張圖片。", "zh-CN": "已上传 {count} 张图片。",
    en: "Uploaded {count} images.", ja: "画像を {count} 枚アップロードしました。", ko: "이미지 {count}장을 업로드했습니다.",
  },
  existing: {
    "zh-TW": "{count} 張圖片已存在雲端。", "zh-CN": "{count} 张图片已存在云端。",
    en: "{count} images already exist in the cloud.", ja: "画像 {count} 枚はクラウドに保存済みです。", ko: "이미지 {count}장은 이미 클라우드에 있습니다.",
  },
  quotaExceeded: {
    "zh-TW": "雲端圖片空間已滿，剩餘圖片未上傳；文字同步已完成。", "zh-CN": "云端图片空间已满，剩余图片未上传；文字同步已完成。",
    en: "Cloud image storage is full. Remaining images were skipped; text sync completed.",
    ja: "クラウドの画像容量がいっぱいです。残りの画像はアップロードせず、テキスト同期は完了しました。",
    ko: "클라우드 이미지 공간이 가득 찼습니다. 남은 이미지는 건너뛰었으며 텍스트 동기화는 완료되었습니다.",
  },
  uploadFailed: {
    "zh-TW": "{count} 張圖片未能上傳；文字同步已完成，本機圖片保留。", "zh-CN": "{count} 张图片未能上传；文字同步已完成，本地图片保留。",
    en: "{count} images could not be uploaded. Text sync completed and local images were kept.",
    ja: "画像 {count} 枚をアップロードできませんでした。テキスト同期は完了し、端末の画像は保持されています。",
    ko: "이미지 {count}장을 업로드하지 못했습니다. 텍스트 동기화는 완료되었으며 로컬 이미지는 유지됩니다.",
  },
  downloaded: {
    "zh-TW": "已補上 {count} 張雲端圖片。", "zh-CN": "已补上 {count} 张云端图片。",
    en: "Filled empty fields with {count} cloud images.", ja: "未設定の項目に画像 {count} 枚を補いました。", ko: "빈 항목에 클라우드 이미지 {count}장을 채웠습니다.",
  },
  downloadFailed: {
    "zh-TW": "{count} 張雲端圖片未能下載，欄位保持空白；文字同步已完成。", "zh-CN": "{count} 张云端图片未能下载，字段保持空白；文字同步已完成。",
    en: "{count} cloud images could not be downloaded; fields remain empty. Text sync completed.",
    ja: "画像 {count} 枚をダウンロードできず、項目は未設定のままです。テキスト同期は完了しました。",
    ko: "클라우드 이미지 {count}장을 다운로드하지 못해 항목이 비어 있습니다. 텍스트 동기화는 완료되었습니다.",
  },
};

export function cloudMediaSyncSummary(result, tr) {
  if (!result) return "";
  const messages = [];
  for (const key of ["uploaded", "existing", "downloaded"]) {
    if (result[key] > 0) messages.push(tr(CLOUD_MEDIA_SYNC_TEXT[key]).replace("{count}", String(result[key])));
  }
  if (result.quotaExceeded) messages.push(tr(CLOUD_MEDIA_SYNC_TEXT.quotaExceeded));
  else if (result.failed > 0) {
    const key = "downloaded" in result ? "downloadFailed" : "uploadFailed";
    messages.push(tr(CLOUD_MEDIA_SYNC_TEXT[key]).replace("{count}", String(result.failed)));
  }
  return messages.join(" ");
}
