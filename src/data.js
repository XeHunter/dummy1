// On-chain data loading (balances), custom tokens, and the local tx history.

import { Contract, formatUnits, getAddress, isAddress } from "ethers";
import { ERC20_ABI, PRICES, networkOf } from "./config.js";
import { getProvider, state } from "./wallet.js";
import { store } from "./utils.js";
import { isDemo, demoPortfolio, getAllDemoTxs } from "./demo.js";

// ---------- Portfolio ----------

export async function loadPortfolio() {
  const net = networkOf(state.chainId);
  if (isDemo()) return demoPortfolio(state.address, state.chainId, net);

  const p = getProvider();
  const tokens = [...net.tokens, ...getCustomTokens(state.chainId)];

  const nativeBalance = await p.getBalance(state.address);
  const results = await Promise.allSettled(
    tokens.map(async (t) => {
      const balance = await new Contract(t.address, ERC20_ABI, p).balanceOf(state.address);
      return { ...t, balance };
    }),
  );

  const assets = [
    { symbol: net.symbol, name: net.nativeName, decimals: 18, balance: nativeBalance, native: true },
    ...results.filter((r) => r.status === "fulfilled").map((r) => r.value),
  ].map((a) => {
    const amount = Number(formatUnits(a.balance, a.decimals));
    const price = net.testnet ? null : (PRICES[a.symbol] ?? null);
    return { ...a, amount, price, usd: price != null ? amount * price : null };
  });

  const priced = assets.filter((a) => a.usd != null);
  const totalUsd = priced.length ? priced.reduce((s, a) => s + a.usd, 0) : null;
  for (const a of assets) a.pct = totalUsd && a.usd != null ? (a.usd / totalUsd) * 100 : null;

  return { assets, totalUsd, failed: results.filter((r) => r.status === "rejected").length };
}

// ---------- Custom tokens ----------

const tokenKey = (chainId) => `lumina.tokens.${chainId}`;
const cleanText = (s, max) => String(s ?? "").replace(/[^\w .\-]/g, "").trim().slice(0, max);

export function getCustomTokens(chainId) {
  const list = store.get(tokenKey(chainId), []);
  if (!Array.isArray(list)) return [];
  return list
    .filter((t) => t && isAddress(t.address) && Number.isInteger(t.decimals) && t.decimals >= 0 && t.decimals <= 36)
    .map((t) => ({ ...t, symbol: cleanText(t.symbol, 12) || "TOKEN", name: cleanText(t.name, 40), custom: true }));
}

export async function addCustomToken(chainId, rawAddress) {
  if (!isAddress(rawAddress)) throw new Error("Enter a valid token contract address.");
  const address = getAddress(rawAddress);
  const lower = address.toLowerCase();
  const existing = [...networkOf(chainId).tokens, ...getCustomTokens(chainId)];
  if (existing.some((t) => t.address.toLowerCase() === lower)) throw new Error("That token is already listed.");

  const c = new Contract(address, ERC20_ABI, getProvider());
  let symbol, decimals, name;
  try {
    [symbol, decimals, name] = await Promise.all([c.symbol(), c.decimals(), c.name().catch(() => "")]);
  } catch {
    throw new Error("That address isn't an ERC-20 token on this network.");
  }
  const token = {
    address,
    symbol: cleanText(symbol, 12) || "TOKEN",
    name: cleanText(name, 40),
    decimals: Number(decimals),
  };
  store.set(tokenKey(chainId), [...store.get(tokenKey(chainId), []), token]);
  return token;
}

export function removeCustomToken(chainId, address) {
  const lower = address.toLowerCase();
  store.set(
    tokenKey(chainId),
    store.get(tokenKey(chainId), []).filter((t) => t?.address?.toLowerCase() !== lower),
  );
}

// ---------- Transaction history (txs sent through this app) ----------

const HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const txKey = (addr, chainId) => `lumina.txs.${addr.toLowerCase()}.${chainId}`;

export function getTxs(addr, chainId) {
  const list = store.get(txKey(addr, chainId), []);
  return Array.isArray(list) ? list.filter((t) => t && HASH_RE.test(t.hash)) : [];
}

export function addTx(addr, chainId, tx) {
  store.set(txKey(addr, chainId), [tx, ...getTxs(addr, chainId)].slice(0, 50));
}

export function updateTx(addr, chainId, hash, patch) {
  store.set(
    txKey(addr, chainId),
    getTxs(addr, chainId).map((t) => (t.hash === hash ? { ...t, ...patch } : t)),
  );
}

export function clearTxs(addr, chainId) {
  store.remove(txKey(addr, chainId));
}

export async function refreshPendingTxs(addr, chainId) {
  if (isDemo()) return getAllDemoTxs(addr, chainId, networkOf(chainId).symbol);
  const p = getProvider();
  const pending = getTxs(addr, chainId).filter((t) => t.status === "pending");
  await Promise.allSettled(
    pending.map(async (t) => {
      const receipt = await p.getTransactionReceipt(t.hash);
      if (receipt) updateTx(addr, chainId, t.hash, { status: receipt.status === 1 ? "confirmed" : "failed" });
    }),
  );
  return getTxs(addr, chainId);
}
