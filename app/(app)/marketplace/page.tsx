"use client";

/**
 * Marketplace — live RTB auction floor.
 *
 * Phase 8 redesign: the rich simulation has been replaced with a clean
 * "active auctions" table backed by /api/rtb/auctions, with a side-sheet
 * detail panel showing bid history + a place-bid form. WebSocket events
 * (`rtb.auction_created` / `rtb.bid_placed` / `rtb.auction_settled`) drive
 * live updates so the floor feels alive without polling.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Clock,
  Gavel,
  Loader2,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import {
  marketplaceService,
  type Auction,
  type AuctionStatus,
  type Bid,
} from "@/lib/api/services/marketplace.service";
import { createCallSocket, type CallSocket } from "@/lib/api/socket";
import { useBuyersStore } from "@/lib/store/buyers-store";
import { formatCallerId, formatCurrency, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_VARIANT: Record<AuctionStatus, "success" | "outline" | "destructive"> = {
  open: "success",
  settled: "outline",
  cancelled: "destructive",
};

export default function MarketplacePage() {
  const buyers = useBuyersStore((s) => s.buyers);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Auction | null>(null);
  const socketRef = useRef<CallSocket | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await marketplaceService.listAuctions({ page: 1, pageSize: 100 });
      setAuctions(page.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load auctions");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Live WebSocket — the call socket also carries RTB events.
  useEffect(() => {
    const socket = createCallSocket();
    socketRef.current = socket;

    const unsubCreated = socket.on("rtb.auction_created", (data) => {
      const auction = data as Auction;
      if (!auction?.id) return;
      setAuctions((prev) => [auction, ...prev.filter((a) => a.id !== auction.id)]);
    });

    const unsubBidPlaced = socket.on("rtb.bid_placed", (data) => {
      const bid = data as Bid;
      if (!bid?.auctionId) return;
      // Update the auction's winning-bid hint optimistically.
      setAuctions((prev) =>
        prev.map((a) =>
          a.id === bid.auctionId && (!a.winningBid || bid.amount > a.winningBid)
            ? { ...a, winningBid: bid.amount, winningBuyerId: bid.buyerId, winningBuyerName: bid.buyerName }
            : a,
        ),
      );
    });

    const unsubSettled = socket.on("rtb.auction_settled", (data) => {
      const auction = data as Auction;
      if (!auction?.id) return;
      setAuctions((prev) =>
        prev.map((a) => (a.id === auction.id ? { ...a, ...auction, status: "settled" } : a)),
      );
    });

    socket.connect();
    return () => {
      unsubCreated();
      unsubBidPlaced();
      unsubSettled();
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Stats — derived from the cached auctions list.
  const stats = useMemo(() => {
    const open = auctions.filter((a) => a.status === "open");
    const settled = auctions.filter((a) => a.status === "settled");
    const totalWinningSpend = settled.reduce((s, a) => s + (a.winningBid ?? 0), 0);
    const avgWinningBid = settled.length > 0 ? totalWinningSpend / settled.length : 0;
    return {
      openCount: open.length,
      settledCount: settled.length,
      totalWinningSpend,
      avgWinningBid,
    };
  }, [auctions]);

  const openAuctions = useMemo(
    () => auctions.filter((a) => a.status === "open").sort((a, b) => b.createdAt - a.createdAt),
    [auctions],
  );
  const settledAuctions = useMemo(
    () =>
      auctions
        .filter((a) => a.status !== "open")
        .sort((a, b) => (b.settledAt ?? b.createdAt) - (a.settledAt ?? a.createdAt))
        .slice(0, 20),
    [auctions],
  );

  return (
    <>
      <PageHeader
        title="Marketplace"
        description="Real-time bidding floor — live calls being auctioned to buyers."
        actions={
          <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={loading}>
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
        }
      />

      {/* ─── Floor stats ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <FloorStat
          icon={Activity}
          label="Open auctions"
          value={stats.openCount.toString()}
          accent="text-accent"
        />
        <FloorStat
          icon={CheckCircle2}
          label="Settled today"
          value={stats.settledCount.toString()}
          accent="text-[color:var(--success)]"
        />
        <FloorStat
          icon={TrendingUp}
          label="Avg winning bid"
          value={formatCurrency(stats.avgWinningBid, true)}
          accent="text-[color:var(--warning)]"
        />
        <FloorStat
          icon={Gavel}
          label="Total volume"
          value={formatCurrency(stats.totalWinningSpend)}
          accent="text-foreground"
        />
      </div>

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {/* ─── Open auctions ───────────────────────────────────────── */}
      <section className="space-y-2">
        <header className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Open auctions</h2>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {openAuctions.length} live
          </span>
        </header>
        {openAuctions.length === 0 && !loading ? (
          <EmptyState
            icon={Gavel}
            tone="cyan"
            title="No open auctions"
            description="When a campaign sends a call to RTB, it'll appear here in real time."
          />
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Auction</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Caller</TableHead>
                    <TableHead className="text-right">Bid floor</TableHead>
                    <TableHead className="text-right">Winning bid</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Age</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openAuctions.map((a) => (
                    <TableRow
                      key={a.id}
                      onClick={() => setSelected(a)}
                      className="cursor-pointer"
                    >
                      <TableCell className="font-mono text-xs">
                        {a.id.slice(0, 10)}…
                      </TableCell>
                      <TableCell className="text-xs">{a.campaignName ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {a.callerNumber ? formatCallerId(a.callerNumber) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-xs">
                        {formatCurrency(a.bidFloor, true)}
                      </TableCell>
                      <TableCell className="text-right">
                        {a.winningBid !== undefined ? (
                          <div className="font-mono tabular-nums text-xs">
                            <div className="font-semibold text-foreground">
                              {formatCurrency(a.winningBid, true)}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {a.winningBuyerName ?? a.winningBuyerId ?? "—"}
                            </div>
                          </div>
                        ) : (
                          <span className="font-mono text-xs text-muted-foreground/60">
                            no bids
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[a.status]} className="gap-1.5 text-[10px] uppercase tracking-wider">
                          <span className="relative inline-flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-70" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
                          </span>
                          {a.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {formatRelativeTime(a.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </section>

      {/* ─── Recently settled ────────────────────────────────────── */}
      {settledAuctions.length > 0 && (
        <section className="space-y-2">
          <header className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Recently settled</h2>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              last {settledAuctions.length}
            </span>
          </header>
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[800px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Auction</TableHead>
                    <TableHead>Winner</TableHead>
                    <TableHead className="text-right">Winning bid</TableHead>
                    <TableHead className="text-right">Settled</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settledAuctions.map((a) => (
                    <TableRow
                      key={a.id}
                      onClick={() => setSelected(a)}
                      className="cursor-pointer text-muted-foreground"
                    >
                      <TableCell className="font-mono text-xs">
                        {a.id.slice(0, 10)}…
                      </TableCell>
                      <TableCell className="text-xs">
                        {a.winningBuyerName ?? a.winningBuyerId ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-xs">
                        {a.winningBid !== undefined ? formatCurrency(a.winningBid, true) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {a.settledAt ? formatRelativeTime(a.settledAt) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </section>
      )}

      {/* ─── Detail sheet ────────────────────────────────────────── */}
      <AuctionDetailSheet
        auction={selected}
        onOpenChange={(v) => !v && setSelected(null)}
        buyers={buyers}
        onBidPlaced={(updated) => {
          // Push the updated winning bid into the table immediately.
          setAuctions((prev) =>
            prev.map((a) =>
              a.id === updated.auctionId
                ? {
                    ...a,
                    winningBid: updated.amount,
                    winningBuyerId: updated.buyerId,
                    winningBuyerName: updated.buyerName,
                  }
                : a,
            ),
          );
        }}
      />
    </>
  );
}

function FloorStat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-3.5">
        <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-lg bg-secondary/40", accent)}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className={cn("text-lg font-semibold tabular-nums tracking-tight", accent)}>
            {value}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Detail sheet — bid history + place-bid form ─────────────────── */

function AuctionDetailSheet({
  auction,
  onOpenChange,
  buyers,
  onBidPlaced,
}: {
  auction: Auction | null;
  onOpenChange: (open: boolean) => void;
  buyers: ReturnType<typeof useBuyersStore.getState>["buyers"];
  onBidPlaced: (bid: Bid) => void;
}) {
  const open = !!auction;
  const [bids, setBids] = useState<Bid[]>([]);
  const [bidsLoading, setBidsLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [buyerId, setBuyerId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Reset whenever a new auction is opened.
  useEffect(() => {
    if (!auction) {
      setBids([]);
      setAmount("");
      setBuyerId("");
      return;
    }
    setBidsLoading(true);
    void marketplaceService
      .listBids(auction.id)
      .then((rows) => setBids(rows.sort((a, b) => b.createdAt - a.createdAt)))
      .catch(() => setBids([]))
      .finally(() => setBidsLoading(false));
    // Pre-fill amount with bid floor + $0.50 as a sensible default minimum.
    if (auction.winningBid !== undefined) {
      setAmount((auction.winningBid + 0.5).toFixed(2));
    } else {
      setAmount((auction.bidFloor + 0.5).toFixed(2));
    }
    setBuyerId(buyers[0]?.id ?? "");
  }, [auction, buyers]);

  const parsedAmount = Number(amount);
  const canBid =
    !!auction &&
    auction.status === "open" &&
    !!buyerId &&
    Number.isFinite(parsedAmount) &&
    parsedAmount >= auction.bidFloor &&
    !submitting;

  const submit = async () => {
    if (!auction || !canBid) return;
    setSubmitting(true);
    try {
      const placed = await marketplaceService.submitBid({
        auctionId: auction.id,
        buyerId,
        amount: parsedAmount,
      });
      setBids((prev) => [placed, ...prev]);
      onBidPlaced(placed);
      toast.success(`Bid of ${formatCurrency(placed.amount, true)} placed`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bid failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        {auction && (
          <>
            <SheetHeader className="border-b border-border/60 p-6">
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                <span>{auction.id}</span>
                <span className="text-muted-foreground/40">·</span>
                <span>{formatRelativeTime(auction.createdAt)}</span>
              </div>
              <SheetTitle className="font-mono text-lg">
                {auction.callerNumber ? formatCallerId(auction.callerNumber) : "Auction"}
              </SheetTitle>
              <SheetDescription className="flex items-center gap-2">
                <Badge variant={STATUS_VARIANT[auction.status]} className="gap-1.5 text-[10px] uppercase tracking-wider">
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {auction.status}
                </Badge>
                <span className="text-xs">{auction.campaignName ?? "—"}</span>
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {/* Headline numbers */}
              <div className="grid grid-cols-2 gap-2 text-center">
                <Stat label="Bid floor" value={formatCurrency(auction.bidFloor, true)} />
                <Stat
                  label={auction.status === "settled" ? "Winning bid" : "Current bid"}
                  value={auction.winningBid !== undefined ? formatCurrency(auction.winningBid, true) : "—"}
                  highlight={auction.winningBid !== undefined}
                />
              </div>

              {/* Bid history */}
              <section className="mt-6">
                <h3 className="text-[11px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                  Bid history
                </h3>
                {bidsLoading ? (
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading bids…
                  </div>
                ) : bids.length === 0 ? (
                  <p className="mt-2 text-xs italic text-muted-foreground">No bids yet.</p>
                ) : (
                  <ol className="mt-2 space-y-1.5">
                    {bids.map((b) => (
                      <li
                        key={b.id}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-xs",
                          b.isWinning
                            ? "border-[color:var(--success)]/40 bg-[color:var(--success)]/10"
                            : "border-border/60 bg-card/40",
                        )}
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium">{b.buyerName ?? b.buyerId}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {formatRelativeTime(b.createdAt)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono tabular-nums">{formatCurrency(b.amount, true)}</div>
                          {b.isWinning && (
                            <div className="text-[10px] font-medium text-[color:var(--success)]">
                              Winning
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>

            {/* Place-bid form */}
            {auction.status === "open" && (
              <div className="border-t border-border/60 bg-background/40 p-4">
                <div className="mb-2 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  <Clock className="h-3 w-3" /> Place a bid
                </div>
                <div className="space-y-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Bid as</Label>
                    <Select value={buyerId} onValueChange={setBuyerId}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Pick a buyer" />
                      </SelectTrigger>
                      <SelectContent>
                        {buyers.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-1.5">
                      <Label className="text-xs">Amount (USD)</Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={auction.bidFloor}
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="font-mono tabular-nums"
                      />
                    </div>
                    <Button onClick={submit} disabled={!canBid}>
                      {submitting ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Placing…
                        </>
                      ) : (
                        <>
                          <Gavel className="h-3.5 w-3.5" /> Bid
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Bid must be at least {formatCurrency(auction.bidFloor, true)}.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        highlight ? "border-accent/40 bg-accent/5" : "border-border bg-secondary/30",
      )}
    >
      <div className="font-mono text-base font-bold">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
