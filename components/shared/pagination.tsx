"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/hooks/use-translation";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  onPageSize?: (n: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
  pageSizeOptions = [25, 50, 100, 250],
  className,
}: Props) {
  const { t } = useTranslation();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(0, page), pageCount - 1);
  const from = total === 0 ? 0 : safePage * pageSize + 1;
  const to = Math.min(total, (safePage + 1) * pageSize);

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      <p className="text-[11px] font-mono text-muted-foreground">
        {t("sharedUI.pagination.showingTemplate")
          .replace("{from}", formatNumber(from))
          .replace("{to}", formatNumber(to))
          .replace("{total}", formatNumber(total))}
      </p>

      <div className="flex items-center gap-2">
        {onPageSize && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="hidden sm:inline">{t("sharedUI.pagination.perPage")}</span>
            <Select value={pageSize.toString()} onValueChange={(v) => onPageSize(parseInt(v, 10))}>
              <SelectTrigger size="sm" className="h-8 w-20 font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((n) => (
                  <SelectItem key={n} value={n.toString()}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => onPage(Math.max(0, safePage - 1))}
          disabled={safePage === 0}
          aria-label={t("sharedUI.pagination.previousPage")}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="font-mono text-[11px] text-muted-foreground">
          {safePage + 1} / {pageCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => onPage(Math.min(pageCount - 1, safePage + 1))}
          disabled={safePage >= pageCount - 1}
          aria-label={t("sharedUI.pagination.nextPage")}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
