// src/tabs/meta/columns.ts
// Shared full-column definitions for Meta Campaigns / Ad Sets DataTables.
import { fmtCurrency, fmtInt, fmtPct, fmtRoas, fmtCpc } from "../../lib/format";

type Align = "left" | "right";
interface Col {
  key: string;
  label: string;
  align: Align;
  format?: (v: unknown) => string;
  tooltip?: string;
  sub?: (row: Record<string, unknown>) => string;
}

const cur = (v: unknown) => fmtCurrency(Number(v ?? 0));
const int = (v: unknown) => fmtInt(Number(v ?? 0));
const pct = (v: unknown) => fmtPct(Number(v ?? 0));
const roas = (v: unknown) => fmtRoas(Number(v ?? 0));
// Cost-per metrics keep cents — fmtCurrency rounds $0.45 CPC to "$0".
const cpc = (v: unknown) => fmtCpc(Number(v ?? 0));
const freq = (v: unknown) => Number(v ?? 0).toFixed(2);

export const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_SALES: 'Conversion', CONVERSIONS: 'Conversion', CATALOG_SALES: 'Conversion',
  PRODUCT_CATALOG_SALES: 'Conversion', OUTCOME_LEADS: 'Leads', LEAD_GENERATION: 'Leads',
  OUTCOME_TRAFFIC: 'Traffic', LINK_CLICKS: 'Traffic',
  OUTCOME_AWARENESS: 'Awareness', REACH: 'Awareness', BRAND_AWARENESS: 'Awareness',
  OUTCOME_ENGAGEMENT: 'Engagement', POST_ENGAGEMENT: 'Engagement', VIDEO_VIEWS: 'Engagement',
};

// Metric hover definitions — ported from the reference dashboard's METRIC_TOOLTIPS.
export const METRIC_TOOLTIPS: Record<string, string> = {
  spend: "Total amount spent in the selected window.",
  impressions: "Number of times your ads were shown.",
  reach: "Unique people who saw your ads.",
  clicks: "All clicks on your ads.",
  ctr: "Click-through rate — clicks ÷ impressions.",
  cpc: "Cost per click — spend ÷ clicks. Lower is better.",
  cpm: "Cost per 1,000 impressions. Lower is better.",
  frequency: "Average times each person saw your ads — impressions ÷ reach.",
  outboundClicks: "Clicks that took people OFF Facebook/Instagram to your site.",
  outboundCtr: "Outbound clicks ÷ impressions.",
  landingPageViews: "People who clicked and waited for your page to load.",
  addToCart: "Add-to-cart events attributed to the ads.",
  atcRate: "Add-to-carts ÷ outbound clicks.",
  costPerAtc: "Spend ÷ add-to-carts. Lower is better.",
  conversions: "Purchases attributed to the ads.",
  cpa: "Cost per purchase — spend ÷ conversions. Lower is better.",
  convValue: "Revenue value of attributed purchases.",
  purchaseValue: "Revenue value of attributed purchases.",
  roas: "Return on ad spend — revenue ÷ spend. Directional only: many GAF sales close offline.",
  engagements: "Post engagements (reactions, comments, shares, clicks).",
  engagementRate: "Engagements ÷ impressions.",
};

// Campaigns — full column set per spec (name + objective + metrics incl. frequency).
export const META_CAMPAIGN_COLS: Col[] = [
  { key: "campaign",         label: "Campaign",     align: "left" },
  { key: "objective",        label: "Objective",    align: "left",  format: (v: unknown) => OBJECTIVE_LABELS[String(v ?? '')] ?? String(v ?? '') },
  { key: "spend",            label: "Spend",        align: "right", format: cur,  tooltip: METRIC_TOOLTIPS.spend },
  { key: "impressions",      label: "Impr.",        align: "right", format: int,  tooltip: METRIC_TOOLTIPS.impressions },
  { key: "reach",            label: "Reach",        align: "right", format: int,  tooltip: METRIC_TOOLTIPS.reach },
  { key: "clicks",           label: "Clicks",       align: "right", format: int,  tooltip: METRIC_TOOLTIPS.clicks },
  { key: "ctr",              label: "CTR",          align: "right", format: pct,  tooltip: METRIC_TOOLTIPS.ctr },
  { key: "cpc",              label: "CPC",          align: "right", format: cpc,  tooltip: METRIC_TOOLTIPS.cpc },
  { key: "cpm",              label: "CPM",          align: "right", format: cpc,  tooltip: METRIC_TOOLTIPS.cpm },
  { key: "frequency",        label: "Freq.",        align: "right", format: freq, tooltip: METRIC_TOOLTIPS.frequency },
  { key: "outboundClicks",   label: "Outbound",     align: "right", format: int,  tooltip: METRIC_TOOLTIPS.outboundClicks },
  { key: "outboundCtr",      label: "OB CTR",       align: "right", format: pct,  tooltip: METRIC_TOOLTIPS.outboundCtr },
  { key: "landingPageViews", label: "LPV",          align: "right", format: int,  tooltip: METRIC_TOOLTIPS.landingPageViews },
  { key: "addToCart",        label: "ATC",          align: "right", format: int,  tooltip: METRIC_TOOLTIPS.addToCart },
  { key: "atcRate",          label: "ATC Rate",     align: "right", format: pct,  tooltip: METRIC_TOOLTIPS.atcRate },
  { key: "costPerAtc",       label: "Cost/ATC",     align: "right", format: cpc,  tooltip: METRIC_TOOLTIPS.costPerAtc },
  { key: "conversions",      label: "Conv.",        align: "right", format: int,  tooltip: METRIC_TOOLTIPS.conversions },
  { key: "cpa",              label: "CPA",          align: "right", format: cpc,  tooltip: METRIC_TOOLTIPS.cpa },
  { key: "convValue",        label: "Revenue",      align: "right", format: cur,  tooltip: METRIC_TOOLTIPS.convValue },
  { key: "roas",             label: "ROAS",         align: "right", format: roas, tooltip: METRIC_TOOLTIPS.roas },
];

// Objective pill colours (reference parity: Sales emerald, Traffic blue,
// Awareness purple, Engagement amber, Leads cyan).
export const OBJECTIVE_BADGE: Record<string, { bg: string; color: string }> = {
  Conversion:  { bg: "#ecfdf5", color: "#059669" },
  Traffic:     { bg: "#eff6ff", color: "#2563eb" },
  Awareness:   { bg: "#f5f3ff", color: "#7c3aed" },
  Engagement:  { bg: "#fffbeb", color: "#d97706" },
  Leads:       { bg: "#ecfeff", color: "#0891b2" },
};

// Ad Sets — full column set per spec, campaign as its own column (reference parity).
export const META_ADSET_COLS: Col[] = [
  { key: "adset",            label: "Ad Set",       align: "left" },
  { key: "campaign",         label: "Campaign",     align: "left" },
  { key: "spend",            label: "Spend",        align: "right", format: cur,  tooltip: METRIC_TOOLTIPS.spend },
  { key: "impressions",      label: "Impr.",        align: "right", format: int,  tooltip: METRIC_TOOLTIPS.impressions },
  { key: "reach",            label: "Reach",        align: "right", format: int,  tooltip: METRIC_TOOLTIPS.reach },
  { key: "clicks",           label: "Clicks",       align: "right", format: int,  tooltip: METRIC_TOOLTIPS.clicks },
  { key: "ctr",              label: "CTR",          align: "right", format: pct,  tooltip: METRIC_TOOLTIPS.ctr },
  { key: "cpc",              label: "CPC",          align: "right", format: cpc,  tooltip: METRIC_TOOLTIPS.cpc },
  { key: "cpm",              label: "CPM",          align: "right", format: cpc,  tooltip: METRIC_TOOLTIPS.cpm },
  { key: "frequency",        label: "Freq.",        align: "right", format: freq, tooltip: METRIC_TOOLTIPS.frequency },
  { key: "outboundClicks",   label: "Outbound",     align: "right", format: int,  tooltip: METRIC_TOOLTIPS.outboundClicks },
  { key: "outboundCtr",      label: "OB CTR",       align: "right", format: pct,  tooltip: METRIC_TOOLTIPS.outboundCtr },
  { key: "landingPageViews", label: "LPV",          align: "right", format: int,  tooltip: METRIC_TOOLTIPS.landingPageViews },
  { key: "addToCart",        label: "ATC",          align: "right", format: int,  tooltip: METRIC_TOOLTIPS.addToCart },
  { key: "atcRate",          label: "ATC Rate",     align: "right", format: pct,  tooltip: METRIC_TOOLTIPS.atcRate },
  { key: "costPerAtc",       label: "Cost/ATC",     align: "right", format: cpc,  tooltip: METRIC_TOOLTIPS.costPerAtc },
  { key: "conversions",      label: "Conv.",        align: "right", format: int,  tooltip: METRIC_TOOLTIPS.conversions },
  { key: "cpa",              label: "CPA",          align: "right", format: cpc,  tooltip: METRIC_TOOLTIPS.cpa },
  { key: "roas",             label: "ROAS",         align: "right", format: roas, tooltip: METRIC_TOOLTIPS.roas },
];

// Breakdown table — dimension + metrics per spec.
// NOTE: breakdown rows carry `purchases`/`purchaseValue` (NOT `conversions`) —
// binding `conversions` here rendered 0 next to real revenue (2026-07-11 audit).
export const META_BREAKDOWN_COLS: Col[] = [
  { key: "segment",          label: "Segment",      align: "left" },
  { key: "spend",            label: "Spend",        align: "right", format: cur,  tooltip: METRIC_TOOLTIPS.spend },
  { key: "impressions",      label: "Impr.",        align: "right", format: int,  tooltip: METRIC_TOOLTIPS.impressions },
  { key: "clicks",           label: "Clicks",       align: "right", format: int,  tooltip: METRIC_TOOLTIPS.clicks },
  { key: "ctr",              label: "CTR",          align: "right", format: pct,  tooltip: METRIC_TOOLTIPS.ctr },
  { key: "cpc",              label: "CPC",          align: "right", format: cpc,  tooltip: METRIC_TOOLTIPS.cpc },
  { key: "cpm",              label: "CPM",          align: "right", format: cpc,  tooltip: METRIC_TOOLTIPS.cpm },
  { key: "outboundClicks",   label: "Outbound",     align: "right", format: int,  tooltip: METRIC_TOOLTIPS.outboundClicks },
  { key: "landingPageViews", label: "LPV",          align: "right", format: int,  tooltip: METRIC_TOOLTIPS.landingPageViews },
  { key: "addToCart",        label: "ATC",          align: "right", format: int,  tooltip: METRIC_TOOLTIPS.addToCart },
  { key: "costPerAtc",       label: "Cost/ATC",     align: "right", format: cpc,  tooltip: METRIC_TOOLTIPS.costPerAtc },
  { key: "purchases",        label: "Conv.",        align: "right", format: int,  tooltip: METRIC_TOOLTIPS.conversions },
  { key: "cpa",              label: "CPA",          align: "right", format: cpc,  tooltip: METRIC_TOOLTIPS.cpa },
  { key: "purchaseValue",    label: "Revenue",      align: "right", format: cur,  tooltip: METRIC_TOOLTIPS.purchaseValue },
  { key: "roas",             label: "ROAS",         align: "right", format: roas, tooltip: METRIC_TOOLTIPS.roas },
];
