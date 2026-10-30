/**
 * CoinGecko data fetcher.
 *
 * Server-side only — uses Next.js `fetch(..., { next: { revalidate: 300 } })`
 * so one upstream call covers every visitor for the next 5 minutes. If the
 * API errors, rate-limits, or times out we fall back to the static mock seed
 * so the page never breaks.
 *
 *   GET /api/v3/coins/markets?vs_currency=usd
 *      &order=market_cap_desc
 *      &per_page=50
 *      &page=1
 *      &sparkline=true
 *      &price_change_percentage=1h,24h,7d
 */

import type { TokenEntry } from "./mock/tokens";

const ENDPOINT = "https://api.coingecko.com/api/v3/coins/markets";

/** Hard cap on the upstream call. Without this, a slow CoinGecko response
 *  can hang `next build` until the 60s static-generation timeout fires. */
const UPSTREAM_TIMEOUT_MS = 5_000;
/** The coin detail payload is larger; give it a little longer. */
const DETAIL_TIMEOUT_MS = 8_000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit & { next?: { revalidate?: number } },
  timeoutMs = UPSTREAM_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export type TokensSource = "live" | "fallback";

export interface TokensResult {
  tokens: TokenEntry[];
  /** "live" = real data from CoinGecko. "fallback" = stale mock seed used
   *  because the upstream call failed (timeout, rate-limit, network). */
  source: TokensSource;
}

interface CoinGeckoMarket {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  circulating_supply: number;
  price_change_percentage_1h_in_currency?: number;
  price_change_percentage_24h_in_currency?: number;
  price_change_percentage_7d_in_currency?: number;
  sparkline_in_7d?: { price: number[] };
}

/**
 * Re-fetch the top-N tokens.
 *
 * `revalidateSec` controls Next.js's fetch cache window. The initial server
 * render passes a relaxed 300s; the /api/tokens polling endpoint passes 8s
 * so client polls share a single upstream call every few seconds regardless
 * of how many visitors are connected.
 *
 * If CoinGecko is unreachable we return an empty array — never a stale mock
 * seed. The client side keeps the last good snapshot it received so the
 * operator continues to see real, recent values instead of placeholders.
 */
export async function fetchTopTokens(
  perPage = 250,
  revalidateSec = 300,
  page = 1,
): Promise<TokensResult> {
  const url =
    `${ENDPOINT}?vs_currency=usd&order=market_cap_desc&per_page=${perPage}` +
    `&page=${page}&sparkline=true&price_change_percentage=1h,24h,7d`;
  try {
    const res = await fetchWithTimeout(url, {
      next: { revalidate: revalidateSec },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`CoinGecko returned ${res.status}`);
    const raw = (await res.json()) as CoinGeckoMarket[];
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new Error("CoinGecko returned an empty payload");
    }
    return { tokens: raw.map(toTokenEntry), source: "live" };
  } catch (err) {
    console.warn("[coingecko] upstream failed:", (err as Error).message);
    return { tokens: [], source: "fallback" };
  }
}

/** Map one CoinGecko market record onto our `TokenEntry` shape. */
function toTokenEntry(m: CoinGeckoMarket): TokenEntry {
  const sparkSource = m.sparkline_in_7d?.price ?? [];
  // CoinGecko returns ~168 hourly points — downsample to keep our SVG light.
  const sparkline = downsample(sparkSource, 25);

  return {
    rank: m.market_cap_rank ?? 0,
    symbol: m.symbol.toUpperCase(),
    name: m.name,
    logoUrl: m.image,
    // Fallback tint stays in case the image fails to load — keeps the row
    // visually balanced.
    tint: ["#5266E0", "#818CF8"],
    price: m.current_price ?? 0,
    change1h: m.price_change_percentage_1h_in_currency ?? 0,
    change24h: m.price_change_percentage_24h_in_currency ?? 0,
    change7d: m.price_change_percentage_7d_in_currency ?? 0,
    marketCap: m.market_cap ?? 0,
    volume24h: m.total_volume ?? 0,
    circulatingSupply: m.circulating_supply ?? 0,
    sparkline:
      sparkline.length >= 2
        ? sparkline
        : [m.current_price ?? 0, m.current_price ?? 0],
  };
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Per-coin detail                                                     */
/* ─────────────────────────────────────────────────────────────────── */

export interface CoinDetail {
  id: string;
  symbol: string;
  name: string;
  rank: number;
  logoUrl?: string;
  /** Long-form HTML description from CoinGecko. May be empty. */
  description: string;
  homepageUrl?: string;
  blockchainExplorerUrl?: string;
  price: number;
  change24h: number;
  marketCap: number;
  fullyDilutedValuation?: number;
  volume24h: number;
  circulatingSupply: number;
  totalSupply?: number;
  maxSupply?: number;
  ath: number;
  athChangePct: number;
  athDate?: string;
  atl: number;
  atlChangePct: number;
  atlDate?: string;
  /** "live" or "fallback" (synthesized from MOCK_TOKENS). */
  source: TokensSource;
}

interface CoinGeckoCoin {
  id: string;
  symbol: string;
  name: string;
  market_cap_rank?: number;
  image?: { thumb?: string; small?: string; large?: string };
  description?: { en?: string };
  links?: {
    homepage?: string[];
    blockchain_site?: string[];
  };
  market_data?: {
    current_price?: { usd?: number };
    market_cap?: { usd?: number };
    fully_diluted_valuation?: { usd?: number };
    total_volume?: { usd?: number };
    price_change_percentage_24h?: number;
    circulating_supply?: number;
    total_supply?: number;
    max_supply?: number;
    ath?: { usd?: number };
    ath_change_percentage?: { usd?: number };
    ath_date?: { usd?: string };
    atl?: { usd?: number };
    atl_change_percentage?: { usd?: number };
    atl_date?: { usd?: string };
  };
}

/**
 * Fetch detail for a single coin. `idOrSymbol` is preferentially CoinGecko's
 * stable id ("bitcoin", "ethereum"). If we only have a symbol we resolve it
 * via the cached top-list lookup before hitting the detail endpoint.
 */
export async function fetchCoinDetail(
  idOrSymbol: string,
  revalidateSec = 30,
): Promise<CoinDetail | null> {
  // Step 1: resolve to a CoinGecko id. The detail endpoint requires the id
  // ("bitcoin"), not the symbol ("btc"), and the input from the URL may be
  // either casing/form.
  const id = await resolveCoinId(idOrSymbol);
  if (!id) return null;

  const url =
    `https://api.coingecko.com/api/v3/coins/${id}?` +
    `localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`;

  try {
    // CH-440: capped like the list call, so a slow CoinGecko can't hold the
    // coin page's header and stats for long.
    const res = await fetchWithTimeout(url, {
      next: { revalidate: revalidateSec },
      headers: { Accept: "application/json" },
    }, DETAIL_TIMEOUT_MS);
    if (!res.ok) throw new Error(`CoinGecko returned ${res.status}`);
    const raw = (await res.json()) as CoinGeckoCoin;
    return toCoinDetail(raw, "live");
  } catch (err) {
    console.warn(
      "[coingecko] coin detail upstream failed:",
      (err as Error).message,
    );
    // No mock fallback — surfacing real-but-stale data isn't possible from a
    // single server fetch, so return null and let the route handle it.
    return null;
  }
}

/** Map CoinGecko's bulky detail payload into a flat consumer shape. */
function toCoinDetail(c: CoinGeckoCoin, source: TokensSource): CoinDetail {
  const m = c.market_data ?? {};
  // Strip HTML from the description so consumers can decide how to render it.
  const description = (c.description?.en ?? "").trim();
  const homepageUrl = c.links?.homepage?.find((u) => !!u) ?? undefined;
  const blockchainExplorerUrl = c.links?.blockchain_site?.find((u) => !!u) ?? undefined;
  return {
    id: c.id,
    symbol: c.symbol.toUpperCase(),
    name: c.name,
    rank: c.market_cap_rank ?? 0,
    logoUrl: c.image?.large ?? c.image?.small ?? c.image?.thumb,
    description,
    homepageUrl,
    blockchainExplorerUrl,
    price: m.current_price?.usd ?? 0,
    change24h: m.price_change_percentage_24h ?? 0,
    marketCap: m.market_cap?.usd ?? 0,
    fullyDilutedValuation: m.fully_diluted_valuation?.usd,
    volume24h: m.total_volume?.usd ?? 0,
    circulatingSupply: m.circulating_supply ?? 0,
    totalSupply: m.total_supply ?? undefined,
    maxSupply: m.max_supply ?? undefined,
    ath: m.ath?.usd ?? 0,
    athChangePct: m.ath_change_percentage?.usd ?? 0,
    athDate: m.ath_date?.usd,
    atl: m.atl?.usd ?? 0,
    atlChangePct: m.atl_change_percentage?.usd ?? 0,
    atlDate: m.atl_date?.usd,
    source,
  };
}

/**
 * Resolve a raw URL segment ("bitcoin", "BTC", "btc") to a CoinGecko id.
 * We re-use the top-tokens list (cached) to look up symbols. If the segment
 * is already a known id we pass it through.
 */
async function resolveCoinId(input: string): Promise<string | null> {
  const raw = input.toLowerCase();
  if (!raw) return null;
  // Common direct cases — most users hit these.
  if (DIRECT_ID_GUESSES[raw]) return DIRECT_ID_GUESSES[raw];

  // Otherwise look up via the cached top-250 list. Symbol -> id mapping.
  try {
    const { tokens } = await fetchTopTokens(250, 300, 1);
    const upper = input.toUpperCase();
    const match = tokens.find((t) => t.symbol === upper);
    if (match) {
      // The TokenEntry shape doesn't carry the id, but CoinGecko's id is the
      // lowercase canonical name in most cases ("bitcoin", "ethereum"). We
      // derive it as best-effort.
      return match.name.toLowerCase().replace(/\s+/g, "-");
    }
  } catch {
    /* fall through */
  }
  // Last resort — treat the segment as the id itself.
  return raw;
}

/** Small lookup for the most common coins so we don't pay the list call. */
const DIRECT_ID_GUESSES: Record<string, string> = {
  btc: "bitcoin",
  bitcoin: "bitcoin",
  eth: "ethereum",
  ethereum: "ethereum",
  sol: "solana",
  solana: "solana",
  bnb: "binancecoin",
  xrp: "ripple",
  ripple: "ripple",
  usdt: "tether",
  tether: "tether",
  usdc: "usd-coin",
  ada: "cardano",
  cardano: "cardano",
  doge: "dogecoin",
  dogecoin: "dogecoin",
  dot: "polkadot",
  polkadot: "polkadot",
  link: "chainlink",
  chainlink: "chainlink",
  matic: "matic-network",
  polygon: "matic-network",
  avax: "avalanche-2",
  avalanche: "avalanche-2",
  ton: "the-open-network",
  toncoin: "the-open-network",
  trx: "tron",
  tron: "tron",
  shib: "shiba-inu",
  ltc: "litecoin",
  litecoin: "litecoin",
  bch: "bitcoin-cash",
  near: "near",
  uni: "uniswap",
  icp: "internet-computer",
  apt: "aptos",
};

function downsample(arr: number[], target: number): number[] {
  if (arr.length <= target) return arr;
  const step = arr.length / target;
  const out: number[] = [];
  for (let i = 0; i < target; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}
