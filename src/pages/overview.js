import { formatUnits } from "ethers";
import { el, fmtAmount, fmtUsd } from "../utils.js";
import { getProvider, state } from "../wallet.js";
import { networkOf, addressUrl } from "../config.js";
import { loadPortfolio, refreshPendingTxs } from "../data.js";
import { isDemo, demoChainStats, demoHistory } from "../demo.js";
import { areaChart } from "../chart.js";
import { card, stat, assetCell, allocationBar, txItem, emptyState, button, externalLink, changeTag } from "../components.js";

async function chainStats() {
  if (isDemo()) return demoChainStats(state.address, state.chainId);
  const p = getProvider();
  const [block, fee, nonce] = await Promise.all([p.getBlockNumber(), p.getFeeData(), p.getTransactionCount(state.address)]);
  return { block, nonce, gasGwei: fee.gasPrice != null ? Number(formatUnits(fee.gasPrice, "gwei")) : null };
}

export default async function overview({ navigate }) {
  const net = networkOf(state.chainId);
  const demo = isDemo();

  const [pf, stats, txs] = await Promise.all([loadPortfolio(), chainStats(), refreshPendingTxs(state.address, state.chainId)]);

  const native = pf.assets[0];
  const held = pf.assets.filter((a) => a.amount > 0);

  const statRow = el(
    "div",
    { class: "grid stats" },
    stat(
      "Net worth",
      pf.totalUsd != null ? fmtUsd(pf.totalUsd) : "—",
      pf.change24hPct != null ? el("span", {}, changeTag(pf.change24hPct, pf.change24hUsd), " 24h") : net.testnet ? "Testnet — no real value" : `${held.length} asset(s) held`,
    ),
    stat(`${net.symbol} balance`, fmtAmount(native.amount), native.usd != null ? fmtUsd(native.usd) : net.name),
    stat("Transactions sent", stats.nonce.toLocaleString(), "Account nonce"),
    stat("Gas price", stats.gasGwei != null ? `${fmtAmount(stats.gasGwei, 2)} gwei` : "—", `Block #${stats.block.toLocaleString()}`),
  );

  // ----- Portfolio value chart (demo history) -----
  let chartCard = null;
  if (demo && pf.totalUsd) {
    const history = demoHistory(state.address, state.chainId, pf.totalUsd, 90);
    const chartHost = el("div");
    const rangeLabel = el("span", { class: "muted small" });
    const ranges = { "7D": 7, "30D": 30, "90D": 90 };
    const tabs = el("div", { class: "seg" });
    const setRange = (key) => {
      const pts = history.slice(-ranges[key]);
      const first = pts[0].v, last = pts.at(-1).v;
      rangeLabel.replaceChildren(changeTag(((last - first) / first) * 100, last - first), ` past ${ranges[key]} days`);
      chartHost.replaceChildren(areaChart(pts, { label: "Portfolio value" }));
      for (const b of tabs.children) b.classList.toggle("active", b.dataset.key === key);
    };
    for (const key of Object.keys(ranges)) {
      const b = el("button", { type: "button", "data-key": key, onclick: () => setRange(key) }, key);
      tabs.append(b);
    }
    chartCard = card({ title: "Portfolio value", actions: tabs }, rangeLabel, chartHost);
    setRange("30D");
  }

  const top = [...held].sort((a, b) => (b.usd ?? 0) - (a.usd ?? 0) || b.amount - a.amount).slice(0, 5);
  const holdings = card(
    { title: "Top holdings", actions: button("View all →", () => navigate("portfolio"), "btn link") },
    top.length
      ? el(
          "ul",
          { class: "list" },
          top.map((a) =>
            el(
              "li",
              { class: "row" },
              assetCell(a),
              el("div", { class: "right" }, el("div", { class: "strong" }, fmtUsd(a.usd)), el("div", { class: "muted small" }, `${fmtAmount(a.amount)} ${a.symbol}`)),
              el("div", { class: "alloc-col" }, allocationBar(a.pct)),
            ),
          ),
        )
      : emptyState(`No assets on ${net.name} yet.`),
  );

  const activity = card(
    { title: "Recent activity", actions: button("View all →", () => navigate("transactions"), "btn link") },
    txs.length
      ? el("ul", { class: "list" }, txs.slice(0, 5).map((t) => txItem(t, state.chainId)))
      : emptyState("No transactions sent from Lumina yet.", button("Send your first", () => navigate("send"), "btn ghost sm")),
  );

  const actions = el(
    "div",
    { class: "quick-actions" },
    button("↗ Send", () => navigate("send")),
    button("◔ Portfolio", () => navigate("portfolio"), "btn ghost"),
    button("≡ Activity", () => navigate("transactions"), "btn ghost"),
    net.explorer && !demo ? externalLink(addressUrl(state.chainId, state.address), "View on explorer ↗", "btn ghost") : null,
  );

  const banner =
    net.unsupported && !demo
      ? el("div", { class: "banner warn" }, `${net.name} isn't a supported network — only the native balance is shown. Switch networks in Settings.`)
      : null;

  return el("div", { class: "stack" }, banner, actions, statRow, chartCard, el("div", { class: "grid two" }, holdings, activity));
}
