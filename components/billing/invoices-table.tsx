"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Download, ExternalLink, FileText } from "lucide-react";
import { toast } from "sonner";

import { Pagination } from "@/components/shared/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import { billingService, type Invoice } from "@/lib/api/services/billing.service";
import { dateStamped, downloadRows, type ExportColumn } from "@/lib/export";
import { ExportMenu } from "@/components/shared/export-menu";
import type { InvoiceStatus } from "@/lib/types";
import { useTranslation } from "@/hooks/use-translation";

const STATUS_VARIANT: Record<InvoiceStatus, React.ComponentProps<typeof Badge>["variant"]> = {
  paid: "success",
  open: "warning",
  void: "outline",
  uncollectible: "destructive",
};
const STATUS_LABEL_KEYS: Record<InvoiceStatus, string> = {
  paid: "toolsUI.billing.invoices.status.paid",
  open: "toolsUI.billing.invoices.status.open",
  void: "toolsUI.billing.invoices.status.void",
  uncollectible: "toolsUI.billing.invoices.status.uncollectible",
};

function normalizeInvoiceStatus(raw: string | undefined): InvoiceStatus {
  const s = (raw ?? "").toLowerCase();
  if (s === "paid" || s === "open" || s === "void" || s === "uncollectible") return s;
  return "open";
}

export function InvoicesTable() {
  const { t } = useTranslation();
  const [pageSize, setPageSize] = React.useState(25);
  const [page, setPage] = React.useState(0);
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [total, setTotal] = React.useState(0);

  React.useEffect(() => {
    setPage(0);
  }, [pageSize]);

  // Paginate against the backend rather than slicing a local cache so the
  // table can show every invoice in the org, not just the first page-size.
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await billingService.invoices({ page: page + 1, pageSize });
        if (cancelled) return;
        setInvoices(res.items);
        setTotal(res.total);
      } catch {
        // Endpoint may be unavailable in early environments — render empty.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, pageSize]);

  const visible = invoices;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-accent" />
          {t("toolsUI.billing.invoices.title")}
        </CardTitle>
        <ExportMenu
          onExport={async (format) => {
            try {
              // Pull a large page so the export reflects every invoice the
              // backend will hand back, not just the page currently rendered.
              const all = await billingService.invoices({ page: 1, pageSize: 1000 });
              const rows = all.items;
              downloadRows(
                format,
                INVOICE_EXPORT_COLUMNS,
                rows,
                dateStamped("invoices"),
                "Invoices",
              );
              toast.success(t("toolsUI.billing.invoices.toastExported"));
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Export failed");
            }
          }}
        >
          <Button variant="outline" size="sm">
            <Download className="h-3 w-3" /> {t("toolsUI.billing.invoices.exportAll")}
          </Button>
        </ExportMenu>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/40">
                <TableHead className="text-left">{t("toolsUI.billing.invoices.columns.invoice")}</TableHead>
                <TableHead className="text-left">{t("toolsUI.billing.invoices.columns.date")}</TableHead>
                <TableHead className="text-left">{t("toolsUI.billing.invoices.columns.description")}</TableHead>
                <TableHead className="text-right">{t("toolsUI.billing.invoices.columns.amount")}</TableHead>
                <TableHead>{t("toolsUI.billing.invoices.columns.status")}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((inv, i) => {
                const status = normalizeInvoiceStatus(inv.status);
                // Derive a date and a description from the period range since
                // the backend's CallLogListSchema-style invoice doesn't have a
                // plain `description` field.
                const date = inv.periodEnd ? new Date(inv.periodEnd) : new Date();
                const periodStart = inv.periodStart ? new Date(inv.periodStart).toLocaleDateString() : "";
                const periodEnd = inv.periodEnd ? new Date(inv.periodEnd).toLocaleDateString() : "";
                const description = periodStart && periodEnd
                  ? `${periodStart} → ${periodEnd} · ${inv.totalCalls} calls`
                  : `${inv.totalCalls} calls`;
                return (
                  <motion.tr
                    key={inv.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.025, duration: 0.22 }}
                    className="border-b border-border/60 transition-colors hover:bg-secondary/20"
                  >
                    <TableCell className="font-mono text-xs">{inv.invoiceNumber}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {date.toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-xs">{description}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatCurrency(inv.totalAmount, true)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[status]}>{t(STATUS_LABEL_KEYS[status])}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={t("toolsUI.billing.invoices.openAria")}
                        onClick={() => toast.success(t("toolsUI.billing.invoices.toastDownloaded").replace("{invoice}", inv.invoiceNumber))}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </motion.tr>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {total > pageSize && (
          <div className="border-t border-border/60 px-4 py-3">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPage={setPage}
              onPageSize={setPageSize}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const INVOICE_EXPORT_COLUMNS: ExportColumn<Invoice>[] = [
  { label: "Invoice", value: (r) => r.invoiceNumber },
  { label: "Period start", value: (r) => r.periodStart },
  { label: "Period end", value: (r) => r.periodEnd },
  { label: "Calls", value: (r) => r.totalCalls },
  { label: "Revenue", value: (r) => Number(r.totalRevenue.toFixed(2)) },
  { label: "Payout", value: (r) => Number(r.totalPayout.toFixed(2)) },
  { label: "Amount", value: (r) => Number(r.totalAmount.toFixed(2)) },
  { label: "Status", value: (r) => r.status ?? "open" },
];
