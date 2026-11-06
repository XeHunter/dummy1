import { Contract, formatUnits, getAddress, isAddress, parseUnits } from "ethers";
import { el, fmtAmount } from "../utils.js";
import { getProvider, getSigner, state, describeError } from "../wallet.js";
import { ERC20_ABI, networkOf } from "../config.js";
import { loadPortfolio, addTx, updateTx } from "../data.js";
import { card, badge, hashLink, button } from "../components.js";
import { isDemo, simulateSend } from "../demo.js";

const AMOUNT_RE = /^\d+(\.\d+)?$/;

export default async function send({ navigate }) {
  const pf = await loadPortfolio();
  const demo = isDemo();
  const net = networkOf(state.chainId);
  const assets = pf.assets;

  const select = el("select", {}, assets.map((a, i) => el("option", { value: String(i) }, `${a.symbol} — ${fmtAmount(a.amount)} available`)));
  const to = el("input", { type: "text", placeholder: "0x…", maxlength: "42", autocomplete: "off", spellcheck: "false" });
  const amount = el("input", { type: "text", inputmode: "decimal", placeholder: "0.0", maxlength: "40", autocomplete: "off" });
  const avail = el("span", { class: "muted small" });
  const maxBtn = el("button", { type: "button", class: "btn link" }, "Max");
  const error = el("p", { class: "error", hidden: true });
  const submit = el("button", { type: "submit", class: "btn primary block" }, "Send");
  const result = el("div");

  const asset = () => assets[Number(select.value)];
  const updateAvail = () => {
    const a = asset();
    avail.textContent = `Available: ${fmtAmount(a.amount, 6)} ${a.symbol}`;
  };
  select.addEventListener("change", updateAvail);
  updateAvail();

  maxBtn.addEventListener("click", async () => {
    const a = asset();
    let max = a.balance;
    if (a.native) {
      // Leave room for gas on a simple transfer (21k gas, +20% buffer).
      const fee = await getProvider().getFeeData();
      const perGas = fee.maxFeePerGas ?? fee.gasPrice ?? 0n;
      max -= (perGas * 21000n * 12n) / 10n;
      if (max < 0n) max = 0n;
    }
    amount.value = formatUnits(max, a.decimals);
  });

  const showError = (text) => {
    error.textContent = text;
    error.hidden = !text;
  };

  const form = el(
    "form",
    { class: "form" },
    el("label", {}, "Asset", select),
    el("label", {}, "Recipient address", to),
    el("label", {}, el("span", { class: "label-row" }, "Amount", el("span", {}, avail, " ", maxBtn)), amount),
    error,
    submit,
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError("");
    const a = asset();
    const toVal = to.value.trim();
    const amountStr = amount.value.trim();

    if (!isAddress(toVal)) return showError("Enter a valid recipient address.");
    if (!AMOUNT_RE.test(amountStr)) return showError("Enter a valid amount (e.g. 0.01).");
    let value;
    try {
      value = parseUnits(amountStr, a.decimals);
    } catch {
      return showError(`${a.symbol} supports at most ${a.decimals} decimal places.`);
    }
    if (value <= 0n) return showError("Amount must be greater than 0.");
    if (value > a.balance) return showError(`Insufficient ${a.symbol} balance.`);

    const recipient = getAddress(toVal);

    if (demo) {
      // Simulated send — no wallet prompt, no real funds moved.
      const { tx, confirmed } = simulateSend(state.address, state.chainId, { symbol: a.symbol, amount: amountStr, to: recipient });
      const status = badge("pending");
      result.replaceChildren(
        card(
          { title: "Demo transaction submitted" },
          el("p", {}, `Sending ${amountStr} ${a.symbol} to `, el("span", { class: "mono break" }, recipient)),
          el("p", { class: "row-inline" }, "Status: ", status, " · ", hashLink(state.chainId, tx.hash, true)),
          el("p", { class: "muted small" }, "Simulated — no real funds are moved."),
          button("View transactions", () => navigate("transactions"), "btn ghost sm"),
        ),
      );
      a.amount = Math.max(0, a.amount - Number(amountStr));
      a.balance -= value;
      select.options[select.selectedIndex].textContent = `${a.symbol} — ${fmtAmount(a.amount)} available`;
      form.reset();
      select.value = String(assets.indexOf(a));
      updateAvail();
      confirmed.then((s) => status.replaceWith(badge(s)));
      return;
    }

    submit.disabled = true;
    submit.textContent = "Confirm in MetaMask…";
    try {
      const signer = await getSigner();
      const tx = a.native
        ? await signer.sendTransaction({ to: recipient, value })
        : await new Contract(a.address, ERC20_ABI, signer).transfer(recipient, value);

      const { address, chainId } = state;
      addTx(address, chainId, { hash: tx.hash, type: "Sent", symbol: a.symbol, amount: amountStr, to: recipient, time: Date.now(), status: "pending" });

      const status = badge("pending");
      result.replaceChildren(
        card(
          { title: "Transaction submitted" },
          el("p", {}, `Sending ${amountStr} ${a.symbol} to `, el("span", { class: "mono" }, recipient)),
          el("p", { class: "row-inline" }, "Status: ", status, " · ", hashLink(chainId, tx.hash)),
          button("View transactions", () => navigate("transactions"), "btn ghost sm"),
        ),
      );
      form.reset();
      updateAvail();

      tx.wait()
        .then((receipt) => {
          const s = receipt?.status === 1 ? "confirmed" : "failed";
          updateTx(address, chainId, tx.hash, { status: s });
          status.replaceWith(badge(s));
        })
        .catch(() => {
          /* network switched or dropped; Transactions page re-checks the receipt */
        });
    } catch (err) {
      showError(describeError(err, "Transaction failed. Please try again."));
    } finally {
      submit.disabled = false;
      submit.textContent = "Send";
    }
  });

  const banner = demo
    ? el("div", { class: "banner info" }, "Sample data — balances are for demonstration and sends are simulated. Nothing leaves your wallet.")
    : net.testnet
    ? el("div", { class: "banner info" }, `You're on ${net.name} (testnet). Grab free test ETH from a faucet to try sending.`)
    : el("div", { class: "banner warn" }, `You're on ${net.name} mainnet — this sends real funds. Double-check the address.`);

  return el("div", { class: "stack narrow" }, banner, card({ title: "Send tokens" }, form), result);
}
