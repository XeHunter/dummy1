import { Wallet, getBytes, toUtf8String, verifyMessage } from "ethers";

const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const decodeSignedMessage = (mm) => {
  const call = mm.calls.find((c) => c.method === "personal_sign");
  return call ? toUtf8String(getBytes(call.params[0])) : null;
};

describe("MetaMask connection", () => {
  it("shows an install prompt when MetaMask is not installed", () => {
    cy.visit("/", {
      onBeforeLoad(win) {
        delete win.ethereum;
      },
    });
    cy.contains("h1", "Lumina").should("be.visible");
    cy.contains("button", "Connect MetaMask").should("be.disabled");
    cy.contains("MetaMask not detected").should("be.visible");
    cy.contains("a", "Install MetaMask").should("have.attr", "href", "https://metamask.io/download/");
  });

  it("connects the wallet, signs in, and opens the dashboard", () => {
    const wallet = Wallet.createRandom();

    cy.visitWithMetaMask({ wallet }).then((mm) => {
      cy.contains("button", "Connect MetaMask").should("be.enabled").click();

      // Dashboard is shown for the connected account and network
      cy.get(".layout").should("be.visible");
      cy.get(".topbar h2").should("have.text", "Overview");
      cy.get(".account .pill").first().should("have.text", "Ethereum");
      cy.get(".account .pill.mono").should("have.text", short(wallet.address));
      cy.title().should("eq", "Overview · Lumina");

      cy.then(() => {
        // The app asked MetaMask for accounts, then for a signature
        const methods = mm.calls.map((c) => c.method);
        expect(methods).to.include("eth_requestAccounts");
        expect(methods).to.include("personal_sign");
        expect(methods.indexOf("eth_requestAccounts")).to.be.lessThan(methods.indexOf("personal_sign"));

        // The signed message is a Sign-In-with-Ethereum style message for this account
        const message = decodeSignedMessage(mm);
        expect(message).to.contain("wants you to sign in with your Ethereum account:");
        expect(message).to.contain(wallet.address);
        expect(message).to.contain("Sign in to Lumina.");
        expect(message).to.contain("Chain ID: 1");
        expect(message).to.match(/Nonce: [0-9a-f]{32}/);
      });
    });

    // The session message is visible in Settings
    cy.contains(".sidebar nav a", "Settings").click();
    cy.contains("pre", "Sign in to Lumina.").should("be.visible");
  });

  it("produces a signature that verifies to the connected address", () => {
    const wallet = Wallet.createRandom();
    cy.loginWithMetaMask({ wallet }).then((mm) => {
      const message = decodeSignedMessage(mm);
      return cy.wrap(mm.wallet.signMessage(message)).then((sig) => {
        expect(verifyMessage(message, sig)).to.eq(wallet.address);
      });
    });
  });

  it("stays on the login screen when the user rejects the connection", () => {
    cy.visitWithMetaMask({ rejectConnect: true }).then((mm) => {
      cy.contains("button", "Connect MetaMask").click();
      cy.contains(".error", "Request rejected in MetaMask.").should("be.visible");
      cy.get(".layout").should("not.exist");
      cy.contains("button", "Connect MetaMask").should("be.enabled");
      cy.then(() => expect(mm.calls.map((c) => c.method)).not.to.include("personal_sign"));
    });
  });

  it("stays on the login screen when the user rejects the signature", () => {
    cy.visitWithMetaMask({ rejectSign: true }).then((mm) => {
      cy.contains("button", "Connect MetaMask").click();
      cy.contains(".error", "Request rejected in MetaMask.").should("be.visible");
      cy.get(".layout").should("not.exist");

      // User changes their mind and approves the second time
      cy.then(() => (mm.rejectSign = false));
      cy.contains("button", "Connect MetaMask").click();
      cy.get(".layout").should("be.visible");
    });
  });

  it("restores the session on reload while MetaMask stays connected", () => {
    const wallet = Wallet.createRandom();
    cy.loginWithMetaMask({ wallet }).then((mm) => {
      // Reload the page with the same (still connected) wallet
      cy.visit("/", { onBeforeLoad: (win) => (win.ethereum = mm) });
      cy.get(".layout").should("be.visible");
      cy.get(".account .pill.mono").should("have.text", short(wallet.address));
    });
  });

  it("logs out when the account is switched inside MetaMask", () => {
    cy.loginWithMetaMask().then((mm) => {
      cy.then(() => mm.switchAccount(Wallet.createRandom()));
      cy.contains("button", "Connect MetaMask").should("be.visible");
      cy.get(".layout").should("not.exist");
    });
  });

  it("logs out when the site is disconnected from MetaMask", () => {
    cy.loginWithMetaMask().then((mm) => {
      cy.then(() => mm.disconnectFromExtension());
      cy.contains("button", "Connect MetaMask").should("be.visible");
    });
  });

  it("follows a network change made inside MetaMask", () => {
    cy.loginWithMetaMask().then((mm) => {
      cy.get(".account .pill").first().should("have.text", "Ethereum");
      cy.then(() => mm.switchChainFromExtension(8453));
      cy.get(".account .pill").first().should("have.text", "Base");
    });
  });

  it("switches network from Settings through MetaMask", () => {
    cy.loginWithMetaMask().then((mm) => {
      cy.contains(".sidebar nav a", "Settings").click();
      cy.contains(".net-btn", "Sepolia").click();
      cy.get(".account .pill").first().should("have.text", "Sepolia").and("have.class", "testnet");
      cy.contains(".net-btn.active", "Sepolia").should("exist");
      cy.then(() => {
        const call = mm.calls.find((c) => c.method === "wallet_switchEthereumChain");
        expect(call.params[0].chainId).to.eq("0xaa36a7");
      });
    });
  });

  it("signs and verifies an arbitrary message from Settings", () => {
    cy.loginWithMetaMask().then((mm) => {
      cy.contains(".sidebar nav a", "Settings").click();
      cy.get("textarea").type("Hello from Cypress");
      cy.contains("button", "Sign message").click();
      cy.contains("Signature verified — matches your address").should("be.visible");
      cy.contains(".sign-out", mm.wallet.address).should("exist");
    });
  });

  it("logs out and revokes the MetaMask permission", () => {
    cy.loginWithMetaMask().then((mm) => {
      cy.contains(".sidebar button", "Log out").click();
      cy.contains("button", "Connect MetaMask").should("be.visible");
      cy.then(() => {
        expect(mm.calls.map((c) => c.method)).to.include("wallet_revokePermissions");
        expect(mm.connected).to.eq(false);
      });
      // A fresh visit should NOT auto-login
      cy.visit("/", { onBeforeLoad: (win) => (win.ethereum = mm) });
      cy.contains("button", "Connect MetaMask").should("be.visible");
    });
  });
});
