export const CRYSTAL_LEDGER_LIMIT = 30;

const normalizeInteger = (value) => Math.max(0, Math.round(Number(value) || 0));
const normalizeText = (value, fallback, limit) => String(value || fallback).trim().slice(0, limit) || fallback;

const transactionId = (time) => {
  const suffix = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 11);
  return `crystal-${time}-${suffix}`;
};

export function normalizeCrystalLedger(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => entry && typeof entry === "object")
    .map((entry, index) => {
      const time = Number(entry.time) || 0;
      const type = entry.type === "initial" ? "initial" : entry.type === "expense" ? "expense" : "income";
      return {
        id: normalizeText(entry.id, `crystal-legacy-${time}-${index}`, 100),
        type,
        amount: normalizeInteger(entry.amount),
        note: normalizeText(entry.note, type === "initial" ? "初始結晶餘額" : "結晶異動", 80),
        source: normalizeText(entry.source, "other", 30),
        time,
        balanceAfter: normalizeInteger(entry.balanceAfter),
      };
    })
    .sort((a, b) => b.time - a.time)
    .slice(0, CRYSTAL_LEDGER_LIMIT);
}

export function createInitialCrystalLedger(balance, now = Date.now()) {
  const initialBalance = normalizeInteger(balance);
  return [{
    id: `crystal-initial-${now}`,
    type: "initial",
    amount: initialBalance,
    note: "初始結晶餘額",
    source: "system",
    time: now,
    balanceAfter: initialBalance,
  }];
}

export function applyCrystalTransaction(account, amount, details = {}, now = Date.now()) {
  const currentBalance = normalizeInteger(account?.balance);
  const delta = Math.round(Number(amount) || 0);
  const nextBalance = Math.max(0, currentBalance + delta);
  const appliedDelta = nextBalance - currentBalance;
  const currentLedger = normalizeCrystalLedger(account?.ledger);
  if (!appliedDelta) return {
    account: { balance: currentBalance, ledger: currentLedger },
    transaction: null,
  };

  const type = appliedDelta < 0 ? "expense" : "income";
  const transaction = {
    id: normalizeText(details.id, transactionId(now), 100),
    type,
    amount: Math.abs(appliedDelta),
    note: normalizeText(details.note, type === "expense" ? "使用靈魂結晶" : "獲得靈魂結晶", 80),
    source: normalizeText(details.source, "other", 30),
    time: now,
    balanceAfter: nextBalance,
  };
  return {
    account: {
      balance: nextBalance,
      ledger: [transaction, ...currentLedger].slice(0, CRYSTAL_LEDGER_LIMIT),
    },
    transaction,
  };
}
