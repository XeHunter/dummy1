import { verifyMessage } from "ethers";
import { el, copyText } from "../utils.js";
import { state, getSigner, switchChain, describeError } from "../wallet.js";
import { NETWORKS, networkOf, addressUrl } from "../config.js";
import { card, button, externalLink } from "../components.js";

export default async function settings({ logout }) {
  const net = networkOf(state.chainId);

  // ----- Account -----
  const copyBtn = button("Copy", async () => {
    copyBtn.textContent = (await copyText(state.address)) ? "Copied ✓" : "Copy failed";
    setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
  }, "btn ghost sm");

  const account = card(
    { title: "Account" },
    el("div", { class: "kv" }, el("span", { class: "muted" }, "Address"), el("span", { class: "mono break" }, state.address)),
    el("div", { class: "kv" }, el("span", { class: "muted" }, "Network"), el("span", {}, `${net.name} (chain ${state.chainId})`)),
    el("div", { class: "kv" }, el("span", { class: "muted" }, "Signed in"), el("span", {}, state.signedAt ? new Date(state.signedAt).toLocaleString() : "—")),
    el("div", { class: "row-inline" }, copyBtn, net.explorer ? externalLink(addressUrl(state.chainId, state.address), "View on explorer ↗", "btn ghost sm") : null),
  );

  // ----- Network switcher -----
  const netError = el("p", { class: "error small", hidden: true });
  const network = card(
    { title: "Network" },
    el(
      "div",
      { class: "net-grid" },
      Object.entries(NETWORKS).map(([id, n]) =>
        el(
          "button",
          {
            type: "button",
            class: `net-btn${Number(id) === state.chainId ? " active" : ""}`,
            onclick: async () => {
              netError.hidden = true;
              try {
                await switchChain(Number(id)); // chainChanged event re-renders the app
              } catch (err) {
                netError.textContent = describeError(err, "Couldn't switch network.");
                netError.hidden = false;
              }
            },
          },
          el("span", { class: "strong" }, n.name),
          el("span", { class: "muted small" }, n.testnet ? "Testnet" : n.symbol),
        ),
      ),
    ),
    netError,
  );

  // ----- Sign & verify a message -----
  const text = el("textarea", { rows: "3", maxlength: "1000", placeholder: "Type any message to sign…" });
  const signOut = el("div", { class: "small", hidden: true });
  const signBtn = button("Sign message", async () => {
    const message = text.value;
    if (!message.trim()) return;
    signBtn.disabled = true;
    signOut.hidden = true;
    try {
      const signer = await getSigner();
      const signature = await signer.signMessage(message);
      const recovered = verifyMessage(message, signature);
      const ok = recovered === state.address;
      signOut.className = "small sign-out";
      signOut.replaceChildren(
        el("div", {}, el("span", { class: "muted" }, "Signature: "), el("span", { class: "mono break" }, signature)),
        el("div", {}, el("span", { class: "muted" }, "Recovered signer: "), el("span", { class: "mono break" }, recovered)),
        el("div", { class: ok ? "ok" : "error" }, ok ? "✓ Signature verified — matches your address" : "✗ Signer mismatch"),
      );
    } catch (err) {
      signOut.className = "small error";
      signOut.textContent = describeError(err, "Signing failed.");
    } finally {
      signOut.hidden = false;
      signBtn.disabled = false;
    }
  });

  const signer = card(
    { title: "Sign & verify a message" },
    el("p", { class: "muted small" }, "Prove you own this wallet by signing an arbitrary message. Costs no gas."),
    text,
    signBtn,
    signOut,
  );

  // ----- Session -----
  const session = card(
    { title: "Session" },
    el("p", { class: "muted small" }, "The message you signed to log in:"),
    el("pre", { class: "mono small" }, state.message || "—"),
    button("Log out", logout, "btn danger"),
  );

  return el("div", { class: "grid two settings" }, account, network, signer, session);
}
