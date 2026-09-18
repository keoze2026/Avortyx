import { CoinMarketHeader, CoinMarketTabs } from "./coin-market-tabs";

/**
 * Coin Market.
 *
 * Renders the page shell immediately; the client tab component pulls the
 * token tape and the crypto headlines itself (`/api/tokens`, `/api/news`),
 * showing skeletons in the meantime and a locally cached snapshot on return
 * visits. The page used to `await` CoinGecko + CryptoCompare on the server
 * before sending a single byte, so every visitor sat on a blank screen for
 * as long as the slowest upstream took — up to the 5 s timeout when one of
 * them was rate-limited.
 */
export default function CoinMarketPage() {
  return (
    <div className="space-y-4">
      <CoinMarketHeader />
      <CoinMarketTabs />
    </div>
  );
}
