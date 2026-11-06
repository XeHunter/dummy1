import "./style.css";
import { el, shortAddr, copyText } from "./utils.js";
import * as wallet from "./wallet.js";
import { networkOf } from "./config.js";
import overview from "./pages/overview.js";
import portfolio from "./pages/portfolio.js";
import send from "./pages/send.js";
import transactions from "./pages/transactions.js";
import settings from "./pages/settings.js";

const ROUTES = {
  overview: { title: "Overview", icon: "◧", render: overview },
  portfolio: { title: "Portfolio", icon: "◔", render: portfolio },
  send: { title: "Send", icon: "↗", render: send },
  transactions: { title: "Transactions", icon: "≡", render: transactions },
  settings: { title: "Settings", icon: "⚙", render: settings },
};

const app = document.getElementById("app");
let shell = null;
let renderSeq = 0;

const currentRoute = () => {
  const name = location.hash.replace(/^#\/?/, "");
  return ROUTES[name] ? name : "overview";
};

const navigate = (name) => {
  if (currentRoute() === name) render();
  else location.hash = `#/${name}`;
};

async function logout() {
  await wallet.disconnect();
  history.replaceState(null, "", location.pathname);
  render();
}

// ---------- Login ----------
function showLogin() {
  shell = null;
  document.title = "Lumina";
  const error = el("p", { class: "error", hidden: true });
  const btn = el("button", { type: "button", class: "btn primary block", disabled: !wallet.hasWallet() }, "Connect MetaMask");

  btn.addEventListener("click", async () => {
    error.hidden = true;
    btn.disabled = true;
    btn.textContent = "Check MetaMask…";
    try {
      await wallet.connect();
      if (!location.hash) location.hash = "#/overview";
      render();
    } catch (err) {
      error.textContent = wallet.describeError(err, "Login failed. Please try again.");
      error.hidden = false;
      btn.disabled = false;
      btn.textContent = "Connect MetaMask";
    }
  });

  app.replaceChildren(
    el(
      "main",
      { class: "login" },
      el(
        "div",
        { class: "card login-card" },
        el("div", { class: "logo" }, "✦"),
        el("h1", { class: "brand-name" }, "Lumina"),
        el("p", { class: "muted" }, "Your on-chain wealth, illuminated."),
        el(
          "ul",
          { class: "features" },
          el("li", {}, "Live ETH & ERC-20 balances across 6 networks"),
          el("li", {}, "Send coins and tokens from your wallet"),
          el("li", {}, "Track transactions with live status"),
        ),
        btn,
        error,
        wallet.hasWallet()
          ? null
          : el(
              "p",
              { class: "muted small" },
              "MetaMask not detected. ",
              el("a", { href: "https://metamask.io/download/", target: "_blank", rel: "noopener noreferrer" }, "Install MetaMask"),
              " and reload.",
            ),
        el("p", { class: "muted tiny" }, "Signing in only signs a message — no transaction, no gas."),
      ),
    ),
  );
}

// ---------- App shell ----------
function buildShell() {
  const links = {};
  const nav = el(
    "nav",
    {},
    Object.entries(ROUTES).map(([name, r]) => (links[name] = el("a", { href: `#/${name}` }, el("span", { class: "nav-icon" }, r.icon), el("span", {}, r.title)))),
  );
  const title = el("h2");
  const netPill = el("span", { class: "pill" });
  const addrPill = el("button", { type: "button", class: "pill mono", title: "Copy address" });
  addrPill.addEventListener("click", async () => {
    const ok = await copyText(wallet.state.address);
    addrPill.textContent = ok ? "Copied ✓" : shortAddr(wallet.state.address);
    setTimeout(() => (addrPill.textContent = shortAddr(wallet.state.address)), 1200);
  });
  const refreshBtn = el("button", { type: "button", class: "btn ghost sm", title: "Refresh data", onclick: () => render() }, "↻");
  const page = el("div", { class: "page" });

  app.replaceChildren(
    el(
      "div",
      { class: "layout" },
      el(
        "aside",
        { class: "sidebar" },
        el("div", { class: "brand" }, el("span", { class: "brand-mark" }, "✦"), el("span", { class: "brand-name" }, "Lumina")),
        nav,
        el("button", { type: "button", class: "btn ghost logout", onclick: logout }, "Log out"),
      ),
      el(
        "section",
        { class: "content" },
        el("header", { class: "topbar" }, title, el("div", { class: "account" }, netPill, addrPill, refreshBtn)),
        page,
      ),
    ),
  );
  shell = { links, title, netPill, addrPill, page };
}

async function render() {
  if (!wallet.state.address) return showLogin();
  if (!shell) buildShell();

  const name = currentRoute();
  const route = ROUTES[name];
  const net = networkOf(wallet.state.chainId);

  for (const [n, a] of Object.entries(shell.links)) a.classList.toggle("active", n === name);
  shell.title.textContent = route.title;
  shell.netPill.textContent = net.name;
  shell.netPill.classList.toggle("testnet", !!net.testnet);
  shell.netPill.classList.toggle("unsupported", !!net.unsupported);
  shell.addrPill.textContent = shortAddr(wallet.state.address);
  document.title = `${route.title} · Lumina`;

  const seq = ++renderSeq;
  shell.page.replaceChildren(el("div", { class: "loading" }, el("span", { class: "spinner" }), "Loading on-chain data…"));
  try {
    const node = await route.render({ navigate, refresh: render, logout });
    if (seq === renderSeq && shell) shell.page.replaceChildren(node);
  } catch (err) {
    console.error("Page render failed:", err?.code ?? err?.message);
    if (seq !== renderSeq || !shell) return;
    shell.page.replaceChildren(
      el(
        "div",
        { class: "card empty" },
        el("h3", {}, "Couldn't load this page"),
        el("p", { class: "muted" }, "Make sure MetaMask is unlocked and connected, then try again."),
        el("button", { type: "button", class: "btn primary", onclick: () => render() }, "Retry"),
      ),
    );
  }
}

// ---------- Boot ----------
window.addEventListener("hashchange", render);
wallet.watch({ onAccountsChanged: render, onChainChanged: render });
wallet.restore().then(render);
