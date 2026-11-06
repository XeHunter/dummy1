// A MetaMask-compatible EIP-1193 provider for Cypress tests.
//
// It behaves like the injected `window.ethereum` from the MetaMask extension:
// connection requests, account permissions, personal_sign, network switching,
// and the accountsChanged / chainChanged events. Signatures are REAL — produced
// by a throwaway ethers Wallet created at test time (Wallet.createRandom()), so
// the app's signature verification actually runs. No key is ever stored.

import { getBytes, isHexString } from "ethers";

const SUPPORTED_CHAINS = new Set([1, 11155111, 8453, 10, 42161, 137]);

function rpcError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

const toHex = (n) => `0x${n.toString(16)}`;

export function createMockMetaMask({ wallet, chainId = 1, connected = false, rejectConnect = false, rejectSign = false, onRequest } = {}) {
  const listeners = {};
  const emit = (event, ...args) => setTimeout(() => (listeners[event] || []).forEach((fn) => fn(...args)), 0);

  const mm = {
    isMetaMask: true,
    wallet,
    chainId,
    connected,
    rejectConnect,
    rejectSign,
    calls: [], // every RPC call the app made, for assertions

    async request({ method, params = [] }) {
      mm.calls.push({ method, params });
      onRequest?.(method, params);
      const account = mm.wallet.address.toLowerCase();

      switch (method) {
        case "eth_requestAccounts":
          if (mm.rejectConnect) throw rpcError(4001, "User rejected the request.");
          mm.connected = true;
          return [account];

        case "eth_accounts":
          return mm.connected ? [account] : [];

        case "eth_chainId":
          return toHex(mm.chainId);

        case "net_version":
          return String(mm.chainId);

        case "eth_blockNumber":
          return "0x1";

        case "personal_sign": {
          if (!mm.connected) throw rpcError(4100, "The requested account has not been authorized.");
          if (mm.rejectSign) throw rpcError(4001, "User denied message signature.");
          const [data, address] = params;
          if (String(address).toLowerCase() !== account) throw rpcError(4100, "Unknown account.");
          return mm.wallet.signMessage(isHexString(data) ? getBytes(data) : data);
        }

        case "wallet_switchEthereumChain": {
          const next = parseInt(params[0]?.chainId, 16);
          if (!SUPPORTED_CHAINS.has(next)) throw rpcError(4902, "Unrecognized chain ID.");
          if (next !== mm.chainId) {
            mm.chainId = next;
            emit("chainChanged", toHex(next));
          }
          return null;
        }

        case "wallet_revokePermissions":
          mm.connected = false;
          return null;

        default:
          throw rpcError(4200, `Method not supported by mock: ${method}`);
      }
    },

    on(event, fn) {
      (listeners[event] ||= []).push(fn);
      return mm;
    },

    removeListener(event, fn) {
      listeners[event] = (listeners[event] || []).filter((f) => f !== fn);
      return mm;
    },

    // ----- Test controls (simulate the user acting inside MetaMask) -----
    switchAccount(newWallet) {
      mm.wallet = newWallet;
      emit("accountsChanged", [newWallet.address.toLowerCase()]);
    },
    disconnectFromExtension() {
      mm.connected = false;
      emit("accountsChanged", []);
    },
    switchChainFromExtension(id) {
      mm.chainId = id;
      emit("chainChanged", toHex(id));
    },
  };

  return mm;
}
