import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, ExternalLink, Globe } from "lucide-react";

import { TradingViewChart } from "@/components/coinmarket/tradingview-chart";
import { CoinDetailLabels, CoinDetailStat } from "@/components/coinmarket/coin-detail-labels";
import { Card } from "@/components/ui/card";
import { fetchCoinDetail } from "@/lib/coingecko";
import {
  formatCompactCurrency,
  formatSupply,
  formatTokenPrice,
} from "@/lib/mock/tokens";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Per-token detail page.
 *
 * Pulls live data from CoinGecko's `/coins/{id}` endpoint (cached 30s on the
 * server), embeds TradingView's free advanced-chart widget for the candle
 * series, and surfaces the headline stats around it. If CoinGecko is
 * unreachable we fall back to a synthesized snapshot from MOCK_TOKENS and
 * show a banner — same pattern as the listing page.
 */
export default async function CoinDetailPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  const coin = await fetchCoinDetail(symbol);
  if (!coin) notFound();

  const positive = coin.change24h >= 0;
  const POSITIVE = "text-[oklch(0.5_0.18_155)] dark:text-[oklch(0.78_0.18_155)]";
  const NEGATIVE = "text-destructive";

  return (
    <div className="space-y-5">
      <Link
        href="/news/crypto"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <CoinDetailLabels which="allTokens" />
      </Link>

      {/* Header — logo, name, price, 24h change */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {coin.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coin.logoUrl}
                alt={`${coin.symbol} logo`}
                width={48}
                height={48}
                className="h-12 w-12 shrink-0 rounded-full bg-secondary/40"
              />
            ) : (
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/12 text-sm font-bold text-accent">
                {coin.symbol.slice(0, 3)}
              </span>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  {coin.name}
                </h1>
                <span className="rounded-md bg-secondary/60 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {coin.symbol}
                </span>
                {coin.rank > 0 && (
                  <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    <CoinDetailLabels which="rank" params={{ rank: String(coin.rank) }} />
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex items-baseline gap-3">
                <span className="text-2xl font-semibold tabular-nums sm:text-3xl">
                  {formatTokenPrice(coin.price)}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 text-sm tabular-nums",
                    positive ? POSITIVE : NEGATIVE,
                  )}
                >
                  {positive ? (
                    <ArrowUp className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowDown className="h-3.5 w-3.5" />
                  )}
                  {formatPercent(Math.abs(coin.change24h), 2)}
                  <span className="text-[11px] text-muted-foreground"><CoinDetailLabels which="per24h" /></span>
                </span>
              </div>
            </div>
          </div>

          {/* External links */}
          <div className="flex flex-wrap items-center gap-2">
            {coin.homepageUrl && (
              <Link
                href={coin.homepageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/30 px-3 py-1.5 text-xs transition-colors hover:bg-secondary/60 hover:text-foreground"
              >
                <Globe className="h-3.5 w-3.5" />
                <CoinDetailLabels which="website" />
                <ExternalLink className="h-3 w-3 opacity-60" />
              </Link>
            )}
            {coin.blockchainExplorerUrl && (
              <Link
                href={coin.blockchainExplorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/30 px-3 py-1.5 text-xs transition-colors hover:bg-secondary/60 hover:text-foreground"
              >
                <CoinDetailLabels which="explorer" />
                <ExternalLink className="h-3 w-3 opacity-60" />
              </Link>
            )}
          </div>
        </div>

      </Card>

      {/* TradingView candle chart — live from the public widget. */}
      <TradingViewChart symbol={coin.symbol} interval="60" />

      {/* Key stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <CoinDetailStat labelKey="marketCap" value={formatCompactCurrency(coin.marketCap)} />
        <CoinDetailStat labelKey="volume24h" value={formatCompactCurrency(coin.volume24h)} />
        <CoinDetailStat
          labelKey="circulatingSupply"
          value={formatSupply(coin.circulatingSupply, coin.symbol)}
        />
        {coin.fullyDilutedValuation ? (
          <CoinDetailStat
            labelKey="fullyDiluted"
            value={formatCompactCurrency(coin.fullyDilutedValuation)}
          />
        ) : coin.maxSupply ? (
          <CoinDetailStat
            labelKey="maxSupply"
            value={formatSupply(coin.maxSupply, coin.symbol)}
          />
        ) : (
          <CoinDetailStat labelKey="maxSupply" value="—" />
        )}
        <CoinDetailStat
          labelKey="athLabel"
          value={formatTokenPrice(coin.ath)}
          foot={
            <span
              className={cn(
                "text-[11px] tabular-nums",
                coin.athChangePct >= 0 ? POSITIVE : NEGATIVE,
              )}
            >
              {coin.athChangePct >= 0 ? "+" : ""}
              {formatPercent(coin.athChangePct, 1)} <CoinDetailLabels which="fromAth" />
            </span>
          }
        />
        <CoinDetailStat
          labelKey="atlLabel"
          value={formatTokenPrice(coin.atl)}
          foot={
            <span
              className={cn(
                "text-[11px] tabular-nums",
                coin.atlChangePct >= 0 ? POSITIVE : NEGATIVE,
              )}
            >
              {coin.atlChangePct >= 0 ? "+" : ""}
              {formatPercent(coin.atlChangePct, 1)} <CoinDetailLabels which="fromAtl" />
            </span>
          }
        />
        {coin.totalSupply && (
          <CoinDetailStat
            labelKey="totalSupply"
            value={formatSupply(coin.totalSupply, coin.symbol)}
          />
        )}
      </div>

      {/* About — CoinGecko-supplied description. May contain anchor tags so we
          render it as HTML, but strip everything potentially dangerous first. */}
      {coin.description && (
        <Card className="space-y-2 p-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider">
            <CoinDetailLabels which="aboutLabel" params={{ name: coin.name }} />
          </h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {stripHtml(coin.description)}
          </p>
        </Card>
      )}
    </div>
  );
}

/** Drop HTML tags from CoinGecko's description so we can render it as plain text. */
function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, "").replace(/\s+\n/g, "\n").trim();
}
