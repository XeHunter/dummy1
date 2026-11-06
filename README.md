# Lumina

A demo web3 app: sign in with MetaMask, then view your on-chain portfolio, send tokens, and track transactions.

Built with **Vite** + **ethers.js v6** (vanilla JS, no framework).

## Run

```bash
npm install
npm run dev        # http://localhost:5173
```

Open it in a browser with the MetaMask extension. Use **Sepolia** testnet to try sending safely.

## Pages

| Page | What it does |
|---|---|
| Login | Connects MetaMask and signs a Sign-In-with-Ethereum style message (no gas) |
| Overview | Net worth, native balance, nonce, gas price, top holdings, recent activity |
| Portfolio | Native + ERC-20 balances, allocation, add any custom ERC-20 by address |
| Send | Send native coin or ERC-20 tokens, with validation and live confirmation |
| Transactions | Transactions sent via the app, with on-chain status and explorer links |
| Settings | Account info, network switcher, sign & verify a message, log out |

Supported networks: Ethereum, Sepolia, Base, Optimism, Arbitrum One, Polygon.

## Sample data

After login, every page shows realistic sample data — holdings, 24h changes, a 90-day portfolio
value chart, and a mixed transaction history (sent / received / swaps / staking). Numbers are
seeded by wallet address + network, so they stay consistent. Sends are **simulated**; no real
funds move. MetaMask is used only to sign in. Generator: `src/demo.js`.

## End-to-end tests (Cypress)

```bash
npm run test:e2e     # builds, serves on :4173, runs all specs headless, records video
npm run cy:open      # interactive runner (start `npm run preview:e2e` first)
```

| Spec | Covers |
|---|---|
| `metamask-connection.cy.js` | No-MetaMask prompt, connect + SIWE sign-in, signature verification, rejected connect/sign, session restore, account switch & disconnect logout, network switching, message signing, logout + permission revoke |
| `dashboard.cy.js` | Overview stats/chart/tooltip, Portfolio table + hide-zero, Transactions filters, Send validation + simulated send, navigation |
| `walkthrough.cy.js` | Slow end-to-end flow for a watchable recording |

MetaMask is simulated by an EIP-1193 provider (`cypress/support/mockMetaMask.js`) injected as
`window.ethereum`. It signs with a throwaway `Wallet.createRandom()` key per test, so signatures are
real and verified — no seed phrase or secret is used. Videos land in `cypress/videos/`.

> VS Code's terminal sets `ELECTRON_RUN_AS_NODE=1`, which breaks Cypress; `scripts/cypress-run.mjs` clears it.

## Notes

- USD prices are **static demo values** (`src/config.js`), not live.
- Login signature is verified **in the browser only**. A production app must verify it on a backend (EIP-4361 with a server-issued nonce) and use an HttpOnly session cookie.
- Only public data (tx hashes, token addresses, UI prefs) is kept in browser storage.

## Compliance

Regulatory frameworks: none — demo project, no personal data is collected or stored.
