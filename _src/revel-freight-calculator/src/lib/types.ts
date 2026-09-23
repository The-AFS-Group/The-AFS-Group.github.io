export type State = 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'NT' | 'TAS' | 'ACT';

export const STATES: State[] = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'NT', 'TAS', 'ACT'];

/** The seven states the Winnings middle-mile matrix covers. ACT is priced as NSW. */
export const MATRIX_STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'NT', 'TAS'] as const;
export type MatrixState = (typeof MATRIX_STATES)[number];

export type SizeClassId = 'small' | 'medium' | 'large' | 'oversized';

export interface Carton {
  code: string;
  widthCm: number;
  depthCm: number;
  heightCm: number;
  weightKg: number;
  /** CBM column as recorded in master data (0 when blank). */
  cbm: number;
}

export type ProductStatus = 'ok' | 'no-cartons' | 'service';

export interface Product {
  sku: string;
  name: string;
  brand: string;
  category: string;
  subCategory: string;
  lifecycle: string;
  isGroup: boolean;
  rrp: number | null;
  /** "Number of Cartons to complete item" as entered in master data. */
  declaredCartons: number;
  cartons: Carton[];
  status: ProductStatus;
  issues: string[];
}

export interface ProductsFile {
  source: string;
  importedAt: string;
  products: Product[];
}

export interface SizeClass {
  id: SizeClassId;
  label: string;
  /** Upper bound of volumetric weight for this class, inclusive (kg). null = no upper bound. */
  maxKg: number | null;
  deliveryMin: number;
  deliveryAdditional: number;
  collectionMin: number;
  collectionAdditional: number;
}

export interface Zone {
  zone: number;
  surchargePct: number;
  label: string;
}

export interface RateCard {
  carrier: string;
  source: string;
  updated: string;
  gstPct: number;
  /** kg per m³ used to turn CBM into volumetric weight. */
  cubicFactor: number;
  sizeClasses: SizeClass[];
  zones: Zone[];
  /** $ per m³, origin → destination. */
  middleMile: Record<MatrixState, Partial<Record<MatrixState, number>>>;
  fuelLevy: {
    pct: number;
    period: string;
    status: string;
    basePrice: number;
    averagePrice: number;
    fuelSharePct: number;
  };
  install: { sauna: number; iceBath: number };
  futileDeliveryPct: number;
  storagePerM3PerDay: number;
  /** Reference only: charges the calculator does not add to a freight quote. */
  otherCharges?: { item: string; price: string; notes: string }[];
  rules: {
    /** 'carton' — every carton is an item. 'product' — each unit is one item sized on its total CBM. */
    chargeBasis: 'carton' | 'product';
    /** 'volumetric' per the rate card, or 'greater' of dead and volumetric weight. */
    sizeBasis: 'volumetric' | 'greater';
    /** 'master' uses each carton's CBM column (dimensions only when it is blank); 'dimensions' uses W×D×H. */
    cbmSource: 'master' | 'dimensions';
    /** 'auto' ships from the closest warehouse, as the website says it does. */
    defaultOrigin: MatrixState | 'auto';
  };
  /** Optional services added on top of freight, per unit, never included automatically. No fuel levy. */
  addOns?: { id: string; label: string; note?: string; amount?: number | null; perUnit?: { sauna: number; iceBath: number } }[];
  /** Warehouses stock ships from (revelsaunas.com.au delivery page). */
  warehouses?: { state: MatrixState; name: string }[];
}

/**
 * [locality, estimated zone 1-5 (0 = unknown), deliverable (0 = PO box / LVR only), state when it differs from the postcode's]
 */
export type Locality = [string, number, 0 | 1] | [string, number, 0 | 1, State];

export interface PostcodesFile {
  source: string;
  method: string;
  postcodes: Record<string, { s: State; l: Locality[] }>;
}

export interface ZoneScheduleFile {
  source: string | null;
  updated: string | null;
  /** postcode → zone, optionally keyed "postcode|SUBURB" for suburb-specific entries. */
  zones: Record<string, number>;
}

export interface WebsiteProduct {
  title: string;
  variant: string;
  type: string;
  price: number;
  compareAt: number | null;
  url: string;
  image: string | null;
  available: boolean;
  /** Weight the store uses for its shipping rates. */
  grams: number;
}

export interface WebsiteFile {
  source: string;
  fetchedAt: string;
  /** Keyed by upper-case SKU. */
  products: Record<string, WebsiteProduct>;
}

export interface DfeRateCard {
  carrier: string;
  source: string;
  updated: string;
  usedWhen: string;
  gstPct: number;
  /** Newest first. The levy in force on a date is the latest row effective on or before it. */
  fuelLevy: { effective: string; pct: number }[];
  /** kg per m³ for chargeable weight. */
  cubicFactor: number;
  cubicFactorNote?: string;
  /** Base freight (basic charge / per kg by zone). null until DFE's rate card is supplied. */
  base: unknown | null;
  itemSurcharges: {
    weight: { aboveKg: number; blockKg: number; perBlock: number; maxPerItem: number; notAboveChargeableKg: number; fuel: boolean };
    oversize: { sumDimsM: number; amount: number; fuel: boolean };
    longLength: { fromM: number; amount: number }[];
    longLengthFuel: boolean;
  };
  options: { id: string; label: string; amount: number; per: string; fuel: boolean }[];
  futile: { firstItem: number; perItemAfter: number; fuel: boolean };
  reference: { group: string; item: string; details: string; fuel: boolean }[];
}
