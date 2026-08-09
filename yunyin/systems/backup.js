import { downloadJsonFile } from "../../utils/exportFile";
import { loadSave, replaceSave } from "./save";

export const YUNYIN_BACKUP_TYPE = "maliphone-yunyin-save";

export async function exportYunyinSave() {
  const save = await loadSave();
  const payload = { type: YUNYIN_BACKUP_TYPE, version: 1, exportedAt: new Date().toISOString(), save };
  return downloadJsonFile(payload, `yunyin-save-${new Date().toISOString().slice(0, 10)}.json`);
}

export async function importYunyinSaveFile(file) {
  const payload = JSON.parse(await file.text());
  if (payload?.type !== YUNYIN_BACKUP_TYPE || !payload.save || typeof payload.save !== "object") {
    const error = new Error("不是有效的雲隱山莊備份檔");
    error.code = "INVALID_YUNYIN_BACKUP";
    throw error;
  }
  await replaceSave(payload.save);
  return true;
}
