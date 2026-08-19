const isObject = (value) => !!value && typeof value === "object" && !Array.isArray(value);
const asAmount = (value) => Math.max(0, Math.round(Number(value) || 0));
const txDelta = (tx) => (tx?.type === "expense" ? -1 : 1) * asAmount(tx?.amount);
const txKey = (tx, index) => tx?.transferId ? `transfer:${tx.transferId}` : String(tx?.id || `@index:${index}`);

function mergeTransactions(local, remote, limit) {
  const merged = new Map();
  [...(Array.isArray(local) ? local : []), ...(Array.isArray(remote) ? remote : [])].forEach((tx, index) => {
    if (!isObject(tx)) return;
    const key = txKey(tx, index);
    const previous = merged.get(key);
    if (!previous || Number(tx.time || 0) >= Number(previous.time || 0)) merged.set(key, tx);
  });
  return [...merged.values()]
    .sort((a, b) => Number(b.time || 0) - Number(a.time || 0))
    .slice(0, limit);
}

function openingBalance(wallet) {
  const balance = asAmount(wallet?.balance);
  const total = (Array.isArray(wallet?.transactions) ? wallet.transactions : [])
    .reduce((sum, tx) => sum + txDelta(tx), 0);
  return Math.max(0, balance - total);
}

function mergeAssets(local, remote) {
  const merged = new Map();
  [...(Array.isArray(local) ? local : []), ...(Array.isArray(remote) ? remote : [])].forEach((asset, index) => {
    if (!isObject(asset)) return;
    const key = String(asset.id || asset.name || `@index:${index}`);
    const previous = merged.get(key);
    if (!previous || Number(asset.updatedAt || 0) >= Number(previous.updatedAt || 0)) merged.set(key, asset);
  });
  return [...merged.values()].slice(0, 120);
}

/** Merges an append-only ledger instead of allowing one device to overwrite another. */
export function mergeWalletRecord(local, remote, { transactionLimit = 1000 } = {}) {
  if (!isObject(remote)) return local || { balance: 0, transactions: [], assets: [] };
  if (!isObject(local)) return remote;
  const transactions = mergeTransactions(local.transactions, remote.transactions, transactionLimit);
  // Both devices normally share an opening balance. If legacy data differs,
  // choosing the lower one avoids accidentally creating money during a merge.
  const base = Math.min(openingBalance(local), openingBalance(remote));
  const balance = Math.max(0, base + transactions.reduce((sum, tx) => sum + txDelta(tx), 0));
  const newer = Number(remote.refreshedAt || remote.generatedAt || 0) >= Number(local.refreshedAt || local.generatedAt || 0)
    ? remote
    : local;
  return {
    ...newer,
    balance,
    transactions,
    assets: mergeAssets(local.assets, remote.assets),
  };
}

export function mergeTransfers(local, remote) {
  const terminal = new Set(["accepted", "returned", "expired"]);
  const merged = new Map();
  [...(Array.isArray(local) ? local : []), ...(Array.isArray(remote) ? remote : [])].forEach((transfer, index) => {
    if (!isObject(transfer)) return;
    const key = String(transfer.id || `@index:${index}`);
    const previous = merged.get(key);
    if (!previous) return merged.set(key, transfer);
    const previousTerminal = terminal.has(previous.status);
    const currentTerminal = terminal.has(transfer.status);
    const previousTime = Number(previous.resolvedAt || previous.updatedAt || previous.createdAt || 0);
    const currentTime = Number(transfer.resolvedAt || transfer.updatedAt || transfer.createdAt || 0);
    if ((!previousTerminal && currentTerminal) || (previousTerminal === currentTerminal && currentTime >= previousTime)) merged.set(key, transfer);
  });
  return [...merged.values()].sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)).slice(0, 20000);
}

export function mergeWalletSyncData(local = {}, remote = {}, { characterTransactionLimit = 500 } = {}) {
  const characterWallets = {};
  const ids = new Set([...Object.keys(local.characterWallets || {}), ...Object.keys(remote.characterWallets || {})]);
  ids.forEach((id) => {
    characterWallets[id] = mergeWalletRecord(local.characterWallets?.[id], remote.characterWallets?.[id], {
      transactionLimit: characterTransactionLimit,
    });
  });
  return {
    wallet: mergeWalletRecord(local.wallet, remote.wallet),
    characterWallets,
    transfers: mergeTransfers(local.transfers, remote.transfers),
  };
}
