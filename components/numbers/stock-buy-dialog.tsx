"use client";

/**
 * CH-665 (Sir, 11 Nov): a customer account buys tracking numbers only from
 * our stock - never Twilio, never its own. A High Risk account sees and buys
 * only High Risk numbers, a Low Risk account only Low Risk. Each number's
 * price is taken from the balance when it is bought; the number is then the
 * account's alone.
 */
import { useEffect, useMemo, useState } from "react";
import { Hash, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTranslation } from "@/hooks/use-translation";
import { numbersService, type StockOffer } from "@/lib/api/services/numbers.service";
import { useNumbersStore } from "@/lib/store/numbers-store";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** "+18665550100" -> "+1 866-555-0100" for reading; the id is what is bought. */
function pretty(n: string): string {
  const d = n.replace(/\D/g, "");
  return d.length === 11 && d.startsWith("1") ? `+1 ${d.slice(1, 4)}-${d.slice(4, 7)}-${d.slice(7)}` : n;
}

export function StockBuyDialog({ open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const fetchNumbers = useNumbersStore((s) => s.fetch);

  const [offer, setOffer] = useState<StockOffer | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [buying, setBuying] = useState(false);

  // Fresh list every time the dialog opens: a number another account bought
  // since must not be offered.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelected(new Set());
    setOffer(null);
    setLoadError(null);
    setLoading(true);
    numbersService
      .stockOffer()
      .then(setOffer)
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : t("x665.loadFailed")))
      .finally(() => setLoading(false));
  }, [open, t]);

  const shown = useMemo(() => {
    const q = query.replace(/\D/g, "");
    const items = offer?.items ?? [];
    return q ? items.filter((i) => i.number.replace(/\D/g, "").includes(q)) : items;
  }, [offer, query]);

  const price = Number(offer?.price ?? 0);
  const total = (price * selected.size).toFixed(2);
  const typeLabel = offer ? t(offer.risk === "high" ? "x665.type.high" : "x665.type.low") : "";
  const allShown = shown.length > 0 && shown.every((i) => selected.has(i.id));

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((s) => {
      const next = new Set(s);
      for (const i of shown) {
        if (allShown) next.delete(i.id);
        else next.add(i.id);
      }
      return next;
    });
  }

  async function buy() {
    if (!offer || selected.size === 0) return;
    setBuying(true);
    // One at a time: each is a real purchase, and if one fails the ones
    // already bought are said exactly.
    const bought: string[] = [];
    const picks = offer.items.filter((i) => selected.has(i.id));
    try {
      for (const pick of picks) {
        await numbersService.stockBuy(pick.id);
        bought.push(pick.number);
      }
      toast.success(
        bought.length === 1 ? t("x665.boughtOne") : t("x665.boughtMany").replace("{count}", String(bought.length)),
        { description: bought.join(", ") },
      );
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("x665.buyFailed"), {
        description: bought.length
          ? t("x665.partBought")
              .replace("{bought}", String(bought.length))
              .replace("{count}", String(picks.length))
              .replace("{numbers}", bought.join(", "))
          : t("x665.noneBought"),
      });
      // Show what is still for sale now.
      numbersService.stockOffer().then(setOffer).catch(() => undefined);
      setSelected(new Set());
    } finally {
      setBuying(false);
      if (bought.length) void fetchNumbers();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !buying && onOpenChange(v)}>
      <DialogContent className="flex max-h-[90vh] w-[95vw] flex-col gap-4 sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Hash className="h-4 w-4" />
            </span>
            <div>
              <DialogTitle className="uppercase tracking-wide">{t("x665.title")}</DialogTitle>
              <DialogDescription>{t("x665.description")}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : loadError ? (
          <p className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">{loadError}</p>
        ) : offer ? (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant={offer.risk === "high" ? "destructive" : "secondary"}>{typeLabel}</Badge>
              <span>
                {t("x665.pricePerNumber").replace("{price}", offer.price)}
              </span>
              {offer.minute && (
                <span className="text-muted-foreground">
                  · {t("x665.pricePerMinute").replace("{price}", offer.minute)}
                </span>
              )}
              <span className="ml-auto text-xs text-muted-foreground">
                {t("x665.inStock").replace("{count}", String(offer.total))}
              </span>
            </div>

            {offer.items.length === 0 ? (
              <p className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
                {t("x665.empty").replace("{type}", typeLabel)}
              </p>
            ) : (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-9 pl-8"
                    inputMode="numeric"
                    placeholder={t("x665.search")}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <div className="min-h-[200px] flex-1 overflow-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-card">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-10 pl-4">
                          <Checkbox
                            checked={allShown}
                            onCheckedChange={toggleAll}
                            aria-label={t("x665.selectAll")}
                          />
                        </TableHead>
                        <TableHead>{t("x665.number")}</TableHead>
                        <TableHead>{t("x665.typeColumn")}</TableHead>
                        <TableHead className="text-right">{t("x665.priceColumn")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shown.map((i) => (
                        <TableRow key={i.id} className="cursor-pointer" onClick={() => toggle(i.id)}>
                          <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selected.has(i.id)}
                              onCheckedChange={() => toggle(i.id)}
                              aria-label={i.number}
                            />
                          </TableCell>
                          <TableCell className="font-mono tabular-nums">{pretty(i.number)}</TableCell>
                          <TableCell>{typeLabel}</TableCell>
                          <TableCell className="text-right tabular-nums">${offer.price}</TableCell>
                        </TableRow>
                      ))}
                      {shown.length === 0 && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                            {t("x665.noMatch")}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-muted-foreground">{t("x665.yoursAlone")}</p>
              </>
            )}
          </>
        ) : null}

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <span className="text-sm text-muted-foreground">
            {selected.size > 0 &&
              t("x665.selected").replace("{count}", String(selected.size)).replace("{total}", total)}
          </span>
          <Button disabled={buying || !offer || selected.size === 0} onClick={buy}>
            {buying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {selected.size > 1
              ? t("x665.buyMany").replace("{count}", String(selected.size)).replace("{total}", total)
              : t("x665.buyOne")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
