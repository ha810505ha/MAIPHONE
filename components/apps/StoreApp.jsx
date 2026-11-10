import React, { useCallback, useEffect, useMemo, useState } from "react";
import { loadFeatureEntity, saveFeatureEntity } from "../../utils/indexedDbStorage";
import { useGacha } from "../../contexts/GachaContext";
import { useDatingActions } from "../../contexts/DatingActionsContext";
import { DATING_ENABLED, GACHA_ENABLED } from "../../config/featureFlags";
import { STORE_PRODUCTS, STORE_PURCHASES_ENTITY_KEY, STORE_HISTORY_VISIBLE } from "../../constants/storeProducts";
import { SUPER_LIKE_MAX } from "../../constants/dating";
import {
  appendPurchase, createStorePurchases, evaluatePurchase, findStoreProduct, normalizeStorePurchases, remainingInPeriod, visibleStoreProducts,
} from "../../services/store/storeService";
import { FEATURE_DATA_CHANGED_EVENT, featureDataEventIncludes } from "../../services/featureDataLifecycle";
import { LargeTitle, LargeTitleHeader, useLargeTitle } from "../shell/LargeTitle";
import EmptyState from "../common/EmptyState";
import Icon from "../common/Icon";
import useDialogFocus from "../../hooks/ui/useDialogFocus";

// 商品 icon：Icon 名稱走線條圖示，其他視為 emoji（資料圖示允許）。
const ICON_NAMES = new Set(["chat", "user", "users", "book", "books", "post", "bell", "receipt", "gem", "notebook", "phone", "heart", "flower", "warning", "refresh", "camera", "plus", "doll", "sparkle", "share", "search", "grid"]);
const ProductIcon = ({ icon }) => (ICON_NAMES.has(icon) ? <Icon name={icon} size={26} /> : <span aria-hidden="true">{icon}</span>);

const STYLE = `
.st-wallet{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 16px;padding:14px 16px;border-radius:18px;background:var(--mp-lv1);box-shadow:0 1px 2px rgba(20,10,30,.05),0 0 0 1px color-mix(in srgb,var(--mp-txt) 6%,transparent);}
.st-wallet-l{display:flex;align-items:center;gap:10px;color:var(--mp-txt-l);font-size:var(--mp-fs-sub);font-weight:700;}
.st-wallet-l .mp-icon-line{color:var(--mp-accent-ink);}
.st-wallet-n{font-size:22px;font-weight:800;color:var(--mp-txt);font-family:var(--mp-fontd);}
.st-wallet-n small{margin-left:4px;font-size:var(--mp-fs-caption);font-weight:700;color:var(--mp-txt-l);}
.st-item{display:flex;align-items:center;gap:12px;padding:14px;}
.st-item+.st-item{border-top:1px solid var(--mp-line);}
.st-ico{flex:none;display:grid;place-items:center;width:46px;height:46px;border-radius:14px;background:var(--mp-accent-soft);color:var(--mp-accent-ink);font-size:22px;}
.st-body{flex:1;min-width:0;}
.st-name{font-size:var(--mp-fs-name);font-weight:800;color:var(--mp-txt);}
.st-desc{margin-top:3px;font-size:var(--mp-fs-caption);line-height:1.55;color:var(--mp-txt-l);}
.st-limit{margin-top:5px;font-size:var(--mp-fs-caption);font-weight:700;color:var(--mp-accent-ink);}
.st-limit.out{color:var(--mp-txt-l);}
.st-buy{flex:none;min-width:76px;padding:9px 12px;border:0;border-radius:999px;background:var(--mp-primary-gradient);color:var(--mp-on-accent);font:inherit;font-size:var(--mp-fs-sub);font-weight:800;cursor:pointer;transition:transform .12s;}
.st-buy:active{transform:scale(.96);}
.st-buy:disabled{opacity:.45;cursor:default;}
.st-hist{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 14px;font-size:var(--mp-fs-sub);color:var(--mp-txt);}
.st-hist+.st-hist{border-top:1px solid var(--mp-line);}
.st-hist-t{font-size:var(--mp-fs-caption);color:var(--mp-txt-l);margin-top:2px;}
.st-hist-p{flex:none;font-weight:800;color:var(--mp-txt-l);}
.st-confirm-row{display:flex;justify-content:space-between;gap:12px;padding:9px 0;font-size:var(--mp-fs-body);color:var(--mp-txt);border-bottom:1px solid var(--mp-line);}
.st-confirm-row span:last-child{font-weight:800;}
.st-confirm-note{margin:12px 0 0;font-size:var(--mp-fs-caption);line-height:1.6;color:var(--mp-txt-l);}
.st-confirm-actions{display:flex;gap:10px;margin-top:16px;}
.st-confirm-actions button{flex:1;padding:11px;border:0;border-radius:var(--mp-rs);font:inherit;font-size:var(--mp-fs-sub);font-weight:800;cursor:pointer;}
.st-cancel{background:var(--mp-lv1);color:var(--mp-txt);box-shadow:0 0 0 1px color-mix(in srgb,var(--mp-txt) 8%,transparent);}
.st-ok{background:var(--mp-primary-gradient);color:var(--mp-on-accent);}
.st-ok:disabled{opacity:.45;cursor:default;}
`;

export default function StoreApp({ closeApp, t, tr, uiLanguage, showToast }) {
  const largeTitle = useLargeTitle();
  const { crystals, changeCrystals } = useGacha();
  const datingActions = useDatingActions();
  const [store, setStore] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const notify = useCallback((message) => { if (typeof showToast === "function") showToast(message); }, [showToast]);
  const localeKey = uiLanguage === "zh-CN" ? "zh-TW" : (uiLanguage || "zh-TW");
  const text = useCallback((table) => {
    const picked = table?.[localeKey] ?? table?.["zh-TW"] ?? "";
    // zh-TW 文案走 tr 讓簡中自動轉換；其他語言已是目標語言。
    return localeKey === "zh-TW" ? tr(picked, table?.en || picked, table?.ja || picked, table?.ko || picked) : picked;
  }, [localeKey, tr]);

  const reload = useCallback(() => {
    let mounted = true;
    loadFeatureEntity(STORE_PURCHASES_ENTITY_KEY, null)
      .then((saved) => { if (mounted) setStore(normalizeStorePurchases(saved)); })
      .catch(() => { if (mounted) setStore(createStorePurchases()); });
    return () => { mounted = false; };
  }, []);
  useEffect(() => reload(), [reload]);
  useEffect(() => {
    // 匯入／還原／重置後重新讀取購買紀錄。
    const onChanged = (event) => { if (featureDataEventIncludes(event, STORE_PURCHASES_ENTITY_KEY)) reload(); };
    window.addEventListener(FEATURE_DATA_CHANGED_EVENT, onChanged);
    const timer = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => { window.removeEventListener(FEATURE_DATA_CHANGED_EVENT, onChanged); clearInterval(timer); };
  }, [reload]);

  const products = useMemo(() => visibleStoreProducts({ dating: DATING_ENABLED, gacha: GACHA_ENABLED }), []);
  const purchases = store?.purchases || [];
  const grantCap = useMemo(() => ({ superLike: { current: datingActions.superLikes, max: SUPER_LIKE_MAX } }), [datingActions.superLikes]);
  const confirmProduct = confirmId ? findStoreProduct(confirmId, products) : null;
  const confirmDialogRef = useDialogFocus(Boolean(confirmProduct), busy ? null : () => setConfirmId(null));

  const title = t("store");
  const blockedMessage = (reason) => {
    if (reason === "insufficientCrystals") return tr("靈魂結晶不足，先去登入獎勵或雲隱山莊賺一點吧。", "Not enough soul crystals. Earn some from login rewards or Yunyin Villa first.", "ソウルクリスタルが足りません。ログイン報酬や雲隠山荘で集めましょう。", "소울 크리스탈이 부족해요. 로그인 보상이나 운은산장에서 먼저 모아 보세요.");
    if (reason === "limitReached") return tr("本週已達限購數量，下週一再來。", "Weekly limit reached. Come back next Monday.", "今週の購入上限に達しました。来週月曜にまたどうぞ。", "이번 주 구매 한도에 도달했어요. 다음 주 월요일에 다시 와 주세요.");
    if (reason === "grantCapReached") return tr(`Super Like 已達上限 ${SUPER_LIKE_MAX} 個，先用掉一些再買。`, `You already hold the maximum of ${SUPER_LIKE_MAX} Super Likes. Use some before buying more.`, `Super Like はすでに上限の ${SUPER_LIKE_MAX} 個です。使ってから購入してください。`, `Super Like가 이미 최대 ${SUPER_LIKE_MAX}개예요. 먼저 사용한 뒤 구매해 주세요.`);
    return tr("這個商品目前無法購買。", "This item can't be purchased right now.", "この商品は現在購入できません。", "이 상품은 지금 구매할 수 없어요.");
  };

  const grantProduct = (product) => {
    if (product.grant?.type === "superLike") datingActions.grantSuperLikes(product.grant.amount, "shop");
  };

  const purchase = async () => {
    if (!confirmProduct || busy || !store) return;
    const check = evaluatePurchase({ product: confirmProduct, purchases, crystals, grantCap, now: Date.now() });
    if (!check.ok) { notify(blockedMessage(check.reason)); setConfirmId(null); return; }
    setBusy(true);
    try {
      const note = tr(`商店・${confirmProduct.name["zh-TW"]}`, `Store · ${confirmProduct.name.en}`, `ストア・${confirmProduct.name.ja}`, `상점 · ${confirmProduct.name.ko}`);
      const transaction = changeCrystals(-confirmProduct.price, { source: "store", note });
      if (!transaction || transaction.amount !== confirmProduct.price) {
        // 扣款沒成功（餘額在確認視窗期間被用掉）就不發貨；若有部分扣款，退回去。
        if (transaction?.amount) changeCrystals(transaction.amount, { source: "store", note: tr("商店・購買失敗退回", "Store · refund for failed purchase", "ストア・購入失敗の返金", "상점 · 구매 실패 환불") });
        notify(blockedMessage("insufficientCrystals"));
        return;
      }
      const next = appendPurchase(store, confirmProduct, Date.now());
      setStore(next);
      await saveFeatureEntity(STORE_PURCHASES_ENTITY_KEY, next);
      grantProduct(confirmProduct);
      notify(tr(`已購買 ${text(confirmProduct.name)}`, `Purchased ${text(confirmProduct.name)}`, `${text(confirmProduct.name)} を購入しました`, `${text(confirmProduct.name)} 구매 완료`));
      setConfirmId(null);
    } finally {
      setBusy(false);
    }
  };

  const limitLabel = (product) => {
    const remaining = remainingInPeriod(purchases, product, now);
    if (!Number.isFinite(remaining)) return "";
    const count = product.limit.count;
    if (product.limit.per === "day") return tr(`今日剩餘 ${remaining}／${count}`, `${remaining}/${count} left today`, `本日あと ${remaining}／${count}`, `오늘 남은 수량 ${remaining}/${count}`);
    return tr(`本週剩餘 ${remaining}／${count}`, `${remaining}/${count} left this week`, `今週あと ${remaining}／${count}`, `이번 주 남은 수량 ${remaining}/${count}`);
  };
  const dateLabel = (time) => new Date(time).toLocaleString(uiLanguage || "zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className={largeTitle.pageClassName}>
      <style>{STYLE}</style>
      <LargeTitleHeader title={title} onBack={closeApp} backLabel={tr("返回首頁", "Back to Home", "ホームに戻る", "홈으로 돌아가기")} />
      <div className="mp-cm" onScroll={largeTitle.onScroll}>
        <LargeTitle title={title} subtitle={tr("用靈魂結晶兌換道具，不花真錢。", "Spend soul crystals on items. No real money involved.", "ソウルクリスタルでアイテムと交換。実際のお金は使いません。", "소울 크리스탈로 아이템을 교환해요. 실제 돈은 쓰지 않아요.")} />
        <div className="st-wallet">
          <div className="st-wallet-l"><Icon name="gem" size={20} />{tr("靈魂結晶", "Soul crystals", "ソウルクリスタル", "소울 크리스탈")}</div>
          <div className="st-wallet-n">💎 {crystals}</div>
        </div>

        {store === null ? (
          <div className="mp-list-note">{t("loading")}</div>
        ) : products.length === 0 ? (
          <EmptyState icon="sparkle" title={t("comingSoon")} text={tr("商品還在準備中，敬請期待。", "Items are still being prepared. Stay tuned.", "商品を準備中です。お楽しみに。", "상품을 준비 중이에요. 기대해 주세요.")} />
        ) : (
          <>
            <div className="mp-list-section">{tr("商品", "Items", "商品", "상품")}</div>
            <div className="mp-group">
              {products.map((product) => {
                const remaining = remainingInPeriod(purchases, product, now);
                const soldOut = remaining <= 0;
                return (
                  <div key={product.id} className="st-item">
                    <div className="st-ico"><ProductIcon icon={product.icon} /></div>
                    <div className="st-body">
                      <div className="st-name">{text(product.name)}</div>
                      <div className="st-desc">{text(product.description)}</div>
                      {product.limit?.per && <div className={`st-limit ${soldOut ? "out" : ""}`}>{limitLabel(product)}</div>}
                    </div>
                    <button type="button" className="st-buy" disabled={soldOut} onClick={() => setConfirmId(product.id)}>
                      {soldOut ? tr("已售完", "Sold out", "売り切れ", "품절") : `💎 ${product.price}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {store !== null && (
          <>
            <div className="mp-list-section">{tr("購買紀錄", "Purchase history", "購入履歴", "구매 내역")}</div>
            {purchases.length === 0 ? (
              <EmptyState compact icon="receipt" title={tr("還沒有購買紀錄", "No purchases yet", "まだ購入履歴がありません", "아직 구매 내역이 없어요")} />
            ) : (
              <div className="mp-group">
                {purchases.slice(0, STORE_HISTORY_VISIBLE).map((item) => {
                  const product = findStoreProduct(item.productId);
                  return (
                    <div key={item.id} className="st-hist">
                      <div>
                        <div>{product ? text(product.name) : item.productId}</div>
                        <div className="st-hist-t">{dateLabel(item.at)}</div>
                      </div>
                      <div className="st-hist-p">−💎 {item.price}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {confirmProduct && (
        <div className="mp-overlay" onClick={() => !busy && setConfirmId(null)}>
          <div className="mp-modal" role="dialog" aria-modal="true" aria-label={tr("確認購買", "Confirm purchase", "購入の確認", "구매 확인")} ref={confirmDialogRef} onClick={(event) => event.stopPropagation()}>
            <div className="mp-modal-t">{tr("確認購買", "Confirm purchase", "購入の確認", "구매 확인")}</div>
            <div className="st-confirm-row"><span>{tr("商品", "Item", "商品", "상품")}</span><span>{text(confirmProduct.name)}</span></div>
            <div className="st-confirm-row"><span>{tr("價格", "Price", "価格", "가격")}</span><span>💎 {confirmProduct.price}</span></div>
            <div className="st-confirm-row"><span>{tr("目前餘額", "Balance", "現在の残高", "현재 잔액")}</span><span>💎 {crystals}</span></div>
            {confirmProduct.limit?.per && <div className="st-confirm-row"><span>{tr("剩餘可買", "Remaining", "購入可能数", "남은 수량")}</span><span>{limitLabel(confirmProduct)}</span></div>}
            {confirmProduct.grant?.type === "superLike" && (
              <div className="st-confirm-note">{tr(`購買後 Super Like 會加到信風帳戶（上限 ${SUPER_LIKE_MAX} 個）。`, `The Super Like is added to your Tradewind account (max ${SUPER_LIKE_MAX}).`, `購入後、Super Like は信風のアカウントに加算されます（上限 ${SUPER_LIKE_MAX} 個）。`, `구매 후 Super Like가 신풍 계정에 추가돼요(최대 ${SUPER_LIKE_MAX}개).`)}</div>
            )}
            <div className="st-confirm-actions">
              <button type="button" className="st-cancel" disabled={busy} onClick={() => setConfirmId(null)}>{t("cancel")}</button>
              <button type="button" className="st-ok" disabled={busy || crystals < confirmProduct.price} onClick={purchase}>
                {crystals < confirmProduct.price ? tr("結晶不足", "Not enough", "残高不足", "잔액 부족") : tr("確認購買", "Buy", "購入する", "구매")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
