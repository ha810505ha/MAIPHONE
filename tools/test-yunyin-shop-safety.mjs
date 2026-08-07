import assert from "node:assert/strict";
import fs from "node:fs";
import {
  SELL_INTERVAL_SEC,
  itemMeta,
  settleShelves,
  stockShelf,
  stockShelfQuantity,
  unstockShelf,
} from "../yunyin/systems/shop.js";

const NOW = 1_800_000_000_000;
const shopPanelSource = fs.readFileSync(
  new URL("../yunyin/ui/ShopPanel.jsx", import.meta.url),
  "utf8",
);

const createSave = () => ({
  coins: 100,
  inventory: { qingling: 10 },
  shop: {
    shelves: Array.from({ length: 3 }, (_, id) => ({
      id,
      itemId: null,
      stock: 0,
      soldUpdatedAt: null,
    })),
  },
});

{
  const save = createSave();
  assert.equal(stockShelfQuantity(save, 0, "qingling", 3, NOW), null);
  assert.equal(save.inventory.qingling, 7, "只扣除玩家選擇的上架數量");
  assert.deepEqual(save.shop.shelves[0], {
    id: 0,
    itemId: "qingling",
    stock: 3,
    soldUpdatedAt: NOW,
  });

  const sale = settleShelves(save, NOW + SELL_INTERVAL_SEC * 2_000);
  assert.deepEqual(sale, {
    sold: 2,
    earned: itemMeta("qingling").sellPrice * 2,
  });
  assert.equal(save.shop.shelves[0].stock, 1);

  unstockShelf(save, 0);
  assert.equal(save.inventory.qingling, 8, "收回時只退還貨架剩餘數量");
  assert.equal(save.shop.shelves[0].itemId, null);
}

{
  const save = createSave();
  for (const quantity of [0, -1, 1.5, Number.NaN]) {
    assert.equal(stockShelfQuantity(save, 0, "qingling", quantity, NOW), "請輸入正確的上架數量");
    assert.equal(save.inventory.qingling, 10, "無效數量不得扣除背包物品");
    assert.equal(save.shop.shelves[0].itemId, null, "無效數量不得占用貨架");
  }
  assert.equal(stockShelfQuantity(save, 0, "qingling", 11, NOW), "背包數量不足");
  assert.equal(save.inventory.qingling, 10);
}

{
  const save = createSave();
  assert.equal(stockShelf(save, 1, "qingling", NOW), null);
  assert.equal(save.shop.shelves[1].stock, 10, "舊呼叫未指定數量時維持全部上架");
  assert.equal(save.inventory.qingling, 0);
}

assert.match(shopPanelSource, /type="number"/, "貨架介面應提供可直接輸入的數量欄位");
assert.match(
  shopPanelSource,
  /stockShelfQuantity\(save,\s*idx,\s*selectedItemId,\s*selectedQuantity\)/,
  "貨架介面應將玩家選擇的數量交給底層",
);

console.log("Yunyin shop quantity checks passed");
