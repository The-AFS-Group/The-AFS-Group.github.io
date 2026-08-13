export type StockStatus =
  | 'Stockout'
  | 'Critical'
  | 'Healthy'
  | 'Overstocked'
  | 'Dead Stock'
  | 'Inactive';

export interface Sku {
  brandGroup: 'GAF' | 'Revel';
  sku: string;
  desc: string;
  brand: string;
  category: string;
  subCategory: string;
  /** ABC / Non-stocked / Obsolete. GAF only — Revel exports don't carry one. */
  abc: string;
  cover: number;
  onHand: number;
  onOrder: number;
  committed: number;
  available: number;
  backOrdered: number;
  unitsMTD: number;
  revMTD: number;
  unitsYTD: number;
  revYTD: number;
  gp: number | null;
  ros: number;
  eta: string | null;
  orderQty: number;
  allocated: number;
  po: string | null;
  gmroi: number | null;
  status: StockStatus;
}

export interface SkuHealthData {
  refreshedAt: string;
  calendarWeek: number;
  weeksElapsed: number;
  skus: Sku[];
}
