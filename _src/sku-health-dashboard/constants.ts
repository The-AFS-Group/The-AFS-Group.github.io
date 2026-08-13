import type { StockStatus } from './types';

/** Gym and Fitness approved palette — see the gaf-design-system skill. */
export const GAF = {
  orange: '#F26422',
  orangeHover: '#D85418',
  orangeSoft: '#FDE9DD',
  orange300: '#F8A373',
  orange700: '#B34213',
  black: '#000000',
  white: '#FFFFFF',
  greyDark: '#424242',
  greyPale: '#F0F0F0',
  grey200: '#E2E2E2',
  grey300: '#C9C9C9',
  grey400: '#A0A0A0',
  grey500: '#717171',
  grey600: '#555555',
  success: '#2E8B4A',
  successSoft: '#E7F3EB',
  warning: '#D99100',
  warningSoft: '#FAF1DA',
  danger: '#C23B22',
  dangerSoft: '#F8E3DE',
  info: '#2F6BAF',
  infoSoft: '#E4EEF8',
};

/**
 * Status colours are semantic, not decorative: red means lost sales, blue means
 * capital sitting still. Orange stays reserved for the "look here" accent.
 */
export const STATUS_STYLE: Record<
  StockStatus,
  { color: string; soft: string; text: string; blurb: string }
> = {
  Stockout: {
    color: GAF.danger,
    soft: GAF.dangerSoft,
    text: '#8A2A18',
    blurb: 'Selling line with nothing available to sell',
  },
  Critical: {
    color: GAF.warning,
    soft: GAF.warningSoft,
    text: '#8A5C00',
    blurb: 'Under 4 weeks cover — reorder window is now',
  },
  Healthy: {
    color: GAF.success,
    soft: GAF.successSoft,
    text: '#1E5C31',
    blurb: '4 to 16 weeks cover',
  },
  Overstocked: {
    color: GAF.info,
    soft: GAF.infoSoft,
    text: '#1F4877',
    blurb: '16 to 52 weeks cover — capital running slow',
  },
  'Dead Stock': {
    color: GAF.grey500,
    soft: GAF.greyPale,
    text: '#424242',
    blurb: 'Stock on hand with no sales, or over a year of cover',
  },
  Inactive: {
    color: GAF.grey300,
    soft: '#FAFAFA',
    text: '#717171',
    blurb: 'No stock, no orders, no sales this year',
  },
};

export const STATUS_ORDER: StockStatus[] = [
  'Stockout',
  'Critical',
  'Healthy',
  'Overstocked',
  'Dead Stock',
  'Inactive',
];

/** Categorical series colours for non-status charts. */
export const SERIES = [
  GAF.orange,
  GAF.greyDark,
  GAF.info,
  GAF.orange300,
  GAF.grey400,
  GAF.success,
  GAF.warning,
  GAF.grey600,
];

export const BRAND_GROUPS = ['GAF', 'Revel'] as const;
