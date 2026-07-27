export function inferCoupleInviteState(text) {
  const source = String(text || "")
    .replace(/\[\[COUPLE_INVITE:(?:accepted|declined)\]\]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!source) return null;

  // 猶豫語意優先，避免「我不確定是否願意」因包含「願意」而被誤判接受。
  const pendingPattern = /(?:讓我|让我|容我|給我|给我).{0,6}(?:想想|考慮|考虑)|(?:再|之後|之后|晚點|晚点).{0,5}(?:決定|决定|答覆|回复|回覆|說|说)|(?:還|还)?(?:沒|没)(?:想好|決定|决定)|(?:不確定|不确定|需要時間|需要时间|考慮一下|考虑一下)|(?:let me think|need (?:some )?time|not sure|maybe later)|(?:考えさせて|まだ決められない|少し時間)|(?:생각해|시간이 필요|아직 모르)/i;
  if (pendingPattern.test(source)) return null;

  // 拒絕必須先於接受判斷，避免「不願意」命中「願意」。
  const declinedPattern = /(?:不|沒|没|無法|无法|不能|不會|不会).{0,4}(?:願意|愿意|答應|答应|接受|加入|開啟|开启)|(?:拒絕|拒绝|婉拒|算了吧|還是算了|还是算了|不行(?:吧|了)?|別了吧|别了吧)|(?:\b(?:no|decline|refuse)\b|don['’]?t want|can['’]?t accept)|(?:断る|受け入れられない|無理です|やめておく)|(?:거절|받아들일 수 없|안 할래|싫어)/i;
  if (declinedPattern.test(source)) return "declined";

  const acceptedPattern = /(?:我)?(?:願意|愿意|答應|答应|接受)|(?:好啊|好呀|好吧|可以啊|可以呀|行啊|行呀|當然可以|当然可以)|(?:那|那麼|那么)?就.{0,5}(?:一起|加入|開啟|开启)|(?:一起|我們一起|我们一起).{0,6}(?:吧|開啟|开启|加入)|(?:加入|開啟|开启).{0,5}(?:情侶空間|情侣空间|雙人空間|双人空间)|(?:\b(?:yes|accept|agreed|i['’]?m in|let['’]?s do it)\b)|(?:受け入れる|いいよ|一緒にやろう|参加する)|(?:좋아|수락|함께하자|같이 하자)/i;
  return acceptedPattern.test(source) ? "accepted" : null;
}
