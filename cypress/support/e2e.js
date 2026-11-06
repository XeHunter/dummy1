import { Wallet } from "ethers";
import { createMockMetaMask } from "./mockMetaMask.js";

// Visit the app with a MetaMask-like wallet injected before any app code runs.
// Yields the mock so tests can inspect calls or simulate extension actions.
Cypress.Commands.add("visitWithMetaMask", (options = {}) => {
  const mm = createMockMetaMask({ wallet: options.wallet ?? Wallet.createRandom(), ...options });
  cy.visit(options.path ?? "/", {
    onBeforeLoad(win) {
      win.ethereum = mm;
    },
  });
  return cy.wrap(mm, { log: false });
});

// Full login: connect + sign the Sign-In-with-Ethereum message.
Cypress.Commands.add("loginWithMetaMask", (options = {}) => {
  return cy.visitWithMetaMask(options).then((mm) => {
    cy.contains("button", "Connect MetaMask").click();
    cy.get(".layout", { timeout: 10000 }).should("be.visible");
    return cy.wrap(mm, { log: false });
  });
});

