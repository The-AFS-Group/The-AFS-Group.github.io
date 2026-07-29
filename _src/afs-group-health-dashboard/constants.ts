import { BusinessUnitConfig, KPIDefinition } from './types';

export const BRAND_COLORS = {
  navy: '#0E2A44',
  offWhite: '#EDEAE3',
  orange: '#F26422',
  grey: '#424242',
  darkGrey: '#232323',
};

export const BUSINESS_UNITS: Record<string, BusinessUnitConfig> = {
  GAF: {
    id: 'GAF',
    name: 'Gym and Fitness',
    logo: 'https://cdn.shopify.com/s/files/1/1950/1891/files/GAF-Icon.png?v=1738497572',
    color: BRAND_COLORS.navy,
  },
  FORCE: {
    id: 'FORCE',
    name: 'Force USA',
    logo: 'https://cdn.shopify.com/s/files/1/0592/0446/8889/files/ForceUSA-Logo-Icon-Black.png?v=1738698624', 
    color: '#000000', 
  },
  REVEL: {
    id: 'REVEL',
    name: 'Revel Recovery',
    logo: 'https://cdn.shopify.com/s/files/1/1950/1891/files/REVEL_Logo-Icon.png?v=1769576830',
    color: '#000000', 
  },
};

export const KPI_CONFIGS: KPIDefinition[] = [
  // GAF
  {
    id: 'gaf-aov',
    label: 'Average Order Value (SO\'s Created)',
    targetDescription: '4% Growth on FY25 Baseline ($1454)',
    unit: 'currency',
    businessUnit: 'GAF',
    dataUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRPpWKad4OJFAb7-SYb9-yz8sj1q8UpbcSoYTVwLUWvaqPsEMUunpZTlfiDdiLkqlRm3g9Y0_Zqxkqt/pub?gid=176781390&single=true&output=csv',
    sourceLink: 'https://docs.google.com/spreadsheets/d/1nE1DXvDAg3ozg4iSoSFL4YXAk9oVo2Etbtz9qJZ4U1g/edit?gid=176781390#gid=176781390',
    thresholdConfig: {
      operator: '>',
      value: 1512.16, // 1454 * 1.04
      type: 'static',
    }
  },
  {
    id: 'gaf-calls',
    label: 'Weekly Inbound Calls',
    targetDescription: '> 40 / week',
    unit: 'number',
    businessUnit: 'GAF',
    dataUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSPMy3bijFQbGlpduZQRbvd56NXgmWkNDWmHprMbQOb6fDsh8SC9oy893UHnaweW7SuCnWkVvZHMnYA/pub?gid=417630756&single=true&output=csv',
    sourceLink: 'https://docs.google.com/spreadsheets/d/17an6G2laOVcI8t0nDNsRkiax-ihYUIUqGtviyfaX9Gw/edit?gid=674713582#gid=674713582',
    tooltip: "The filter logic strictly validates calls based on phone number, a minimum duration of 45 seconds, and at least 4 conversation exchanges, then applies a keyword blacklist followed by a final AI verification layer to ensure only true sales inquiries are analyzed.",
    thresholdConfig: {
      operator: '>',
      value: 40,
      type: 'static',
    }
  },
  // FORCE
  {
    id: 'force-aio',
    label: 'AIO Trainers on Floor (UK/EU)',
    targetDescription: '> 100 active locations',
    unit: 'number',
    businessUnit: 'FORCE',
    dataUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSPMy3bijFQbGlpduZQRbvd56NXgmWkNDWmHprMbQOb6fDsh8SC9oy893UHnaweW7SuCnWkVvZHMnYA/pub?gid=1048417198&single=true&output=csv',
    sourceLink: 'https://docs.google.com/spreadsheets/d/1fHUXMDuxFKG3pktlbwFfsmQ4JuEis5GA_Aa-WLQEAEU/edit?pli=1&gid=2034170474#gid=2034170474',
    visualizationType: 'progress', // Custom visualization for this KPI
    thresholdConfig: {
      operator: '>',
      value: 100, // Target is 100 based on spec
      type: 'static',
    }
  },
  // REVEL
  {
    id: 'revel-shipping',
    label: 'Shipping Recovery Rate',
    targetDescription: '> 90%',
    unit: 'percent',
    businessUnit: 'REVEL',
    dataUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRoi-4K1YP0v-rUgbOI8vg_Iyfh-gmXDArjAWGwg3FBvhh6BfV-UauXkBSwUfS4LId4MYLFWL2i4Sgz/pub?gid=949589139&single=true&output=csv',
    sourceLink: 'https://docs.google.com/spreadsheets/d/1YGymlROOHtIDLAldqsujKR4nIdHXJcn3Kr8cSwXe71c/edit?gid=949589139#gid=949589139',
    thresholdConfig: {
      operator: '>',
      value: 90,
      type: 'static',
    }
  },
  {
    id: 'revel-credit',
    label: 'Credit Memos',
    targetDescription: 'Minimize',
    unit: 'currency',
    businessUnit: 'REVEL',
    dataUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQjaWaELMLtVfRVqqxcBjt8a3O8eOfprExR9iFBHVti9Zi1I-FD0qVrW-8xqy1zfqRXztfVAdfyS0JW/pub?gid=1995533469&single=true&output=csv',
    sourceLink: 'https://docs.google.com/spreadsheets/d/1VZ5m0q4h6bWS86CZBHaEVunEqAW6AtsZCDm4222GJ3g/edit?gid=1995533469#gid=1995533469',
    thresholdConfig: {
      operator: '<',
      value: 0,
      type: 'static',
    }
  },
  {
    id: 'revel-gp',
    label: 'Gross Profit Margin (SO\'s Created)',
    targetDescription: '> 40%',
    unit: 'percent',
    businessUnit: 'REVEL',
    dataUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSPMy3bijFQbGlpduZQRbvd56NXgmWkNDWmHprMbQOb6fDsh8SC9oy893UHnaweW7SuCnWkVvZHMnYA/pub?gid=8506835&single=true&output=csv',
    sourceLink: 'https://docs.google.com/spreadsheets/d/17an6G2laOVcI8t0nDNsRkiax-ihYUIUqGtviyfaX9Gw/edit?gid=1965640519#gid=1965640519',
    thresholdConfig: {
      operator: '>',
      value: 40,
      type: 'static',
    }
  },
  {
    id: 'revel-discount',
    label: 'Sales Discounts (SO\'s Created)',
    targetDescription: '< 10%',
    unit: 'percent',
    businessUnit: 'REVEL',
    dataUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSPMy3bijFQbGlpduZQRbvd56NXgmWkNDWmHprMbQOb6fDsh8SC9oy893UHnaweW7SuCnWkVvZHMnYA/pub?gid=1188743751&single=true&output=csv',
    sourceLink: 'https://docs.google.com/spreadsheets/d/17an6G2laOVcI8t0nDNsRkiax-ihYUIUqGtviyfaX9Gw/edit?gid=1965640519#gid=1965640519',
    thresholdConfig: {
      operator: '<',
      value: 10,
      type: 'static',
    }
  },
];

// Technical Brief: "EU + UK" Whitelist
export const EU_COUNTRIES = [
  "AT", "Austria",
  "BE", "Belgium",
  "BG", "Bulgaria",
  "HR", "Croatia",
  "CY", "Cyprus",
  "CZ", "Czechia", "Czech Republic",
  "DK", "Denmark",
  "EE", "Estonia",
  "FI", "Finland",
  "FR", "France",
  "DE", "Germany",
  "GR", "Greece",
  "HU", "Hungary",
  "IE", "Ireland",
  "IT", "Italy",
  "LV", "Latvia",
  "LT", "Lithuania",
  "LU", "Luxembourg",
  "MT", "Malta",
  "NL", "Netherlands",
  "PL", "Poland",
  "PT", "Portugal",
  "RO", "Romania",
  "SK", "Slovakia",
  "SI", "Slovenia",
  "ES", "Spain",
  "SE", "Sweden",
  "GB", "United Kingdom", "UK",
  "NO", "Norway",
  "CH", "Switzerland"
];