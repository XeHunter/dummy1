import { el, timeAgo } from "../utils.js";
import { state } from "../wallet.js";
import { networkOf, addressUrl } from "../config.js";
import { refreshPendingTxs, clearTxs } from "../data.js";
import { isDemo, clearDemoSent } from "../demo.js";
import { card, badge, hashLink, emptyState, button, externalLink, txIcon, txTitle, txCounterparty } from "../components.js";

const FILTERS = {
  All: () => true,
  Sent: (t) => t.type === "Sent",
  Received: (t) => t.type === "Received",
  Swaps: (t) => t.type === "Swapped",
  Other: (t) => !["Sent", "Received", "Swapped"].includes(t.type),
};

export default async function transactions({ navigate, refresh }) {
  const net = networkOf(state.chainId);
  const demo = isDemo();
  const txs = await refreshPendingTxs(state.address, state.chainId);
  const hasClearable = demo ? txs.some((t) => t.simulated) : txs.length > 0;

  const actions = el(
    "div",
    { class: "row-inline" },
    net.explorer && !demo ? externalLink(addressUrl(state.chainId, state.address), "Full history ↗", "btn ghost sm") : null,
    hasClearable
      ? button(demo ? "Clear simulated" : "Clear", () => {
          if (!confirm("Clear these from the local list? This doesn't affect the blockchain.")) return;
          if (demo) clearDemoSent(state.address, state.chainId);
          else clearTxs(state.address, state.chainId);
          refresh();
        }, "btn ghost sm")
      : null,
  );

  if (!txs.length) {
    return card(
      { title: `Transactions on ${net.name}`, actions },
      emptyState(`No transactions sent from Lumina on ${net.name} yet.`, button("Send tokens", () => navigate("send"), "btn primary sm")),
    );
  }

  // ----- Summary counts -----
  const count = (type) => txs.filter((t) => t.type === type).length;
  const summary = el(
    "div",
    { class: "grid stats" },
    [["Total", txs.length], ["Sent", count("Sent")], ["Received", count("Received")], ["Swaps", count("Swapped")]].map(([label, n]) =>
      el("div", { class: "card stat" }, el("span", { class: "label" }, label), el("span", { class: "value" }, n)),
    ),
  );

  // ----- Filterable table -----
  const tbody = el("tbody");
  const tabs = el("div", { class: "seg" });
  const setFilter = (name) => {
    const rows = txs.filter(FILTERS[name]);
    tbody.replaceChildren(
      ...(rows.length
        ? rows.map((t) =>
            el(
              "tr",
              {},
              el("td", {}, el("div", { class: "asset" }, txIcon(t, "sm"), el("span", { class: "strong" }, t.type))),
              el("td", { class: "strong" }, txTitle(t)),
              el("td", { class: "muted" }, txCounterparty(t, state.chainId)),
              el("td", {}, badge(t.status)),
              el("td", { class: "muted", title: new Date(t.time).toLocaleString() }, timeAgo(t.time)),
              el("td", {}, hashLink(state.chainId, t.hash, t.demo)),
            ),
          )
        : [el("tr", {}, el("td", { colspan: "6" }, emptyState(`No ${name.toLowerCase()} transactions.`)))]),
    );
    for (const b of tabs.children) b.classList.toggle("active", b.dataset.key === name);
  };
  for (const name of Object.keys(FILTERS)) tabs.append(el("button", { type: "button", "data-key": name, onclick: () => setFilter(name) }, name));
  setFilter("All");

  return el(
    "div",
    { class: "stack" },
    summary,
    card(
      { title: `Transactions on ${net.name}`, actions },
      el(
        "div",
        { class: "card-head" },
        tabs,
        el("span", { class: "muted small" }, demo ? "Demo data — hashes and addresses are fake." : "Transactions sent through Lumina, with live status."),
      ),
      el(
        "div",
        { class: "table-wrap" },
        el(
          "table",
          {},
          el("thead", {}, el("tr", {}, ["Type", "Amount", "Counterparty", "Status", "When", "Tx hash"].map((h) => el("th", {}, h)))),
          tbody,
        ),
      ),
    ),
  );
}
