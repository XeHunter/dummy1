import { Wallet } from "ethers";

describe("After login — sample data pages", () => {
  beforeEach(() => {
    cy.loginWithMetaMask();
  });

  it("Overview shows stats, the value chart, holdings and activity", () => {
    ["Net worth", "ETH balance", "Transactions sent", "Gas price"].forEach((label) =>
      cy.contains(".stat .label", label).should("be.visible"),
    );
    cy.contains(".stat", "Net worth").find(".value").invoke("text").should("match", /^\$[\d,]+\.\d{2}$/);

    // Chart renders and responds to hover with a tooltip
    cy.contains(".card-head h3", "Portfolio value").should("be.visible");
    cy.get(".chart svg path.line").should("exist");
    cy.get(".chart").trigger("pointermove", "center");
    cy.get(".chart-tip").should("be.visible").and("contain", "$");
    cy.contains(".seg button", "7D").click().should("have.class", "active");
    cy.contains(".seg button", "90D").click().should("have.class", "active");

    cy.contains(".card-head h3", "Top holdings").parents(".card").find("li.row").should("have.length.at.least", 3);
    cy.contains(".card-head h3", "Recent activity").parents(".card").find("li.tx-item").should("have.length", 5);
  });

  it("Portfolio lists assets with allocation and the hide-zero toggle", () => {
    cy.contains(".sidebar nav a", "Portfolio").click();
    cy.get(".topbar h2").should("have.text", "Portfolio");
    cy.contains("Total portfolio value").should("be.visible");
    cy.get(".strip > div").should("have.length.at.least", 3);
    cy.get("table tbody tr").should("have.length.at.least", 7);
    ["ETH", "USDC", "WETH", "LINK"].forEach((sym) => cy.contains("table tbody", sym).should("exist"));

    cy.get("table tbody tr").its("length").then((all) => {
      cy.contains("label", "Hide zero balances").find("input").check();
      cy.get("table tbody tr").its("length").should("be.lte", all);
    });
  });

  it("Transactions shows history with working filters", () => {
    cy.contains(".sidebar nav a", "Transactions").click();
    cy.get(".topbar h2").should("have.text", "Transactions");
    cy.get("table tbody tr").should("have.length.at.least", 10);

    cy.contains(".seg button", "Received").click();
    cy.get("table tbody tr td:first-child").each(($td) => {
      if (!$td.attr("colspan")) expect($td.text()).to.contain("Received");
    });
    cy.contains(".seg button", "Swaps").click();
    cy.get("table tbody tr").first().should("contain", "→");
    cy.contains(".seg button", "All").click();
  });

  it("Send validates input and simulates a transaction", () => {
    const recipient = Wallet.createRandom().address;
    cy.contains(".sidebar nav a", "Send").click();
    cy.contains(".banner", "sends are simulated").should("be.visible");

    // Validation
    cy.get("form").within(() => {
      cy.get('input[placeholder="0x…"]').type("0x123");
      cy.get('input[placeholder="0.0"]').type("1");
      cy.contains("button", "Send").click();
    });
    cy.contains(".error", "Enter a valid recipient address.").should("be.visible");

    cy.get('input[placeholder="0x…"]').clear().type(recipient);
    cy.get('input[placeholder="0.0"]').clear().type("999999");
    cy.contains("form button", "Send").click();
    cy.contains(".error", "Insufficient ETH balance.").should("be.visible");

    // Successful simulated send
    cy.get('input[placeholder="0.0"]').clear().type("0.1");
    cy.contains("form button", "Send").click();
    cy.contains("Demo transaction submitted").should("be.visible");
    cy.contains(".badge", "pending").should("be.visible");
    cy.contains(".badge", "confirmed", { timeout: 6000 }).should("be.visible");

    // It appears at the top of the transaction history
    cy.contains("button", "View transactions").click();
    cy.get("table tbody tr").first().should("contain", "Sent").and("contain", "0.1 ETH").and("contain", "confirmed");
  });

  it("Navigation works across every page", () => {
    ["Portfolio", "Send", "Transactions", "Settings", "Overview"].forEach((page) => {
      cy.contains(".sidebar nav a", page).click();
      cy.get(".topbar h2").should("have.text", page);
      cy.contains(".sidebar nav a.active", page).should("exist");
      cy.title().should("eq", `${page} · Lumina`);
    });
  });
});
