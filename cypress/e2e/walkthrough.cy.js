// A slower, end-to-end walkthrough meant to be WATCHED in the recorded video
// (cypress/videos/walkthrough.cy.js.mp4). Short pauses between steps and an
// on-screen log of every wallet request make the MetaMask flow easy to follow.

import { Wallet } from "ethers";
import { createMockMetaMask } from "../support/mockMetaMask.js";

const PAUSE = 1200;

const LABELS = {
  eth_requestAccounts: "Connect request → approved",
  personal_sign: "Sign-in message → signed",
  wallet_switchEthereumChain: "Switch network → approved",
  wallet_revokePermissions: "Disconnect → permission revoked",
};

// Small overlay inside the app window that logs wallet requests.
function showWalletEvent(win, text) {
  const doc = win.document;
  let panel = doc.getElementById("cy-wallet-log");
  if (!panel) {
    panel = doc.createElement("div");
    panel.id = "cy-wallet-log";
    Object.assign(panel.style, {
      position: "fixed", right: "16px", bottom: "16px", zIndex: 9999, width: "320px",
      background: "#ffffff", color: "#1b1d24", borderRadius: "12px", padding: "12px 14px",
      font: "13px system-ui, sans-serif", boxShadow: "0 10px 30px rgba(0,0,0,.45)", border: "2px solid #f6851b",
    });
    const title = doc.createElement("div");
    title.textContent = "Test wallet (mock MetaMask)";
    Object.assign(title.style, { fontWeight: "700", marginBottom: "6px", color: "#c25e0a" });
    panel.append(title);
    doc.body.append(panel);
  }
  const row = doc.createElement("div");
  row.textContent = `✔ ${text}`;
  row.style.padding = "3px 0";
  panel.append(row);
}

describe("Lumina — MetaMask walkthrough (recorded)", () => {
  it("connects MetaMask, signs in, explores the app, and logs out", () => {
    const wallet = Wallet.createRandom();
    let appWindow;
    const mm = createMockMetaMask({
      wallet,
      onRequest: (method) => LABELS[method] && appWindow && setTimeout(() => showWalletEvent(appWindow, LABELS[method]), 0),
    });

    // 1. Login screen with MetaMask detected
    cy.visit("/", {
      onBeforeLoad(win) {
        appWindow = win;
        win.ethereum = mm;
      },
    });
    cy.contains("h1", "Lumina").should("be.visible");
    cy.wait(PAUSE);

    // 2. Connect + sign in
    cy.contains("button", "Connect MetaMask").click();
    cy.get(".layout").should("be.visible");
    cy.get(".account .pill.mono").should("contain", wallet.address.slice(0, 6));
    cy.contains("#cy-wallet-log", "Sign-in message → signed").should("be.visible");
    cy.wait(PAUSE * 1.5);

    // 3. Overview — hover the chart
    cy.get(".chart").trigger("pointermove", "center");
    cy.get(".chart-tip").should("be.visible");
    cy.wait(PAUSE);
    cy.contains(".seg button", "90D").click();
    cy.get(".chart").trigger("pointermove", "right");
    cy.wait(PAUSE);

    // 4. Portfolio
    cy.contains(".sidebar nav a", "Portfolio").click();
    cy.contains("Total portfolio value").should("be.visible");
    cy.wait(PAUSE * 1.5);

    // 5. Transactions + filters
    cy.contains(".sidebar nav a", "Transactions").click();
    cy.get("table tbody tr").should("have.length.at.least", 10);
    cy.wait(PAUSE);
    cy.contains(".seg button", "Swaps").click();
    cy.wait(PAUSE);
    cy.contains(".seg button", "All").click();

    // 6. Send (simulated)
    cy.contains(".sidebar nav a", "Send").click();
    cy.get('input[placeholder="0x…"]').type(Wallet.createRandom().address, { delay: 5 });
    cy.get('input[placeholder="0.0"]').type("0.25", { delay: 80 });
    cy.wait(PAUSE / 2);
    cy.contains("form button", "Send").click();
    cy.contains(".badge", "pending").should("be.visible");
    cy.contains(".badge", "confirmed", { timeout: 6000 }).should("be.visible");
    cy.wait(PAUSE);

    // 7. Settings — switch network through MetaMask
    cy.contains(".sidebar nav a", "Settings").click();
    cy.wait(PAUSE / 2);
    cy.contains(".net-btn", "Sepolia").click();
    cy.get(".account .pill").first().should("have.text", "Sepolia");
    cy.wait(PAUSE);
    cy.contains(".net-btn", "Ethereum").click();
    cy.get(".account .pill").first().should("have.text", "Ethereum");
    cy.wait(PAUSE);

    // 8. Log out
    cy.contains(".sidebar button", "Log out").click();
    cy.contains("button", "Connect MetaMask").should("be.visible");
    cy.then(() => expect(mm.connected).to.eq(false));
    cy.wait(PAUSE);
  });
});
