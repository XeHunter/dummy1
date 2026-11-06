// Small DOM + formatting helpers. All dynamic text goes through textContent
// (never innerHTML) so on-chain strings like token names can't inject markup.

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "style") Object.assign(node.style, value);
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : String(child));
  }
  return node;
}

export const shortAddr = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
export const shortHash = (h) => (h ? `${h.slice(0, 10)}…${h.slice(-6)}` : "");

export function fmtAmount(n, maxDigits = 4) {
  if (!Number.isFinite(n) || n === 0) return "0";
  const min = 10 ** -maxDigits;
  if (n < min) return `<${min}`;
  return n.toLocaleString(undefined, { maximumFractionDigits: maxDigits });
}

export function fmtUsd(n) {
  return n == null ? "—" : n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export function timeAgo(ts) {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// localStorage wrapper — only used for non-sensitive UI data (public tx hashes,
// token addresses, preferences). Never for keys, signatures, or tokens.
export const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable */
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
