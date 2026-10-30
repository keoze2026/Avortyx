"use client";

import type * as React from "react";

import { cn } from "@/lib/utils";

/** A card's title in Sir's design: an icon tile, the title, one line under it. */
export function SectionTitle({
  icon: Icon,
  title,
  hint,
  className,
}: {
  icon: React.ElementType;
  title: string;
  hint: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-3 px-5 pb-3 pt-5", className)}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}
