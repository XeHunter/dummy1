import { el, fmtAmount, shortAddr, shortHash, timeAgo } from "./utils.js";
import { txUrl, addressUrl } from "./config.js";

export function card({ title, actions } = {}, ...children) {
  return el(
    "section",
    { class: "card" },
    title || actions ? el("div", { class: "card-head" }, title ? el("h3", {}, title) : null, actions || null) : null,
    ...children,
  );
}

export function stat(label, value, sub) {
  return el(
    "div",
    { class: "card stat" },
    el("span", { class: "label" }, label),
    el("span", { class: "value" }, value),
    sub ? el("span", { class: "muted small" }, sub) : null,
  );
}

export function assetIcon(symbol) {
  let hue = 0;
  for (const c of symbol) hue = (hue * 31 + c.charCodeAt(0)) % 360;
  return el("span", { class: "asset-icon", style: { background: `hsl(${hue} 60% 45%)` } }, symbol.slice(0, 1));
}

export function assetCell(asset) {
  return el(
    "div",
    { class: "asset" },
    assetIcon(asset.symbol),
    el(
      "div",
      {},
      el("div", { class: "strong" }, asset.symbol, asset.custom ? el("span", { class: "tag" }, "custom") : null),
      el("div", { class: "muted small" }, asset.name || ""),
    ),
  );
}

export function allocationBar(pct) {
  if (pct == null) return el("span", { class: "muted" }, "—");
  return el(
    "div",
    { class: "alloc" },
    el("div", { class: "alloc-track" }, el("div", { class: "alloc-fill", style: { width: `${Math.max(pct, 1)}%` } })),
    el("span", { class: "small" }, `${pct.toFixed(1)}%`),
  );
}

export const badge = (status) => el("span", { class: `badge ${status}` }, status);

export function externalLink(href, text, cls = "") {
  return href
    ? el("a", { href, target: "_blank", rel: "noopener noreferrer", class: cls }, text)
    : el("span", { class: cls }, text);
}

// Demo hashes/addresses are fake, so they render as plain text instead of explorer links.
export const hashLink = (chainId, hash, demo = false) =>
  externalLink(demo ? null : txUrl(chainId, hash), shortHash(hash), "mono");
export const addrLink = (chainId, addr, demo = false) =>
  externalLink(demo ? null : addressUrl(chainId, addr), shortAddr(addr), "mono");

const TX_ICONS = { Sent: "↗", Received: "↙", Swapped: "⇄", Staked: "◎", Approved: "✓" };

export const txIcon = (tx, extra = "") =>
  el("span", { class: `tx-icon ${tx.type.toLowerCase()} ${extra}` }, TX_ICONS[tx.type] || "•");

export function txTitle(tx) {
  const amt = tx.amountLabel ?? fmtAmount(Number(tx.amount));
  return tx.type === "Swapped"
    ? `${amt} ${tx.symbol} → ${fmtAmount(Number(tx.amountOut))} ${tx.symbolOut}`
    : `${amt} ${tx.symbol}`;
}

export function txCounterparty(tx, chainId) {
  if (tx.from) return ["from ", addrLink(chainId, tx.from, tx.demo)];
  if (tx.to) return ["to ", addrLink(chainId, tx.to, tx.demo)];
  return tx.via ? ["via ", tx.via] : [];
}

export function txItem(tx, chainId) {
  return el(
    "li",
    { class: "tx-item" },
    txIcon(tx),
    el(
      "div",
      { class: "grow" },
      el("div", { class: "strong" }, `${tx.type} `, el("span", { class: "muted-strong" }, txTitle(tx))),
      el("div", { class: "muted small" }, txCounterparty(tx, chainId), " · ", timeAgo(tx.time)),
    ),
    badge(tx.status),
  );
}

// 24h change: arrow + sign carry direction, so it never relies on color alone.
export function changeTag(pct, usd) {
  if (pct == null || !Number.isFinite(pct)) return el("span", { class: "muted" }, "—");
  const up = pct >= 0;
  const usdText = usd != null ? `${up ? "+" : "−"}${Math.abs(usd).toLocaleString(undefined, { style: "currency", currency: "USD" })} ` : "";
  return el("span", { class: `change ${up ? "up" : "down"}` }, `${up ? "▲" : "▼"} ${usdText}${usd != null ? "(" : ""}${Math.abs(pct).toFixed(2)}%${usd != null ? ")" : ""}`);
}

export function emptyState(text, action) {
  return el("div", { class: "empty" }, el("p", { class: "muted" }, text), action || null);
}

export function button(label, onclick, cls = "btn primary") {
  return el("button", { type: "button", class: cls, onclick }, label);
}
