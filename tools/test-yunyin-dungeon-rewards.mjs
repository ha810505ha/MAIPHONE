import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
const result = await build({ entryPoints: ['yunyin/systems/dungeon.js'], bundle: true, platform: 'node', format: 'cjs', write: false });
const module = { exports: {} };
new Function('module', 'exports', 'require', result.outputFiles[0].text)(module, module.exports, createRequire(import.meta.url));
const { chooseOption, finishRun } = module.exports;
const saveOf = (difficulty = 4, eventId = 'herb', modifiers = []) => ({ cultivation: { realmIdx: 0, exp: 0 }, coins: 0, inventory: {}, blueprints: {}, dungeon: { activeRun: { seed: 'audit', difficulty, modifiers, floor: 1, totalFloors: 11, hp: 10, hpMax: 10, exp: 0, coins: 0, loot: {}, usedEvents: [], eventId, state: 'event' } } });
for (const [difficulty, expected] of [[1, 3], [2, 5], [3, 6], [4, 8], [5, 9]]) {
  const save = saveOf(difficulty);
  assert.equal(chooseOption(save, 0).fx.itemN, expected);
  assert.equal(save.dungeon.activeRun.loot.qingling, expected);
  assert.equal(finishRun(save, 'retreat').items[0].n, expected);
  assert.equal(save.inventory.qingling, expected);
}
{
  const save = saveOf(4, 'herb', ['herb_rich']);
  assert.equal(chooseOption(save, 0).fx.itemN, 15);
  assert.equal(finishRun(save, 'retreat').items[0].n, 15);
}
{
  let success = false;
  for (let i = 0; i < 100; i++) {
    const save = saveOf(4, 'altar');
    save.dungeon.activeRun.seed = `audit${i}`;
    const outcome = chooseOption(save, 0);
    if (!outcome.ok) continue;
    assert.equal(outcome.fx.itemN, 3);
    assert.equal(finishRun(save, 'retreat').items[0].n, 3);
    assert.equal(save.inventory.xinglu_seed, 3);
    success = true; break;
  }
  assert.ok(success, 'seed reward scenario must execute');
}
{
  const save = saveOf(4, 'treasure');
  assert.equal(chooseOption(save, 1).fx.coins, 38);
  assert.equal(save.dungeon.activeRun.coins, 38);
  assert.equal(finishRun(save, 'retreat').coins, 38);
  assert.equal(save.coins, 38);
}
for (const mode of ['retreat', 'cleared', 'dead']) {
  const save = saveOf();
  save.dungeon.activeRun.loot = { xinglu_seed: 2.5 };
  const expected = mode === 'dead' ? 1 : 3;
  assert.equal(finishRun(save, mode).items.find(it => it.id === 'xinglu_seed').n, expected);
  assert.equal(save.inventory.xinglu_seed, expected);
}
console.log('Dungeon reward checks passed: five difficulties, modifier, seed, coins, legacy fractions and death penalty');
