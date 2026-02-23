import { adsRequest } from "../ads/client.js";

export interface QuickActionExecution {
  executionId: string;
  status: string;
}

export async function executeQuickAction(
  tokenId: string,
  profileId: string,
  actionId: string
): Promise<QuickActionExecution> {
  const res = await adsRequest<QuickActionExecution>({
    tokenId,
    profileId,
    method: "POST",
    path: `/dsp/v1/quickactions/${actionId}/executions`,
  });
  return res;
}
