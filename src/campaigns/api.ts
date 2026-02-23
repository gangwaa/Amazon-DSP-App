import { adsRequest } from "../ads/client.js";
import { checkCampaignBudget, checkFrequencyCap, checkNamingConvention } from "./policy.js";

export interface CreateOrderParams {
  name: string;
  budget?: number;
}

export interface CreateLineItemParams {
  orderId: string;
  name: string;
  budget?: number;
  frequencyCap?: number;
}

export async function createOrder(
  tokenId: string,
  profileId: string,
  params: CreateOrderParams
): Promise<{ orderId: string }> {
  const nameCheck = checkNamingConvention(params.name);
  if (!nameCheck.allowed) throw new Error(nameCheck.reason);
  if (params.budget !== undefined) {
    const budgetCheck = checkCampaignBudget(params.budget);
    if (!budgetCheck.allowed) throw new Error(budgetCheck.reason);
  }

  const res = await adsRequest<{ orderId: string }>({
    tokenId,
    profileId,
    method: "POST",
    path: "/dsp/v1/orders",
    body: {
      name: params.name,
      budget: params.budget,
    },
  });
  return res;
}

export async function createLineItem(
  tokenId: string,
  profileId: string,
  params: CreateLineItemParams
): Promise<{ lineItemId: string }> {
  const nameCheck = checkNamingConvention(params.name);
  if (!nameCheck.allowed) throw new Error(nameCheck.reason);
  if (params.budget !== undefined) {
    const budgetCheck = checkCampaignBudget(params.budget);
    if (!budgetCheck.allowed) throw new Error(budgetCheck.reason);
  }
  if (params.frequencyCap !== undefined) {
    const freqCheck = checkFrequencyCap(params.frequencyCap);
    if (!freqCheck.allowed) throw new Error(freqCheck.reason);
  }

  const res = await adsRequest<{ lineItemId: string }>({
    tokenId,
    profileId,
    method: "POST",
    path: "/dsp/v1/lineItems",
    body: {
      orderId: params.orderId,
      name: params.name,
      budget: params.budget,
      frequencyCap: params.frequencyCap,
    },
  });
  return res;
}
