import { gid, sanitizeText } from "../../utils/coreUtils";
import { createImageCropState, drawCoverCrop } from "../../utils/imageCrop";

export default function useGroupChatController({
  characters,
  currentChatGroup,
  groupCoverCrop,
  groupEditCoverCrop,
  groupCreateMemberIds,
  groupCreateName,
  groupCreateRulePrompt,
  groupCreateCover,
  groupEditGroupId,
  groupEditMemberIds,
  groupEditName,
  groupEditRulePrompt,
  groupEditUseRealTime,
  groupEditCover,
  setGroupCoverCrop,
  setGroupEditCoverCrop,
  setGroupCreateCover,
  setGroupEditCover,
  setGroupCreateName,
  setGroupCreateRulePrompt,
  setGroupCreateMemberIds,
  setGroupCreateSearch,
  setGroupCreateOpen,
  setGroupEditGroupId,
  setGroupEditName,
  setGroupEditRulePrompt,
  setGroupEditUseRealTime,
  setGroupEditMemberIds,
  setGroupEditSearch,
  setGroupEditOpen,
  setGroupChats,
  setCurrentChatGroup,
  sanitizeImageUrl,
  showToast,
  notify,
  tr,
}) {
  const getGroupMembers = (group) => {
    const ids = Array.isArray(group?.memberIds) && group.memberIds.length ? group.memberIds : characters.map((c) => c.id);
    return characters.filter((c) => ids.includes(c.id));
  };

  const openGroupCoverCrop = (file, mode = "create") => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      const safe = sanitizeImageUrl(String(r.result || ""));
      if (!safe) return showToast(tr("圖片格式不支援", "Unsupported image format", "画像形式に対応していません", "이미지 형식을 지원하지 않습니다"));
      const img = new Image();
      img.onload = () => {
        const crop = createImageCropState({ src: safe, width: img.width, height: img.height });
        if (mode === "edit") setGroupEditCoverCrop(crop);
        else setGroupCoverCrop(crop);
      };
      img.onerror = () => showToast(tr("圖片讀取失敗", "Image load failed", "画像の読み込みに失敗しました", "이미지 읽기에 실패했습니다"));
      img.src = safe;
    };
    r.readAsDataURL(file);
  };
  const applyGroupCoverCrop = (mode = "create") => {
    const crop = mode === "edit" ? groupEditCoverCrop : groupCoverCrop;
    if (!crop?.src) return;
    const img = new Image();
    img.onload = () => {
      const size = 320;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return showToast("圖片處理失敗");
      drawCoverCrop(ctx, img, crop, size);
      const out = canvas.toDataURL("image/jpeg", 0.84);
      const safe = sanitizeImageUrl(out);
      if (!safe) return showToast("圖片處理失敗");
      if (mode === "edit") {
        setGroupEditCover(safe);
        setGroupEditCoverCrop(null);
      } else {
        setGroupCreateCover(safe);
        setGroupCoverCrop(null);
      }
    notify(tr("群組圖片已更新", "Group cover updated", "グループ画像を更新しました", "그룹 이미지가 업데이트되었습니다"), "Group cover updated");
    };
    img.onerror = () => showToast(tr("圖片讀取失敗", "Image load failed", "画像の読み込みに失敗しました", "이미지 읽기에 실패했습니다"));
    img.src = crop.src;
  };

  const openCreateGroup = () => {
    setGroupCreateName("");
    setGroupCreateRulePrompt("");
    setGroupCreateMemberIds([]);
    setGroupCreateSearch("");
    setGroupCreateCover("");
    setGroupCreateOpen(true);
  };
  const openEditGroup = (group) => {
    if (!group) return;
    setGroupEditGroupId(group.id);
    setGroupEditName(group.name || "");
    setGroupEditRulePrompt(group.rulePrompt || "");
    setGroupEditUseRealTime(group.useRealTime !== false);
    setGroupEditMemberIds(Array.isArray(group.memberIds) ? group.memberIds.slice(0, 5) : []);
    setGroupEditSearch("");
    setGroupEditCover(group.cover || "");
    setGroupEditOpen(true);
  };
  const handleGroupCreateCoverUp = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    openGroupCoverCrop(f, "create");
    e.target.value = "";
  };
  const handleGroupEditCoverUp = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    openGroupCoverCrop(f, "edit");
    e.target.value = "";
  };
  const saveEditGroup = () => {
    if (!groupEditGroupId) return;
    const members = characters.filter((c) => groupEditMemberIds.includes(c.id)).slice(0, 5);
    if (members.length === 0) {
      showToast(tr("請至少選擇 1 位角色", "Select at least 1 character", "少なくとも1人のキャラを選択してください", "캐릭터를 1명 이상 선택해주세요"));
      return;
    }
    const memberLabel = members.map((m) => m.name).join("、");
    const fallbackName = tr(`${memberLabel}的群組聊天室`, `${memberLabel}'s group chat`, `${memberLabel}のグループチャット`, `${memberLabel}의 그룹 채팅`);
    const name = sanitizeText(groupEditName.trim() || fallbackName, 80);
    setGroupChats((prev) => prev.map((g) => g.id === groupEditGroupId ? {
      ...g,
      name,
      rulePrompt: sanitizeText(groupEditRulePrompt.trim(), 3000),
      useRealTime: groupEditUseRealTime !== false,
      memberIds: members.map((m) => m.id),
      cover: groupEditCover || "",
      updatedAt: Date.now(),
    } : g));
    if (currentChatGroup?.id === groupEditGroupId) {
      setCurrentChatGroup((prev) => prev ? {
        ...prev,
        name,
        rulePrompt: sanitizeText(groupEditRulePrompt.trim(), 3000),
        useRealTime: groupEditUseRealTime !== false,
        memberIds: members.map((m) => m.id),
        cover: groupEditCover || "",
        updatedAt: Date.now(),
      } : prev);
    }
    setGroupEditOpen(false);
    showToast(tr("群組已更新", "Group updated", "グループを更新しました", "그룹이 업데이트되었습니다"));
  };
  const createGroupChat = () => {
    if (groupCreateMemberIds.length === 0) {
      showToast(tr("請至少選擇 1 位角色", "Select at least 1 character", "少なくとも1人のキャラを選択してください", "캐릭터를 1명 이상 선택해주세요"));
      return;
    }
    const members = characters.filter((c) => groupCreateMemberIds.includes(c.id)).slice(0, 5);
    const memberLabel = members.map((m) => m.name).join("、");
    const fallbackName = tr(`${memberLabel}的群組聊天室`, `${memberLabel}'s group chat`, `${memberLabel}のグループチャット`, `${memberLabel}의 그룹 채팅`);
    const name = sanitizeText(groupCreateName.trim() || fallbackName, 80);
    const payload = {
      id: gid(),
      name,
      rulePrompt: sanitizeText(groupCreateRulePrompt.trim(), 3000),
      useRealTime: true,
      memberIds: members.map((m) => m.id),
      cover: groupCreateCover || "",
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    setGroupChats((prev) => [...prev, payload]);
    setGroupCreateOpen(false);
    setCurrentChatGroup(payload);
    notify(tr("已建立群組", "Group created", "グループを作成しました", "그룹이 생성되었습니다"), `Group created: ${name || fallbackName}`);
  };

  return {
    getGroupMembers,
    openCreateGroup,
    openEditGroup,
    handleGroupCreateCoverUp,
    handleGroupEditCoverUp,
    saveEditGroup,
    createGroupChat,
    applyGroupCoverCrop,
  };
}
