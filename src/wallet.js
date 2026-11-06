// MetaMask connection, Sign-In-with-Ethereum style login, and wallet events.
//
// NOTE: This demo verifies the login signature in the browser only. In a real
// app, fetch a nonce from your backend, send { message, signature } back,
// verify it server-side (EIP-4361), and issue an HttpOnly session cookie.

import { BrowserProvider, getAddress, verifyMessage, hexlify, randomBytes } from "ethers";

const SESSION_KEY = "lumina.session";

export const state = { address: null, chainId: null, message: null, signedAt: null };

let provider = null;

export const hasWallet = () => typeof window !== "undefined" && !!window.ethereum;

export function getProvider() {
  if (!provider) provider = new BrowserProvider(window.ethereum);
  return provider;
}

export function getSigner() {
  return getProvider().getSigner(state.address);
}

function buildMessage(address, chainId) {
  return [
    `${location.host} wants you to sign in with your Ethereum account:`,
    address,
    "",
    "Sign in to Lumina. This request will not trigger a transaction or cost gas.",
    "",
    `URI: ${location.origin}`,
    "Version: 1",
    `Chain ID: ${chainId}`,
    `Nonce: ${hexlify(randomBytes(16)).slice(2)}`,
    `Issued At: ${new Date().toISOString()}`,
  ].join("\n");
}

// UI session flag only (address + the public login message). Cleared when the tab closes.
function saveSession() {
  try {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ address: state.address, message: state.message, signedAt: state.signedAt }),
    );
  } catch {
    /* ignore */
  }
}

function readSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

function resetState() {
  Object.assign(state, { address: null, chainId: null, message: null, signedAt: null });
}

export async function connect() {
  const p = getProvider();
  const accounts = await p.send("eth_requestAccounts", []);
  if (!accounts?.length) throw new Error("No account returned");

  const address = getAddress(accounts[0]);
  const chainId = Number((await p.getNetwork()).chainId);
  const message = buildMessage(address, chainId);

  const signer = await p.getSigner(address);
  const signature = await signer.signMessage(message);
  if (verifyMessage(message, signature) !== address) throw new Error("Signature verification failed");

  Object.assign(state, { address, chainId, message, signedAt: Date.now() });
  saveSession();
}

// Restore a session after page refresh, only if MetaMask still exposes the same account.
export async function restore() {
  if (!hasWallet()) return;
  const saved = readSession();
  if (!saved?.address) return;
  try {
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    if (accounts[0] && accounts[0].toLowerCase() === saved.address.toLowerCase()) {
      const chainHex = await window.ethereum.request({ method: "eth_chainId" });
      Object.assign(state, {
        address: getAddress(accounts[0]),
        chainId: parseInt(chainHex, 16),
        message: saved.message,
        signedAt: saved.signedAt,
      });
      return;
    }
  } catch {
    /* fall through */
  }
  clearSession();
}

export async function disconnect() {
  clearSession();
  resetState();
  try {
    await window.ethereum.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] });
  } catch {
    /* older MetaMask versions don't support this */
  }
}

export async function switchChain(chainId) {
  await window.ethereum.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: `0x${Number(chainId).toString(16)}` }],
  });
}

export function watch({ onAccountsChanged, onChainChanged }) {
  if (!hasWallet()) return;
  window.ethereum.on("accountsChanged", (accounts) => {
    // Any account switch requires a fresh sign-in.
    if (!state.address) return;
    if (!accounts.length || accounts[0].toLowerCase() !== state.address.toLowerCase()) {
      clearSession();
      resetState();
      onAccountsChanged?.();
    }
  });
  window.ethereum.on("chainChanged", (chainHex) => {
    provider = null; // ethers providers are bound to one network
    if (!state.address) return;
    state.chainId = parseInt(chainHex, 16);
    onChainChanged?.();
  });
}

export function describeError(err, fallback) {
  const code = err?.code ?? err?.error?.code ?? err?.info?.error?.code;
  if (code === 4001 || code === "ACTION_REJECTED") return "Request rejected in MetaMask.";
  if (code === -32002) return "A MetaMask request is already pending — open the extension.";
  if (code === 4902) return "This network isn't added to MetaMask yet. Add it in MetaMask first.";
  if (code === "INSUFFICIENT_FUNDS") return "Insufficient funds to cover the amount plus gas.";
  if (code === "CALL_EXCEPTION" || code === "BAD_DATA") return "The contract call failed on this network.";
  return fallback;
}
