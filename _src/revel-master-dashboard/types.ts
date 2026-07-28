
export interface CallData {
  call_id: string;
  date: Date;
  direction: string;
  sentiment: string;
  agent: string;
  job: string;
  barriers: string[];
  motivations: string[];
  products: string[];
  competitor: string[];
  customer_segment: string;
  equipment_location: string;
  trigger_event_primary: string;
  trigger_event_secondary: string;
  missing_information_critical: string;
  content_improvement_opportunity: string;
  recording_url: string;
  should_analyze: string | boolean;
  filter_reason?: string;
  readiness_score?: string | number;
  sentiment_label?: string;
  call_datetime_iso?: string;
  job_functional?: string;
  job_emotional?: string;
  job_social?: string;
  barrier_primary?: string;
  barrier_secondary?: string;
  barrier_tertiary?: string;
  motivation_primary?: string;
  motivation_secondary?: string;
  motivation_tertiary?: string;
  products_mentioned_specific?: string;
  competitors_mentioned?: string;
  rapport_quality?: string;
  customer_satisfaction_apparent?: string;
  needs_discovery_quality?: string;
  product_matching_quality?: string;
  objection_handling_quality?: string;
  closing_effectiveness?: string;
  space_details?: string;
  space_constraint_level?: string;
  budget_mentioned?: string | boolean;
  job_functional_theme?: string;
  job_emotional_theme?: string;
  job_social_theme?: string;
  [key: string]: any;
}

export interface SubTheme {
  name: string;
  count: number;
  jobs: { name: string; count: number }[];
}

export interface ProcessedTheme {
  name: string;
  count: number;
  percentage: string;
  subThemes: SubTheme[];
}

export interface SalesRepPerformance {
  name: string;
  totalCalls: number;
  rapport: string[];
  satisfaction: string[];
  needsDiscovery: string[];
  productMatching: string[];
  objectionHandling: string[];
  closingEffectiveness: string[];
  hasJob: number;
  hasMotivation: number;
  hasSpace: number;
  hasSegment: number;
  hasBudget: number;
  mostCommonRapport: string;
  mostCommonSatisfaction: string;
  mostCommonNeedsDiscovery: string;
  mostCommonProductMatching: string;
  mostCommonObjectionHandling: string;
  mostCommonClosingEffectiveness: string;
  dataRichness: {
    job: string;
    motivation: string;
    space: string;
    segment: string;
    budget: string;
  };
  overallDataRichness: string;
}

// Sales Dashboard Types
export interface BrandConfig {
  [key: string]: {
    colors: { accent: string; gradient: string };
    currencySymbol: string;
    targetMargin: number;
  };
}

export interface DayData {
  date: string;
  fullDate?: string;
  grossProfitCreated?: number;
  grossMarginCreated?: number;
  grossProfitFulfilled?: number;
  grossMarginFulfilled?: number;
  salesDiscountFulfilled?: number;
  sessions?: number;
  abandonedCarts?: number;
  adSpend?: number;
  inboundSalesCalls?: number;
  outboundSalesCalls?: number;
}

export interface DayBudget {
  fullDate?: string;
  grossProfitCreatedBudget: number;
  grossProfitFulfilledBudget: number;
  targetSessions: number;
}

export interface InstagramPost {
  thumbnailUrl: string;
  permalink: string;
  caption: string;
  totalInteractions: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  reach: number;
}

export interface PeriodStats {
  grossProfitCreated: number;
  grossProfitFulfilled: number;
  sessions: number;
  abandonedCarts: number;
  adSpend: number;
  inboundSalesCalls: number;
  outboundSalesCalls: number;
}

export interface BrandPeriodStats {
  GAF: PeriodStats;
  REVEL: PeriodStats;
}

export interface BrandData {
  GAF: DayData[];
  REVEL: DayData[];
}

export interface BrandBudget {
  GAF: DayBudget[];
  REVEL: DayBudget[];
}

export interface BrandInstagram {
  GAF: InstagramPost[];
  REVEL: InstagramPost[];
}

// Product Insights Types
export interface ProductPerformance {
  sku: string;
  name: string;
  exclusionList: boolean;
  estRevenue30d: number;
  gpPerVisit30d: number;
  qtyPurchased30d: number;
  gpPerVisit3m: number;
  qtyPurchased3m: number;
  inventory: number;
  daysUntilSoldOut: number;
  enoughStockRunRate: string;
  preOrderInventory: number;
  nextEta: string;
  websitePreorderDate: string;
  pageViews30d: number;
  pageViews3m: number;
  productType: string;
  url: string;
  rrp: number;
  currentPriceIncGst: number;
  currentPriceLessGst: number;
  costPriceExcGst: number;
  gpPercent: number;
  vendor: string;
  publishedDate: string;
  discontinued: boolean;
  lowestCompetitorPrice: string;
  
  // Calculated/Legacy fields for compatibility
  title: string; 
  grossProfit: number; // 30d GP total approx
  dailySales: number;
  stockStatus?: string;
  gpPerVisit?: number;
  pageViews?: number;
}

export interface ProductTrend {
  title: string;
  sku: string;
  gpCurrent7Day: number;
  gpPrevious7Day: number;
  variance: number;
}

export interface SubCategoryProduct {
  name: string;
  revenue: number;
  gp: number;
  qty: number;
}

export interface SubCategoryInsight {
  name: string;
  gp: number;
  shareOfTotal: number;
  products: SubCategoryProduct[];
}

export interface CategoryInsights {
  cardio: {
    currentGP: number;
    previousGP: number;
    currentShare: number;
    previousShare: number;
    subCategories: SubCategoryInsight[];
  };
  totalGP: number;
}

export interface ProductInsightsData {
  performance: ProductPerformance[];
  trends: ProductTrend[];
  categoryInsights?: CategoryInsights;
}

// BHAG Types
export interface BhagData {
  shippingRecovery: { date: string; rate: number; revenue: number; expenses: number }[];
  installRecovery: { date: string; rate: number; revenue: number; expenses: number }[];
  creditMemos: { date: string; rate: number }[];
  gp: { date: string; amount: number; margin: number }[];
  salesDiscount: { date: string; rate: number }[];
}
