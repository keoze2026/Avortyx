/**
 * Mock news feeds — used by the /news/crypto and /news/daily pages.
 *
 * Designed to plug into a real source later (CryptoCompare news API,
 * NewsAPI, RSS feeds, etc.) — just swap MOCK_CRYPTO_NEWS / MOCK_DAILY_NEWS
 * for the live response, the consumer interface won't change.
 */

const MINUTE = 1000 * 60;
const HOUR = 1000 * 60 * 60;

export type NewsCategory =
  | "Bitcoin"
  | "Ethereum"
  | "DeFi"
  | "NFT"
  | "Regulation"
  | "Markets"
  | "Layer 2"
  /* daily */
  | "Tech"
  | "Business"
  | "World"
  | "Politics"
  | "Science"
  | "Sports";

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  category: NewsCategory;
  /** When the article was published (ms epoch). */
  publishedAt: number;
  /** Linked-out URL — only the source is shown; full URL is for "Read more". */
  url: string;
  /** Two-color gradient used as a placeholder thumbnail when we don't have an image. */
  tint: [string, string];
  /** Real-source thumbnail URL. Renders in place of the tint gradient when set. */
  imageUrl?: string;
  /** WordPress post id from the feed's <guid> — lets the server look up a
   *  featured image for feeds that ship none (TechCrunch). */
  wpPostId?: number;
}

/* ─── Cryptocurrency feed ────────────────────────────────────────────── */

export const MOCK_CRYPTO_NEWS: NewsItem[] = [
  {
    id: "c1",
    title: "Bitcoin reclaims $98K as ETF inflows surge for fourth straight session",
    summary:
      "Spot Bitcoin ETFs absorbed $612M in net inflows yesterday, the highest single-day figure since the post-halving rally. BlackRock's IBIT alone accounted for over half of the volume.",
    source: "CoinDesk",
    category: "Bitcoin",
    publishedAt: Date.now() - 22 * MINUTE,
    url: "#",
    tint: ["#F7931A", "#FFB347"],
  },
  {
    id: "c2",
    title: "Ethereum spot ETFs near $20B AUM as staking-enabled variants enter SEC review",
    summary:
      "Three issuers filed amended S-1s this week proposing on-chain staking inside the ETF wrapper. Analysts at Bernstein expect approval by Q3 2026 if no policy shift occurs.",
    source: "The Block",
    category: "Ethereum",
    publishedAt: Date.now() - 2 * HOUR,
    url: "#",
    tint: ["#627EEA", "#8AA3F3"],
  },
  {
    id: "c3",
    title: "Solana DEX volume tops Ethereum L1 for the seventh consecutive week",
    summary:
      "Jupiter, Raydium, and Orca processed a combined $8.4B in the past 7 days, fueled by memecoin rotation and a new round of points-program speculation.",
    source: "DefiLlama",
    category: "DeFi",
    publishedAt: Date.now() - 4 * HOUR,
    url: "#",
    tint: ["#9945FF", "#14F195"],
  },
  {
    id: "c4",
    title: "SEC settles with two NFT issuers for unregistered securities offerings",
    summary:
      "The agency clarified that the case applies narrowly to projects making explicit revenue-share promises and does not signal a broader enforcement push against collectible NFTs.",
    source: "Bloomberg Crypto",
    category: "Regulation",
    publishedAt: Date.now() - 5 * HOUR,
    url: "#",
    tint: ["#E84142", "#F7A1A1"],
  },
  {
    id: "c5",
    title: "Base TVL crosses $14B as Coinbase rolls out gas-sponsored onboarding",
    summary:
      "The L2 added 1.2M new addresses in the past 30 days. Coinbase says paymaster-sponsored transactions will be free for the first 30 days per user.",
    source: "CoinMarketCap",
    category: "Layer 2",
    publishedAt: Date.now() - 7 * HOUR,
    url: "#",
    tint: ["#0052FF", "#4F8CFF"],
  },
  {
    id: "c6",
    title: "Memecoin sector adds $14B in market cap as DOGE breaks $0.40",
    summary:
      "Trading volume across the top 50 memecoins reached $9.1B in 24 hours. Analysts caution that funding rates are stretched to multi-month highs.",
    source: "Decrypt",
    category: "Markets",
    publishedAt: Date.now() - 9 * HOUR,
    url: "#",
    tint: ["#C2A633", "#F0DC82"],
  },
  {
    id: "c7",
    title: "Pudgy Penguins floor doubles after major retail partnership announcement",
    summary:
      "The brand confirmed a multi-year distribution agreement with Target. NFT trading volume on the collection jumped 480% in 12 hours.",
    source: "NFT Now",
    category: "NFT",
    publishedAt: Date.now() - 12 * HOUR,
    url: "#",
    tint: ["#7B61FF", "#B3A3FF"],
  },
  {
    id: "c8",
    title: "MakerDAO greenlights $500M tokenized T-bill allocation",
    summary:
      "Governance passed proposal with 92% support. The move expands real-world asset exposure on the protocol to over $3B.",
    source: "The Defiant",
    category: "DeFi",
    publishedAt: Date.now() - 16 * HOUR,
    url: "#",
    tint: ["#1AAB9B", "#5BD9C8"],
  },
  {
    id: "c9",
    title: "Hong Kong approves first inverse Bitcoin ETF for institutional clients",
    summary:
      "The fund will be available to professional investors only. Hong Kong now hosts seven Bitcoin-linked products totaling $1.8B AUM.",
    source: "SCMP",
    category: "Regulation",
    publishedAt: Date.now() - 19 * HOUR,
    url: "#",
    tint: ["#DC2626", "#FCA5A5"],
  },
  {
    id: "c10",
    title: "Vitalik proposes 'social slashing' mechanism for Ethereum validators",
    summary:
      "The post outlines penalties for validators that participate in attacks against the canonical chain. Discussion is still in early-stage research phase.",
    source: "ETH Research",
    category: "Ethereum",
    publishedAt: Date.now() - 22 * HOUR,
    url: "#",
    tint: ["#3C3C3D", "#62688F"],
  },
  {
    id: "c11",
    title: "Bitcoin Lightning Network capacity hits all-time high of 7,200 BTC",
    summary:
      "Cumulative channel capacity has grown 38% YTD. Strike and CashApp continue to lead in user-facing routing volume.",
    source: "Bitcoin Magazine",
    category: "Bitcoin",
    publishedAt: Date.now() - 26 * HOUR,
    url: "#",
    tint: ["#F7931A", "#FFB347"],
  },
  {
    id: "c12",
    title: "Trader sentiment index flips to 'Extreme Greed' for first time since March",
    summary:
      "The Crypto Fear & Greed Index closed yesterday at 82. Historically, readings above 80 have preceded short-term local tops.",
    source: "Alternative.me",
    category: "Markets",
    publishedAt: Date.now() - 30 * HOUR,
    url: "#",
    tint: ["#FFD600", "#FFEC8B"],
  },
];

/* ─── Daily news feed ────────────────────────────────────────────────── */

export const MOCK_DAILY_NEWS: NewsItem[] = [
  {
    id: "d1",
    title: "Federal Reserve signals no rate cuts through Q2 2026 as core inflation steadies",
    summary:
      "Powell emphasized data dependence in his press conference, citing wage growth and services inflation as ongoing concerns. Markets had priced a ~30% chance of a cut by May.",
    source: "Reuters",
    category: "Business",
    publishedAt: Date.now() - 18 * MINUTE,
    url: "#",
    tint: ["#005EB8", "#4D96DB"],
  },
  {
    id: "d2",
    title: "OpenAI and Anthropic open new joint frontier-safety lab in Zurich",
    summary:
      "The lab will employ 200 researchers focused on interpretability and pre-deployment evaluations. Both companies say results will be published openly.",
    source: "The Verge",
    category: "Tech",
    publishedAt: Date.now() - 1 * HOUR,
    url: "#",
    tint: ["#E50914", "#FF6B6B"],
  },
  {
    id: "d3",
    title: "EU finalizes Digital Identity Wallet rollout for all member states",
    summary:
      "Citizens of all 27 EU states will be able to verify their identity, store driver's licenses, and sign documents using a single app starting July 2026.",
    source: "Euronews",
    category: "World",
    publishedAt: Date.now() - 3 * HOUR,
    url: "#",
    tint: ["#003399", "#FFCC00"],
  },
  {
    id: "d4",
    title: "NASA's Mars Sample Return mission gets congressional funding extension",
    summary:
      "The $11B program now has confirmed funding through 2031, despite earlier proposals to scale it back. Sample tubes are expected back on Earth in 2033.",
    source: "Ars Technica",
    category: "Science",
    publishedAt: Date.now() - 5 * HOUR,
    url: "#",
    tint: ["#FC3D21", "#0B3D91"],
  },
  {
    id: "d5",
    title: "Major US carriers settle TCPA class action for $480M over robocall practices",
    summary:
      "Settlement covers an estimated 22 million subscribers. Plaintiffs alleged carriers failed to implement STIR/SHAKEN authentication in a timely manner.",
    source: "Law360",
    category: "Business",
    publishedAt: Date.now() - 6 * HOUR,
    url: "#",
    tint: ["#1F2937", "#6B7280"],
  },
  {
    id: "d6",
    title: "Apple's M5 Pro chip benchmarks leak — 22% single-core lead over M4 Pro",
    summary:
      "Geekbench entries suggest sustained multi-core gains around 18%. New MacBook Pros are expected in October.",
    source: "9to5Mac",
    category: "Tech",
    publishedAt: Date.now() - 8 * HOUR,
    url: "#",
    tint: ["#A8A8A8", "#E5E5E5"],
  },
  {
    id: "d7",
    title: "G20 finance ministers endorse global minimum tax floor for digital services",
    summary:
      "The agreement covers cloud, AI APIs, and ad-tech services. Implementation deadlines vary by jurisdiction but begin no later than 2027.",
    source: "Financial Times",
    category: "Politics",
    publishedAt: Date.now() - 11 * HOUR,
    url: "#",
    tint: ["#FFB6C1", "#FF69B4"],
  },
  {
    id: "d8",
    title: "Olympic 2028 organizing committee unveils LA venue map with three new sports",
    summary:
      "Cricket, flag football, and squash join the program. Total venue count remains 35, with 70% in the metro Los Angeles area.",
    source: "ESPN",
    category: "Sports",
    publishedAt: Date.now() - 14 * HOUR,
    url: "#",
    tint: ["#FF6F00", "#FFB300"],
  },
  {
    id: "d9",
    title: "Breakthrough in fusion energy: Commonwealth Fusion achieves net positive Q",
    summary:
      "The SPARC tokamak ran for 7 seconds at sustained net energy gain. Commercial demonstration plant is targeted for 2030.",
    source: "MIT News",
    category: "Science",
    publishedAt: Date.now() - 18 * HOUR,
    url: "#",
    tint: ["#00B7C2", "#7DFFE4"],
  },
  {
    id: "d10",
    title: "Senate passes bipartisan data privacy act with strong cross-aisle support",
    summary:
      "The bill establishes a federal floor for consumer data rights and a private right of action for major violations. House action expected next month.",
    source: "Politico",
    category: "Politics",
    publishedAt: Date.now() - 20 * HOUR,
    url: "#",
    tint: ["#B91C1C", "#DC2626"],
  },
  {
    id: "d11",
    title: "Major heat dome breaks records across the Pacific Northwest",
    summary:
      "Portland hit 109°F and Seattle 105°F yesterday. Emergency cooling centers reported full capacity at peak afternoon hours.",
    source: "AP News",
    category: "World",
    publishedAt: Date.now() - 24 * HOUR,
    url: "#",
    tint: ["#F97316", "#FED7AA"],
  },
  {
    id: "d12",
    title: "Boeing finalizes settlement with DOJ over 737 MAX certification issues",
    summary:
      "The $2.5B agreement includes mandatory third-party safety audits through 2028 and personnel changes in the certification division.",
    source: "WSJ",
    category: "Business",
    publishedAt: Date.now() - 30 * HOUR,
    url: "#",
    tint: ["#1E40AF", "#60A5FA"],
  },
];
