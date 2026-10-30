/**
 * Sidebar icons from Sir's reference picture that lucide has no match for.
 * Drawn on lucide's 24-unit grid with its stroke, so they sit the same size
 * and weight as every other sidebar icon.
 *
 * CH-427 (Sir, 30 Oct: "These two icons are not same"): lucide's Bitcoin is the tilted
 * coin logo and its Newspaper folds on the left with a box and two lines; his
 * picture has an upright ₿ and a page of three lines folded on the right.
 */

import { createLucideIcon } from "lucide-react";

/** Upright ₿: the B on a stem that shows above and below it. */
export const CoinMarketIcon = createLucideIcon("CoinMarket", [
  ["path", { d: "M8 4v16", key: "stem" }],
  ["path", { d: "M8 6h5a3 3 0 0 1 0 6H8", key: "top" }],
  ["path", { d: "M8 12h6a3 3 0 0 1 0 6H8", key: "bottom" }],
]);

/** A page of three lines, its fold on the right. */
export const DailyNewsIcon = createLucideIcon("DailyNews", [
  ["path", { d: "M16 6h3a1 1 0 0 1 1 1v11a2 2 0 0 1-4 0V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v12a3 3 0 0 0 3 3h11", key: "page" }],
  ["path", { d: "M7 8h6M7 12h6M7 16h4", key: "lines" }],
]);
