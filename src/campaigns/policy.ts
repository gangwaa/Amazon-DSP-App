export interface PolicyCheckResult {
  allowed: boolean;
  reason?: string;
}

const BUDGET_CEILING = 1_000_000;
const FREQ_CAP_MAX = 100;

export function checkCampaignBudget(budget: number): PolicyCheckResult {
  if (budget <= 0) return { allowed: false, reason: "Budget must be positive" };
  if (budget > BUDGET_CEILING) return { allowed: false, reason: `Budget exceeds ceiling ${BUDGET_CEILING}` };
  return { allowed: true };
}

export function checkFrequencyCap(cap: number): PolicyCheckResult {
  if (cap < 0) return { allowed: false, reason: "Frequency cap cannot be negative" };
  if (cap > FREQ_CAP_MAX) return { allowed: false, reason: `Frequency cap exceeds max ${FREQ_CAP_MAX}` };
  return { allowed: true };
}

export function checkNamingConvention(name: string): PolicyCheckResult {
  if (!name || name.length < 3) return { allowed: false, reason: "Name too short" };
  if (name.length > 128) return { allowed: false, reason: "Name too long" };
  if (!/^[a-zA-Z0-9 _-]+$/.test(name)) return { allowed: false, reason: "Name contains invalid characters" };
  return { allowed: true };
}
