import { el, fmtAmount, fmtUsd, store } from "../utils.js";
import { state, describeError } from "../wallet.js";
import { networkOf, SERIES } from "../config.js";
import { isDemo } from "../demo.js";
import { loadPortfolio, addCustomToken, removeCustomToken } from "../data.js";
import { card, assetCell, allocationBar, emptyState, button, changeTag } from "../components.js";

const HIDE_ZERO_KEY = "lumina.hideZero";

export default async function portfolio({ refresh }) {
  const pf = await loadPortfolio();
  const net = networkOf(state.chainId);
  let hideZero = store.get(HIDE_ZERO_KEY, false) === true;

  // ----- Summary -----
  const held = pf.assets.filter((a) => a.amount > 0);
  const summary = el(
    "section",
    { class: "card hero" },
    el("span", { class: "label" }, "Total portfolio value"),
    el("span", { class: "hero-value" }, pf.totalUsd != null ? fmtUsd(pf.totalUsd) : "—"),
    el(
      "span",
      { class: "muted small" },
      `${held.length} of ${pf.assets.length} tracked assets held on ${net.name}`,
      isDemo() ? " · demo data" : net.testnet ? " · testnet assets have no value" : " · prices are indicative demo values",
    ),
    pf.change24hPct != null ? el("span", { class: "small" }, changeTag(pf.change24hPct, pf.change24hUsd), el("span", { class: "muted" }, " last 24h")) : null,
    allocationStrip(pf.assets),
  );

  // ----- Holdings table -----
  const tbody = el("tbody");
  const renderRows = () => {
    const rows = pf.assets.filter((a) => !hideZero || a.amount > 0);
    tbody.replaceChildren(
      ...(rows.length
        ? rows.map((a) =>
            el(
              "tr",
              {},
              el("td", {}, assetCell(a)),
              el("td", { class: "num" }, fmtAmount(a.amount, 6)),
              el("td", { class: "num" }, a.price != null ? fmtUsd(a.price) : "—"),
              el("td", { class: "num" }, a.change24h != null ? changeTag(a.change24h) : el("span", { class: "muted" }, "—")),
              el("td", { class: "num strong" }, fmtUsd(a.usd)),
              el("td", {}, allocationBar(a.pct)),
              el(
                "td",
                { class: "num" },
                a.custom
                  ? button("Remove", () => {
                      removeCustomToken(state.chainId, a.address);
                      refresh();
                    }, "btn link danger")
                  : null,
              ),
            ),
          )
        : [el("tr", {}, el("td", { colspan: "7" }, emptyState("No balances to show.")))]),
    );
  };
  renderRows();

  const toggle = el("input", { type: "checkbox", checked: hideZero });
  toggle.addEventListener("change", () => {
    hideZero = toggle.checked;
    store.set(HIDE_ZERO_KEY, hideZero);
    renderRows();
  });

  const holdings = card(
    { title: "Holdings", actions: el("label", { class: "toggle small" }, toggle, "Hide zero balances") },
    pf.failed ? el("p", { class: "muted small" }, `${pf.failed} token balance(s) couldn't be loaded.`) : null,
    el(
      "div",
      { class: "table-wrap" },
      el(
        "table",
        {},
        el(
          "thead",
          {},
          el("tr", {}, ["Asset", "Balance", "Price", "24h", "Value", "Allocation", ""].map((h, i) => el("th", { class: i >= 1 && i <= 4 ? "num" : "" }, h))),
        ),
        tbody,
      ),
    ),
  );

  return el("div", { class: "stack" }, summary, holdings, isDemo() ? null : addTokenCard(refresh));
}

function allocationStrip(assets) {
  // Color follows the asset (its fixed position in the list), not its rank.
  const parts = assets
    .map((a, i) => ({ ...a, color: SERIES[i % SERIES.length] }))
    .filter((a) => a.pct && a.pct > 0)
    .sort((a, b) => b.pct - a.pct);
  if (!parts.length) return null;
  return el(
    "div",
    { class: "strip-wrap" },
    el("div", { class: "strip" }, parts.map((a) => el("div", { title: `${a.symbol} ${a.pct.toFixed(1)}%`, style: { width: `${a.pct}%`, background: a.color } }))),
    el(
      "div",
      { class: "legend" },
      parts.map((a) => el("span", {}, el("i", { style: { background: a.color } }), `${a.symbol} ${a.pct.toFixed(1)}%`)),
    ),
  );
}

function addTokenCard(refresh) {
  const input = el("input", { type: "text", placeholder: "Token contract address (0x…)", maxlength: "42", autocomplete: "off", spellcheck: "false" });
  const msg = el("p", { class: "small", hidden: true });
  const submit = el("button", { type: "submit", class: "btn primary" }, "Add token");

  const form = el("form", { class: "inline-form" }, input, submit);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.hidden = true;
    submit.disabled = true;
    try {
      const token = await addCustomToken(state.chainId, input.value.trim());
      msg.className = "small ok";
      msg.textContent = `Added ${token.symbol}.`;
      msg.hidden = false;
      setTimeout(refresh, 600);
    } catch (err) {
      msg.className = "small error";
      msg.textContent = err?.message && !err.code ? err.message : describeError(err, "Couldn't add that token.");
      msg.hidden = false;
    } finally {
      submit.disabled = false;
    }
  });

  return card(
    { title: "Track a custom token" },
    el("p", { class: "muted small" }, "Paste any ERC-20 contract address on the current network. Its symbol and decimals are read on-chain."),
    form,
    msg,
  );
}
