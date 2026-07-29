export interface KPIDefinition {
  id: string;
  label: string;
  targetDescription: string;
  unit: 'currency' | 'percent' | 'number' | 'ratio';
  dataUrl: string;
  businessUnit: 'GAF' | 'FORCE' | 'REVEL';
  visualizationType?: 'sparkline' | 'progress'; // Add visualization type
  tooltip?: string; // Add optional info tooltip text
  sourceLink?: string; // Add optional link to source data
  thresholdConfig: {
    operator: '>' | '<';
    value: number;
    // Some targets are dynamic (e.g. 4% growth), calculated at runtime
    type: 'static' | 'dynamic'; 
    baseline?: number;
  };
}

export interface KPIResult {
  kpiId: string;
  currentValue: number;
  targetValue: number;
  status: 'success' | 'danger' | 'warning' | 'neutral';
  history: { date: string; value: number; metadata?: Record<string, any> }[];
  note?: string;
}

export interface BusinessUnitConfig {
  id: 'GAF' | 'FORCE' | 'REVEL';
  name: string;
  logo: string;
  color: string;
}

// CSV Row Types (Loose typing as CSVs vary)
export type CSVRow = Record<string, string>;

export interface FilterOptions {
  month: number; // 0-11
  year: number;
}