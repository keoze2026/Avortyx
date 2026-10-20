/**
 * The order Sir asked for on tracking numbers: High Risk first, as one block,
 * then Low Risk; inside each block by the date the number was assigned.
 * A number with no risk set, or not assigned yet, goes last in its block.
 */
export interface RiskOrderable {
  number: string;
  risk?: "low" | "high";
  assignedAt?: number;
}

const RISK_RANK = { high: 0, low: 1 } as const;

export function compareByRiskThenAssigned(
  a: RiskOrderable,
  b: RiskOrderable,
  newestFirst = true,
): number {
  const ra = a.risk ? RISK_RANK[a.risk] : 2;
  const rb = b.risk ? RISK_RANK[b.risk] : 2;
  if (ra !== rb) return ra - rb;
  const da = a.assignedAt;
  const db = b.assignedAt;
  if (da == null && db != null) return 1;
  if (da != null && db == null) return -1;
  if (da != null && db != null && da !== db) return newestFirst ? db - da : da - db;
  return a.number.localeCompare(b.number);
}
