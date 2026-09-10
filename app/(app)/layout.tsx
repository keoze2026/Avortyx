import type { ReactNode } from "react";

import { AuthGuard } from "@/components/app-shell/auth-guard";
import { NotificationRuntime } from "@/components/app-shell/notification-runtime";
import { OnboardingGate } from "@/components/app-shell/onboarding-gate";
import { AppSidebar } from "@/components/app-shell/sidebar-nav";
import { StoreHydrator } from "@/components/app-shell/store-hydrator";
import { Topbar } from "@/components/app-shell/topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

/**
 * Authenticated app shell — sidebar + topbar + main outlet.
 * Every authenticated page under (app)/ inherits this chrome.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <OnboardingGate>
        {/* h-svh + overflow-hidden locks the shell to exactly the viewport.
            SidebarProvider's own wrapper is only `min-h-svh` — a floor, not
            a ceiling — so if the page's rendered height ever nudges past the
            viewport (routine on mobile as the browser's address bar
            collapses/expands), the *document* becomes a second, independent
            scroll region stacked on top of the inner `overflow-y-auto` div
            below. Two scroll containers fighting produces exactly the
            symptom reported on mobile: the sticky topbar stays pinned while
            the sidebar and content behind it visibly drift as the two
            scrolls fight for the gesture. Capping the wrapper here means
            the inner div is the only element that can ever scroll. */}
        <SidebarProvider className="h-svh overflow-hidden">
          <AppSidebar />
          <SidebarInset className="app-canvas !bg-transparent">
            <Topbar />
            <NotificationRuntime />
            <StoreHydrator />
            {/* `scrollbar-gutter: stable` permanently reserves the scrollbar
                gutter so the layout doesn't shift horizontally when the page
                height crosses the viewport-fit threshold (e.g. Live Monitor
                streaming new cards in / out). Prevents the on/off flicker the
                vertical scrollbar would otherwise cause. */}
            <div className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
              {/* @container/main lets children respond to the actual content-area
                  width (which depends on whether the sidebar is open) instead of
                  the viewport width. Use `@<bp>/main:` utilities on children. */}
              <div className="@container/main mx-auto w-full space-y-8 p-4 sm:p-6 lg:p-8">
                {children}
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </OnboardingGate>
    </AuthGuard>
  );
}
