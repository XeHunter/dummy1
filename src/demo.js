// Demo mode: realistic fake portfolio, history and transactions, seeded by the
// wallet address + chain so each wallet always sees the same "dummy" numbers.
// No real funds are touched while demo mode is on — sends are simulated.

import { parseUnits, hexlify, randomBytes } from "ethers";
import { store } from "./utils.js";

// The app always runs on sample data — no real balances are read and no real funds move.
export const isDemo = () => true;

// ---------- Seeded RNG ----------
function rng(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const between = (r, min, max) => min + r() * (max - min);
const hex = (r, len) => Array.from({ length: len }, () => Math.floor(r() * 16).toString(16)).join("");
const seedOf = (address, chainId, tag) => `${address.toLowerCase()}:${chainId}:${tag}`;

// ---------- Assets ----------
const NATIVE = {
  ETH: { price: 3215.4, range: [1.2, 6.5] },
  POL: { price: 0.41, range: [800, 9000] },
};

const TOKENS = [
  { symbol: "USDC", name: "USD Coin", decimals: 6, price: 1, range: [900, 7500], stable: true },
  { symbol: "WETH", name: "Wrapped Ether", decimals: 18, price: 3215.4, range: [0.15, 1.6] },
  { symbol: "LINK", name: "Chainlink", decimals: 18, price: 15.24, range: [40, 420] },
  { symbol: "UNI", name: "Uniswap", decimals: 18, price: 8.62, range: [60, 520] },
  { symbol: "AAVE", name: "Aave", decimals: 18, price: 182.3, range: [1, 12] },
  { symbol: "ARB", name: "Arbitrum", decimals: 18, price: 0.78, range: [300, 3200] },
  { symbol: "DAI", name: "Dai Stablecoin", decimals: 18, price: 1, range: [0, 2400], stable: true, maybeZero: true },
];

const toBalance = (amount, decimals) => parseUnits(amount.toFixed(Math.min(decimals, 6)), decimals);

export function demoPortfolio(address, chainId, net) {
  const r = rng(seedOf(address, chainId, "assets"));
  const nativeCfg = NATIVE[net.symbol] || NATIVE.ETH;

  const raw = [
    { symbol: net.symbol, name: net.nativeName, decimals: 18, native: true, price: nativeCfg.price, range: nativeCfg.range },
    ...TOKENS,
  ].map((t) => {
    let amount = t.maybeZero && r() < 0.35 ? 0 : between(r, ...t.range);
    const change24h = t.stable ? between(r, -0.08, 0.08) : between(r, -7.5, 9);
    return { ...t, amount, change24h };
  });

  // Simulated sends reduce the demo balances so the Send flow feels real.
  for (const tx of getDemoSent(address, chainId)) {
    if (tx.status === "failed") continue;
    const a = raw.find((x) => x.symbol === tx.symbol);
    if (a) a.amount = Math.max(0, a.amount - Number(tx.amount));
  }

  const assets = raw.map((a) => {
    const usd = a.amount * a.price;
    return { ...a, balance: toBalance(a.amount, a.decimals), usd };
  });
  const totalUsd = assets.reduce((s, a) => s + a.usd, 0);
  const prevTotal = assets.reduce((s, a) => s + a.usd / (1 + a.change24h / 100), 0);
  for (const a of assets) a.pct = totalUsd ? (a.usd / totalUsd) * 100 : null;

  return { assets, totalUsd, change24hUsd: totalUsd - prevTotal, change24hPct: prevTotal ? ((totalUsd - prevTotal) / prevTotal) * 100 : 0, failed: 0, demo: true };
}

// Daily portfolio value for the last `days` days, ending at today's total.
export function demoHistory(address, chainId, endValue, days = 90) {
  const r = rng(seedOf(address, chainId, "history"));
  const values = new Array(days);
  values[days - 1] = endValue;
  for (let i = days - 1; i > 0; i--) {
    const ret = (r() - 0.47) * 0.07; // slight upward drift
    values[i - 1] = Math.max(values[i] / (1 + ret), 1);
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return values.map((v, i) => ({ t: today.getTime() - (days - 1 - i) * 86400000, v }));
}

export function demoChainStats(address, chainId) {
  const r = rng(seedOf(address, chainId, "stats"));
  return {
    block: 21_100_000 + Math.floor((Date.now() - Date.UTC(2024, 10, 1)) / 12000),
    gasGwei: between(r, 6, 28),
    nonce: Math.floor(between(r, 40, 260)),
  };
}

// ---------- Transactions ----------
const PROTOCOLS = ["Uniswap V3", "1inch", "CoW Swap"];

export function demoTxs(address, chainId, nativeSymbol) {
  const r = rng(seedOf(address, chainId, "txs"));
  const now = Date.now();
  const out = [];
  let t = now - between(r, 0.5, 3) * 3600000;

  for (let i = 0; i < 18; i++) {
    const roll = r();
    const token = TOKENS[Math.floor(r() * 5)];
    const symbol = r() < 0.4 ? nativeSymbol : token.symbol;
    const amountOf = (sym) => {
      const cfg = sym === nativeSymbol ? (NATIVE[sym] || NATIVE.ETH) : TOKENS.find((x) => x.symbol === sym);
      return between(r, cfg.range[0] * 0.05 + 0.01, cfg.range[1] * 0.3).toFixed(4);
    };
    const base = { hash: `0x${hex(r, 64)}`, time: t, status: i === 6 ? "failed" : "confirmed", demo: true };

    if (roll < 0.32) out.push({ ...base, type: "Received", symbol, amount: amountOf(symbol), from: `0x${hex(r, 40)}` });
    else if (roll < 0.62) out.push({ ...base, type: "Sent", symbol, amount: amountOf(symbol), to: `0x${hex(r, 40)}` });
    else if (roll < 0.86) {
      const symbolOut = symbol === "USDC" ? nativeSymbol : "USDC";
      out.push({ ...base, type: "Swapped", symbol, amount: amountOf(symbol), symbolOut, amountOut: amountOf(symbolOut), via: PROTOCOLS[Math.floor(r() * PROTOCOLS.length)] });
    } else if (roll < 0.94) out.push({ ...base, type: "Staked", symbol: nativeSymbol, amount: amountOf(nativeSymbol), via: "Lido" });
    else out.push({ ...base, type: "Approved", symbol: token.symbol, amount: "0", amountLabel: "Unlimited", via: "Uniswap V3" });

    t -= between(r, 2, 40) * 3600000; // 2–40h between txs
  }
  return out;
}

// Simulated sends made while demo mode is on.
const sentKey = (address, chainId) => `lumina.demoSent.${address.toLowerCase()}.${chainId}`;

export function getDemoSent(address, chainId) {
  const list = store.get(sentKey(address, chainId), []);
  return Array.isArray(list) ? list.filter((t) => t && typeof t.hash === "string") : [];
}

export function simulateSend(address, chainId, { symbol, amount, to }) {
  const tx = { hash: hexlify(randomBytes(32)), type: "Sent", symbol, amount, to, time: Date.now(), status: "pending", demo: true, simulated: true };
  store.set(sentKey(address, chainId), [tx, ...getDemoSent(address, chainId)].slice(0, 30));
  const confirmed = new Promise((resolve) =>
    setTimeout(() => {
      store.set(
        sentKey(address, chainId),
        getDemoSent(address, chainId).map((x) => (x.hash === tx.hash ? { ...x, status: "confirmed" } : x)),
      );
      resolve("confirmed");
    }, 2500),
  );
  return { tx, confirmed };
}

export function getAllDemoTxs(address, chainId, nativeSymbol) {
  return [...getDemoSent(address, chainId), ...demoTxs(address, chainId, nativeSymbol)].sort((a, b) => b.time - a.time);
}

export function clearDemoSent(address, chainId) {
  store.remove(sentKey(address, chainId));
}
