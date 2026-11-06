// Supported networks and well-known ERC-20 tokens per network.

const USDC = (address) => ({ symbol: "USDC", name: "USD Coin", decimals: 6, address });
const WETH = (address) => ({ symbol: "WETH", name: "Wrapped Ether", decimals: 18, address });

export const NETWORKS = {
  1: {
    name: "Ethereum",
    symbol: "ETH",
    nativeName: "Ether",
    explorer: "https://etherscan.io",
    tokens: [
      USDC("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"),
      { symbol: "USDT", name: "Tether USD", decimals: 6, address: "0xdac17f958d2ee523a2206206994597c13d831ec7" },
      { symbol: "DAI", name: "Dai Stablecoin", decimals: 18, address: "0x6b175474e89094c44da98b954eedeac495271d0f" },
      WETH("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"),
      { symbol: "LINK", name: "Chainlink", decimals: 18, address: "0x514910771af9ca656af840dff83e8264ecf986ca" },
    ],
  },
  11155111: {
    name: "Sepolia",
    symbol: "ETH",
    nativeName: "Sepolia Ether",
    testnet: true,
    explorer: "https://sepolia.etherscan.io",
    tokens: [
      USDC("0x1c7d4b196cb0c7b01d743fbc6116a902379c7238"),
      { symbol: "LINK", name: "Chainlink", decimals: 18, address: "0x779877a7b0d9e8603169ddbd7836e478b4624789" },
      WETH("0xfff9976782d46cc05630d1f6ebab18b2324d6b14"),
    ],
  },
  8453: {
    name: "Base",
    symbol: "ETH",
    nativeName: "Ether",
    explorer: "https://basescan.org",
    tokens: [USDC("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"), WETH("0x4200000000000000000000000000000000000006")],
  },
  10: {
    name: "Optimism",
    symbol: "ETH",
    nativeName: "Ether",
    explorer: "https://optimistic.etherscan.io",
    tokens: [USDC("0x0b2c639c533813f4aa9d7837caf62653d097ff85"), WETH("0x4200000000000000000000000000000000000006")],
  },
  42161: {
    name: "Arbitrum One",
    symbol: "ETH",
    nativeName: "Ether",
    explorer: "https://arbiscan.io",
    tokens: [USDC("0xaf88d065e77c8cc2239327c5edb3a432268e5831"), WETH("0x82af49447d8a07e3bd95bd0d56f35241523fbab1")],
  },
  137: {
    name: "Polygon",
    symbol: "POL",
    nativeName: "Polygon",
    explorer: "https://polygonscan.com",
    tokens: [USDC("0x3c499c542cef5e3811e1192ce70d8cc03d5c3359"), WETH("0x7ceb23fd6bc0add59e62ac25578270cff1b9f619")],
  },
};

// Indicative demo prices in USD (not live). Testnet assets are valued at nothing.
export const PRICES = { ETH: 3200, WETH: 3200, POL: 0.4, USDC: 1, USDT: 1, DAI: 1, LINK: 15 };

// Categorical series colors (fixed order, validated for the dark surface).
// Assigned by an asset's position in the asset list, never by its rank.
export const SERIES = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];

export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

export function networkOf(chainId) {
  return (
    NETWORKS[chainId] || {
      name: `Chain ${chainId}`,
      symbol: "ETH",
      nativeName: "Native coin",
      explorer: null,
      tokens: [],
      unsupported: true,
    }
  );
}

const HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;

export function txUrl(chainId, hash) {
  const { explorer } = networkOf(chainId);
  return explorer && HASH_RE.test(hash) ? `${explorer}/tx/${hash}` : null;
}

export function addressUrl(chainId, address) {
  const { explorer } = networkOf(chainId);
  return explorer && ADDR_RE.test(address) ? `${explorer}/address/${address}` : null;
}
