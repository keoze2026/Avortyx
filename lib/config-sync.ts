"use client";

/**
 * CH-542: caps, lines and buyers changed by anyone show on every screen.
 *
 * Camp team, 4 Nov: "when you set a buyer's cap I don't have to refresh
 * Destinations for it to reflect ... when one member sets a buyer's cap, I
 * have to refresh so that it can reflect on my side."
 *
 * The server pushes "config.changed" (no details) on the live connection
 * when a buyer, buyer cap, destination line, campaign routed line, campaign
 * cap or publisher cap is saved or deleted (backend CH-542). Then the
 * Destinations (list and header figures), Buyers and Campaigns data already
 * loaded in this tab are reloaded quietly - the rows stay on screen until the
 * new figures arrive. Data a page never loaded is not fetched.
 *
 * Changes within REFRESH_MS of each other are merged into one reload.
 */
import { CONFIG_CHANGED, onReportChanged } from "@/lib/report-events";
import { useBuyersStore } from "@/lib/store/buyers-store";
import { useCampaignsStore } from "@/lib/store/campaigns-store";
import { useDestinationsStore } from "@/lib/store/destinations-store";

const REFRESH_MS = 600;

let timer: ReturnType<typeof setTimeout> | undefined;
let waitingForTab = false;

function reload(): void {
  timer = undefined;
  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    // A hidden tab catches up once, when it is looked at again.
    if (!waitingForTab) {
      waitingForTab = true;
      document.addEventListener("visibilitychange", onVisible);
    }
    return;
  }
  const destinations = useDestinationsStore.getState();
  if (destinations.hydrated) {
    void destinations.fetch();
    void destinations.fetchStats();
  }
  const buyers = useBuyersStore.getState();
  if (buyers.hydrated) void buyers.fetch();
  const campaigns = useCampaignsStore.getState();
  if (campaigns.hydrated) void campaigns.fetch();
}

function onVisible(): void {
  if (document.visibilityState !== "visible") return;
  waitingForTab = false;
  document.removeEventListener("visibilitychange", onVisible);
  reload();
}

/** Start reloading settings on every pushed change. Returns the stop function. */
export function startConfigSync(): () => void {
  const stop = onReportChanged((events) => {
    if (!events.has(CONFIG_CHANGED) || timer) return;
    timer = setTimeout(reload, REFRESH_MS);
  });
  return () => {
    stop();
    if (timer) clearTimeout(timer);
    timer = undefined;
    if (waitingForTab && typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisible);
    waitingForTab = false;
  };
}
