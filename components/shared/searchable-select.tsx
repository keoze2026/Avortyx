"use client";

/**
 * A select you can type into (CH-491, 3 Nov: "search for a certain buyer by
 * typing and not manually scrolling, just like Revo"). Click, type part of a
 * name, Enter or click to pick. Looks like the portal's other selects.
 *
 * `modal` on the popover keeps typing working inside a dialog (New
 * Destination), whose focus trap would otherwise take the cursor back.
 */

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const SEP = " ||| ";

export interface SearchableOption {
  value: string;
  /** What is shown and searched. */
  label: string;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
  size = "default",
  className,
  id,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  size?: "sm" | "default";
  className?: string;
  id?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const picked = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "border-input dark:bg-input/30 dark:hover:bg-input/50 flex items-center justify-between gap-2 rounded-md border bg-transparent px-3 text-[13px] whitespace-nowrap shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
            size === "sm" ? "h-8" : "h-9",
            className,
          )}
        >
          <span className={cn("truncate", !picked && "text-muted-foreground")}>{picked?.label ?? placeholder}</span>
          <ChevronDown className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[14rem] p-0">
        <Command
          // Only the shown name is searched (the id rides along to keep items unique).
          filter={(itemValue, search) =>
            itemValue.split(SEP)[0].toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-[min(60vh,24rem)]">
            <CommandEmpty>{emptyText}</CommandEmpty>
            {options.map((o) => (
              <CommandItem
                key={o.value}
                value={`${o.label}${SEP}${o.value}`}
                onSelect={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                <Check className={cn("size-4", o.value === value ? "opacity-100" : "opacity-0")} />
                <span className="truncate">{o.label}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
