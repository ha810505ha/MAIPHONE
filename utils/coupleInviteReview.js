import { inferCoupleInviteState } from "./coupleInviteState.js";

const messageText = (message) => String(
  message?.content || message?.pseudoVoice?.transcript || "",
).trim();

export function reviewCoupleInviteReplies(messages, invitedAt, maxRounds = 3) {
  const list = Array.isArray(messages) ? messages : [];
  const inviteId = `couple_invite_${invitedAt}`;
  let startIndex = list.findIndex((message) => String(message?.id) === inviteId);

  if (startIndex < 0) {
    startIndex = list.findIndex((message) => (
      message?.role === "system_notice"
      && Number(message?.time) >= Number(invitedAt || 0)
      && String(message?.content || "").includes("情侶空間邀請")
    ));
  }
  if (startIndex < 0) return { found: false, decision: null, rounds: [] };

  const rounds = [];
  let current = [];
  const finishRound = () => {
    const text = current.map(messageText).filter(Boolean).join("\n").trim();
    if (text) rounds.push(text);
    current = [];
  };

  for (let index = startIndex + 1; index < list.length && rounds.length < maxRounds; index += 1) {
    const message = list[index];
    if (message?.role === "assistant") {
      if (!message?.pseudoImage) current.push(message);
      continue;
    }
    if (current.length) finishRound();
    if (
      message?.role === "system_notice"
      && /^couple_invite_/.test(String(message?.id || ""))
    ) break;
  }
  if (current.length && rounds.length < maxRounds) finishRound();

  const decisions = rounds
    .map((text, roundIndex) => ({ decision: inferCoupleInviteState(text), text, roundIndex }))
    .filter((result) => result.decision);
  const latest = decisions[decisions.length - 1] || null;
  return {
    found: true,
    decision: latest?.decision || null,
    matchedText: latest?.text || "",
    matchedRound: latest ? latest.roundIndex + 1 : null,
    rounds,
  };
}
