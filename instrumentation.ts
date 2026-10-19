/**
 * Keep Daily News and Coin Market warm on the server.
 *
 * Their routes answer from a cache held in memory, so the only slow request
 * is the first one after the server (re)starts or has been idle: that one
 * waits on thirteen news feeds or on CoinGecko. This asks for each of them
 * a few seconds after the server starts, and again every few minutes, so a
 * person clicking never lands on a cold cache.
 *
 * It calls the server's own address, so it works the same on a VPS or in a
 * container. Where the host does not keep a long-running process (serverless),
 * the timers simply never fire and nothing changes.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const base = `http://127.0.0.1:${process.env.PORT ?? "3000"}`;
  const paths = [
    "/api/daily-news",
    "/api/tokens?page=1&perPage=250",
    "/api/news?limit=24",
  ];

  const warm = () => {
    for (const path of paths) {
      fetch(base + path, { cache: "no-store", signal: AbortSignal.timeout(20_000) }).catch(() => {
        // Not up yet or upstream down: the next round tries again.
      });
    }
  };

  // Let the server finish starting before the first round.
  setTimeout(warm, 5_000).unref?.();
  // Inside every freshness window the routes use, so a batch never goes stale.
  setInterval(warm, 4 * 60 * 1000).unref?.();
}
