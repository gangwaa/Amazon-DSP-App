export interface DspMetricsRow {
  profile_id: string;
  date: string;
  entity_type: string;
  entity_id: string;
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
  cpm: number;
  ctr: number;
  clicks: number;
  conversions: number;
  conv_rate: number;
}
