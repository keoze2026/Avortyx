"use client";

import * as React from "react";
import { MotionConfig } from "framer-motion";

import { AccentProvider } from "./accent-provider";
import { DemoModeGuard } from "./demo-mode-guard";
import { LocaleProvider } from "./locale-provider";
import { ThemeProvider } from "./theme-provider";
import { QueryProvider } from "./query-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

/**
 * Single composition point for all client-side providers.
 * The order matters — theme outermost so toasts/popovers see the right palette.
 *
 * MotionConfig reducedMotion="user" makes every framer-motion component below
 * respect the OS-level prefers-reduced-motion setting — transforms collapse to
 * their final state, opacity still cross-fades.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <DemoModeGuard>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
        <QueryProvider>
          <TooltipProvider delayDuration={150}>
            <MotionConfig reducedMotion="user">
              <AccentProvider />
              <LocaleProvider />
              {children}
              <Toaster richColors closeButton />
            </MotionConfig>
          </TooltipProvider>
        </QueryProvider>
      </ThemeProvider>
    </DemoModeGuard>
  );
}
