import assert from "node:assert/strict";
import fs from "node:fs";
import {
  isRequestRoomActive,
  updateMessagesInRoomList,
} from "../services/chat/chatRoomRouting.js";
import {
  getRetryableTailUserMessage,
  isPendingRequestForRoom,
} from "../services/chat/chatRetryState.js";

const roomA = { id: "room-a", messages: [{ id: "user-a", role: "user", content: "A 的訊息" }] };
const roomB = { id: "room-b", messages: [{ id: "user-b", role: "user", content: "B 的訊息" }] };
const rooms = [roomA, roomB];
const assistantReply = { id: "reply-a", role: "assistant", content: "只應回到 A" };
const updatedRooms = updateMessagesInRoomList(
  rooms,
  "room-a",
  (messages) => [...messages, assistantReply],
  1234,
);

assert.notEqual(updatedRooms, rooms);
assert.deepEqual(updatedRooms[0].messages, [roomA.messages[0], assistantReply]);
assert.equal(updatedRooms[0].updatedAt, 1234);
assert.equal(updatedRooms[1], roomB);
assert.deepEqual(updatedRooms[1].messages, roomB.messages);
assert.equal(
  updateMessagesInRoomList(rooms, "missing", (messages) => [...messages, assistantReply]),
  rooms,
);
assert.equal(isRequestRoomActive({ char: "room-a" }, "char", "room-a"), true);
assert.equal(isRequestRoomActive({ char: "room-b" }, "char", "room-a"), false);
assert.equal(isRequestRoomActive({ char: "room-b" }, "char", null), true);

const unanswered = { id: "unanswered", role: "user", content: "還在嗎？" };
assert.equal(getRetryableTailUserMessage([roomA.messages[0], unanswered]), unanswered);
assert.equal(getRetryableTailUserMessage([unanswered, assistantReply]), null);
assert.equal(getRetryableTailUserMessage([{ ...unanswered, interceptedByCharacterBlock: true }]), null);
assert.equal(getRetryableTailUserMessage([]), null);
assert.equal(isPendingRequestForRoom({ characterId: "char", roomId: "room-a" }, "char", "room-a"), true);
assert.equal(isPendingRequestForRoom({ characterId: "char", roomId: "room-a" }, "char", "room-b"), false);

const generatorSource = fs.readFileSync(new URL("../services/chat/directChatGenerator.js", import.meta.url), "utf8");
const directHookSource = fs.readFileSync(new URL("../hooks/chat/useDirectChatAI.js", import.meta.url), "utf8");
const roomsHookSource = fs.readFileSync(new URL("../hooks/chat/useCharacterChatRooms.js", import.meta.url), "utf8");
const innerThoughtSource = fs.readFileSync(new URL("../hooks/chat/useInnerThought.jsx", import.meta.url), "utf8");
const walletSource = fs.readFileSync(new URL("../hooks/wallet/useWalletController.js", import.meta.url), "utf8");
const messageListSource = fs.readFileSync(new URL("../components/chat/DirectMessageList.jsx", import.meta.url), "utf8");
const composerSource = fs.readFileSync(new URL("../components/chat/DirectChatComposer.jsx", import.meta.url), "utf8");
const appSource = fs.readFileSync(new URL("../MaliPhone.jsx", import.meta.url), "utf8");
const renderControllerSource = fs.readFileSync(new URL("../hooks/chat/useChatRenderController.jsx", import.meta.url), "utf8");
const roomManagerSource = fs.readFileSync(new URL("../components/chat/ChatRoomManager.jsx", import.meta.url), "utf8");

assert.match(directHookSource, /roomId = getActiveRoomId/);
assert.match(directHookSource, /generateAssistant\(\{ cid: characterId, roomId,/);
assert.match(generatorSource, /updateChatMessages\(cid, roomId,/);
assert.doesNotMatch(generatorSource, /setChatHistory/);
assert.match(roomsHookSource, /updateMessagesInRoomList\(rooms, roomId,/);
assert.match(innerThoughtSource, /updateRoomMessages\(char\.id, sourceRoomId,/);
assert.match(walletSource, /updateRoomMessages\(char\.id, roomId,/);
assert.match(directHookSource, /retryLastUnansweredMessage/);
assert.match(directHookSource, /setPendingRequest\(\{ characterId, roomId, messageId:/);
assert.match(messageListSource, /useLayoutEffect/);
assert.match(messageListSource, /scrollKey/);
assert.match(composerSource, /retryAvailable \? onRetryLast : onSend/);
assert.match(renderControllerSource, /retryLastReplyAvailable/);
assert.match(roomsHookSource, /requestRoot\?\.archivedAt/);
assert.match(roomsHookSource, /root\?\.archivedAt/);
assert.match(roomsHookSource, /archiveRoom/);
assert.match(roomsHookSource, /restoreRoom/);
assert.match(roomsHookSource, /sortOrder/);
assert.match(roomManagerSource, /ReadonlyMessages/);
assert.doesNotMatch(roomManagerSource, /callAI|generateAssistant|updateRoomMessages/);

console.log("chat room request routing: ok");
