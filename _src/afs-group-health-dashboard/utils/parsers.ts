import Papa from 'papaparse';
import { CSVRow, FilterOptions, KPIResult, KPIDefinition } from '../types';
import { KPI_CONFIGS, EU_COUNTRIES } from '../constants';
import { isValid, isSameMonth, endOfMonth } from 'date-fns';

// Generic fetcher
export const fetchCSV = async (url: string): Promise<CSVRow[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      transformHeader: (header, index) => {
        return header.trim() === '' ? '__empty_' + index : header;
      },
      complete: (results) => {
        resolve(results.data as CSVRow[]);
      },
      error: (err) => {
        reject(err);
      }
    });
  });
};

// --- Specific Parsers ---

// Helper to parse dates with Australian format preference (dd/MM/yyyy)
const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;

  // 1. Explicitly handle Australian/European format: dd/MM/yyyy or d/M/yyyy
  // Regex matches 1/2/2026 or 01/02/2026 or 1-2-2026
  if (/^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$/.test(dateStr)) {
      const parts = dateStr.split(/[\/-]/);
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // JS months 0-11
      let year = parseInt(parts[2], 10);
      
      // Handle 2 digit years (e.g. 24 -> 2024)
      if (year < 100) year += 2000; 

      const d = new Date(year, month, day);
      if (isValid(d)) return d;
  }
  
  // 2. Handle MMM-yy format (e.g., Jan-25, Dec-24) specially
  // Default JS Date parsing often interprets "Jan-25" as "Jan 25th, [Current Year]" which breaks history.
  // We want "Jan-25" -> "Jan 1st, 2025".
  if (/^[a-zA-Z]{3}-\d{2}$/.test(dateStr)) {
      const [monthStr, yearStr] = dateStr.split('-');
      const year = parseInt(yearStr, 10) + 2000;
      const d = new Date(`${monthStr} 1, ${year}`);
      if (isValid(d)) return d;
  }
  
  // 3. Try ISO format (yyyy-MM-dd)
  const iso = new Date(dateStr);
  if (isValid(iso) && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) return iso;

  // 4. Try standard formats like "Dec 2024", "Jan 1, 2026"
  if (/[a-zA-Z]/.test(dateStr)) {
    const d = new Date(dateStr);
    if (isValid(d)) return d;
  }

  // 5. Fallback for others
  if (isValid(iso)) return iso;
  
  return null;
};

const cleanNumber = (val: any): number => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;
  // Remove currency symbols, commas, percentages
  const clean = String(val).replace(/[$,%]/g, '');
  return parseFloat(clean) || 0;
};

// Helper for Simple Aggregation
// Groups data by Month and returns the Average Value for that month
const getMonthlyAverages = (data: { date: Date; val: number }[], cutoffDate: Date) => {
    const map = new Map<number, { sum: number; count: number }>();

    data.forEach(item => {
        if (item.date <= cutoffDate) {
            // Normalize to 1st of month for grouping
            const key = new Date(item.date.getFullYear(), item.date.getMonth(), 1).getTime();
            const curr = map.get(key) || { sum: 0, count: 0 };
            map.set(key, { sum: curr.sum + item.val, count: curr.count + 1 });
        }
    });

    return Array.from(map.entries())
        .map(([ts, { sum, count }]) => ({
            dateObj: new Date(ts),
            date: new Date(ts).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
            value: count > 0 ? sum / count : 0
        }))
        .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
};

// Helper for Weighted Aggregation
// Uses Numerator ($) and Denominator ($) to calculate true %
const getMonthlyWeightedAverages = (data: { date: Date; num: number; denom: number }[], cutoffDate: Date) => {
    const map = new Map<number, { numSum: number; denomSum: number }>();

    data.forEach(item => {
        if (item.date <= cutoffDate) {
            // Normalize to 1st of month for grouping
            const key = new Date(item.date.getFullYear(), item.date.getMonth(), 1).getTime();
            const curr = map.get(key) || { numSum: 0, denomSum: 0 };
            map.set(key, { numSum: curr.numSum + item.num, denomSum: curr.denomSum + item.denom });
        }
    });

    return Array.from(map.entries())
        .map(([ts, { numSum, denomSum }]) => ({
            dateObj: new Date(ts),
            date: new Date(ts).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
            value: denomSum !== 0 ? (numSum / denomSum) * 100 : 0
        }))
        .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
};

// 1. GAF AOV Logic
// CSV: Date | COUNTA of Doc | SUM of Amount | AOV
// Logic: Sum(Revenue) / Sum(Orders) per month
export const processGafAov = (data: CSVRow[], filter: FilterOptions, config: KPIDefinition): KPIResult => {
  if (data.length === 0) {
    return {
      kpiId: config.id,
      currentValue: 0,
      targetValue: config.thresholdConfig.value,
      status: 'danger',
      history: [],
      note: 'No data'
    };
  }

  const targetDate = new Date(filter.year, filter.month, 1);
  const cutoffDate = endOfMonth(targetDate);
  
  // Robust Column Detection
  const headers = Object.keys(data[0]);
  
  // Find Date Column (contains 'date' or fallback to first column)
  const dateCol = headers.find(h => h.toLowerCase().includes('date')) || headers[0];
  
  // Find Orders Column (contains 'count' and 'doc', or 'orders')
  const ordersCol = headers.find(h => 
    (h.toLowerCase().includes('count') && h.toLowerCase().includes('doc')) || 
    h.toLowerCase() === 'orders' || 
    h.toLowerCase() === 'count' ||
    h.toLowerCase().includes('total orders')
  ) || 'COUNTA of Doc';

  // Find Revenue Column (contains 'sum' and 'amount', or 'revenue')
  const revenueCol = headers.find(h => 
    (h.toLowerCase().includes('sum') && h.toLowerCase().includes('amount')) || 
    h.toLowerCase() === 'revenue' || 
    h.toLowerCase() === 'amount' ||
    h.toLowerCase().includes('total revenue')
  ) || 'SUM of Amount';

  // Parse rows
  const processed = data.map(row => {
    const dateStr = row[dateCol] || Object.values(row)[0]; 
    
    // Extract Orders and Revenue
    const orders = cleanNumber(row[ordersCol]);
    const revenue = cleanNumber(row[revenueCol]);

    return {
      date: parseDate(dateStr),
      orders,
      revenue
    };
  }).filter(item => item.date !== null) as { date: Date; orders: number; revenue: number }[];

  // Aggregate by month
  const map = new Map<number, { revenue: number; orders: number }>();

  processed.forEach(item => {
      if (item.date <= cutoffDate) {
          // Normalize to 1st of month for grouping
          const key = new Date(item.date.getFullYear(), item.date.getMonth(), 1).getTime();
          const curr = map.get(key) || { revenue: 0, orders: 0 };
          map.set(key, { revenue: curr.revenue + item.revenue, orders: curr.orders + item.orders });
      }
  });

  const monthlyData = Array.from(map.entries())
      .map(([ts, { revenue, orders }]) => ({
          dateObj: new Date(ts),
          date: new Date(ts).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
          value: orders > 0 ? revenue / orders : 0
      }))
      .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

  // Find target month value from aggregated list
  const match = monthlyData.find(p => isSameMonth(p.dateObj, targetDate));
  const currentValue = match ? match.value : 0;
  
  // History (last 6 months)
  const history = monthlyData.slice(-6).map(p => ({ date: p.date, value: p.value }));

  return {
    kpiId: config.id,
    currentValue,
    targetValue: config.thresholdConfig.value,
    status: currentValue >= config.thresholdConfig.value ? 'success' : 'danger',
    history,
    note: currentValue === 0 ? 'No data' : undefined
  };
};

// 2. GAF Calls Logic
// CSV: DATE | Inbound Calls
// Logic: Average weekly calls for the selected month
export const processGafCalls = (data: CSVRow[], filter: FilterOptions, config: KPIDefinition): KPIResult => {
  const targetDate = new Date(filter.year, filter.month, 1);
  const cutoffDate = endOfMonth(targetDate);
  
  const relevantRows = data.filter(row => {
    const d = parseDate(row['DATE'] || row['Date']);
    return d && isSameMonth(d, targetDate);
  });

  // Sum total calls in month
  const totalCalls = relevantRows.reduce((acc, row) => acc + cleanNumber(row['Inbound Calls']), 0);
  
  // Estimate average weekly calls (divide by 4.33 for a month)
  const avgWeekly = relevantRows.length > 0 ? totalCalls / 4.33 : 0;

  // History calculation (monthly averages for last 6 months)
  const historyMap = new Map<number, number>();
  
  data.forEach(row => {
    const d = parseDate(row['DATE'] || row['Date']);
    if (d && d <= cutoffDate) {
      // Normalize to 1st of month for grouping
      const key = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      historyMap.set(key, (historyMap.get(key) || 0) + cleanNumber(row['Inbound Calls']));
    }
  });

  const history = Array.from(historyMap.entries())
    .sort((a, b) => a[0] - b[0]) // Sort by timestamp
    .slice(-6)
    .map(([ts, val]) => {
      const d = new Date(ts);
      return {
        date: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
        value: val / 4.33 // Convert to weekly avg
      };
    });

  return {
    kpiId: config.id,
    currentValue: avgWeekly,
    targetValue: config.thresholdConfig.value,
    status: avgWeekly >= config.thresholdConfig.value ? 'success' : 'danger',
    history
  };
};

// 3. Force AIO Logic
export const processForceAio = (data: CSVRow[], filter: FilterOptions, config: KPIDefinition): KPIResult => {
  if (data.length === 0) {
    return {
        kpiId: config.id,
        currentValue: 0,
        targetValue: config.thresholdConfig.value,
        status: 'danger',
        history: [{ date: 'Current', value: 0 }]
    };
  }

  // Step A: Identify Model Columns
  const firstRow = data[0];
  const allHeaders = Object.keys(firstRow);
  const storeKey = allHeaders.find(h => h.trim().toLowerCase() === 'store');
  const countryKey = allHeaders.find(h => h.trim().toLowerCase() === 'country');
  const excludedHeadersLower = ["store", "country", "comments", ""];
  const modelCols = allHeaders.filter(h => {
    const trimmed = h.trim().toLowerCase();
    return !excludedHeadersLower.includes(trimmed);
  });

  let activeStores = 0;

  // Step B: Row Iteration
  data.forEach(row => {
    const storeName = storeKey ? row[storeKey] : '';
    if (!storeName || !storeName.trim()) return; 

    const countryRaw = countryKey ? row[countryKey] : '';
    const country = (countryRaw || '').trim();
    if (!country) return;

    const isEuOrUk = EU_COUNTRIES.some(c => c.toLowerCase() === country.toLowerCase());
    if (!isEuOrUk) return;

    let hasInventory = false;
    for (const col of modelCols) {
        const val = row[col];
        if (val) {
            const trimmed = val.toString().trim();
            if (trimmed === '') continue;
            const parsed = parseInt(trimmed, 10);
            if (!isNaN(parsed)) {
                if (parsed > 0) { hasInventory = true; break; }
            } else {
                if (trimmed.length > 0) { hasInventory = true; break; }
            }
        }
    }
    if (hasInventory) activeStores++;
  });

  return {
    kpiId: config.id,
    currentValue: activeStores,
    targetValue: config.thresholdConfig.value,
    status: activeStores >= config.thresholdConfig.value ? 'success' : 'danger',
    history: [{ date: 'Current', value: activeStores }]
  };
};

// 4. Revel Weighted Logic (GP and Discounts)
export const processRevelWeighted = (data: CSVRow[], filter: FilterOptions, config: KPIDefinition): KPIResult => {
  const targetDate = new Date(filter.year, filter.month, 1);
  const cutoffDate = endOfMonth(targetDate);
  const headers = data.length > 0 ? Object.keys(data[0]) : [];

  // Identify Columns
  let percentCol = '';
  let amountCol = '';
  let revenueCol = ''; // The 'base' or 'denominator' column

  const upperHeaders = headers.map(h => h.toUpperCase());

  if (config.id.includes('gp')) {
    // 1. Percent: GROSS MARGIN (CREATED)
    const pIdx = upperHeaders.findIndex(h => h.includes('MARGIN') && h.includes('CREATED'));
    percentCol = pIdx >= 0 ? headers[pIdx] : '';
    
    // 2. Amount: GROSS PROFIT (CREATED)
    const aIdx = upperHeaders.findIndex(h => h.includes('PROFIT') && h.includes('CREATED'));
    amountCol = aIdx >= 0 ? headers[aIdx] : '';

    // 3. Revenue: TOTAL (CREATED) or REVENUE
    const rIdx = upperHeaders.findIndex(h => h.includes('TOTAL') && h.includes('CREATED'));
    revenueCol = rIdx >= 0 ? headers[rIdx] : '';
    
    // Fallback detection
    if (!percentCol) percentCol = headers.find(h => h.toUpperCase().includes('MARGIN')) || '';
    if (!amountCol) amountCol = headers.find(h => h.toUpperCase().includes('PROFIT')) || '';
  } 
  else if (config.id.includes('discount')) {
    // 1. Percent: SALES DISCOUNT PERCENT (CREATED)
    const pIdx = upperHeaders.findIndex(h => h.includes('DISCOUNT') && h.includes('PERCENT'));
    percentCol = pIdx >= 0 ? headers[pIdx] : '';

    // 2. Amount: SALES DISCOUNT (CREATED) (assumed name based on pattern)
    // Avoid re-selecting the percent column
    const aIdx = upperHeaders.findIndex(h => h.includes('DISCOUNT') && !h.includes('PERCENT'));
    amountCol = aIdx >= 0 ? headers[aIdx] : '';

    // 3. Revenue: TOTAL (CREATED)
    const rIdx = upperHeaders.findIndex(h => h.includes('TOTAL') && h.includes('CREATED'));
    revenueCol = rIdx >= 0 ? headers[rIdx] : '';
  }

  // ** Fallback to Generic if we can't do weighted math **
  // We need at least the Percent column for Generic.
  // We need Amount + (Revenue OR Percent) for Weighted.
  // If we don't have an amount column, we can't weight it.
  if (!amountCol && !revenueCol) {
     return processRevelGeneric(data, filter, config);
  }

  // Parse Rows
  const processed = data.map(row => {
     const dateVal = row['DATE'] || row['Date'] || Object.values(row)[0];
     const date = parseDate(dateVal);
     if (!date) return null;

     let num = 0;
     let denom = 0;

     // Try explicit revenue column first
     if (revenueCol && row[revenueCol]) {
         denom = cleanNumber(row[revenueCol]);
     } 

     // If we have amount and percent, we can back-calculate denominator
     if (amountCol && row[amountCol] && percentCol && row[percentCol]) {
         num = cleanNumber(row[amountCol]);
         const p = cleanNumber(row[percentCol]);
         if (p !== 0 && denom === 0) {
             denom = num / (p / 100);
         }
     } else if (percentCol && row[percentCol] && denom !== 0) {
         // If we have percent and denominator, we can back-calculate amount
         const p = cleanNumber(row[percentCol]);
         num = denom * (p / 100);
     } else if (percentCol && row[percentCol]) {
         // If we only have percent, we can't weight it, so we just use the percent as the numerator and 1 as the denominator
         // This is essentially a simple average, but it allows us to use the same weighted average function
         num = cleanNumber(row[percentCol]);
         denom = 1;
     }

     return { date, num, denom };
  }).filter(p => p !== null) as { date: Date; num: number; denom: number }[];

  // Aggregate
  const monthlyData = getMonthlyWeightedAverages(processed, cutoffDate);
  const match = monthlyData.find(p => isSameMonth(p.dateObj, targetDate));
  const currentValue = match ? match.value : 0;
  const history = monthlyData.slice(-6).map(p => ({ date: p.date, value: p.value }));

  // Status
  let status: 'success' | 'danger' = 'neutral' as any;
  if (config.thresholdConfig.operator === '>') {
    status = currentValue >= config.thresholdConfig.value ? 'success' : 'danger';
  } else {
    status = currentValue <= config.thresholdConfig.value ? 'success' : 'danger';
  }

  return {
    kpiId: config.id,
    currentValue,
    targetValue: config.thresholdConfig.value,
    status,
    history,
    note: currentValue === 0 ? 'No data' : undefined
  };
};

// 4. Revel Generic (Percent/Value by Date) - Simple Average Fallback
export const processRevelGeneric = (data: CSVRow[], filter: FilterOptions, config: KPIDefinition): KPIResult => {
  const targetDate = new Date(filter.year, filter.month, 1);
  const cutoffDate = endOfMonth(targetDate);
  
  const headers = data.length > 0 ? Object.keys(data[0]) : [];
  let valCol = '';
  
  // Mapping column names based on KPI
  if (config.id.includes('shipping')) valCol = 'RECOVERY RATE'; 
  if (config.id.includes('credit')) valCol = 'CREDIT MEMO RATE';
  if (config.id.includes('gp')) valCol = 'GROSS MARGIN (FULFILLED)';
  if (config.id.includes('discount')) valCol = 'SALES DISCOUNT PERCENT (CREATED)'; 

  if (valCol && !headers.includes(valCol)) valCol = '';

  if (!valCol && headers.length > 0) {
    const upperHeaders = headers.map(h => h.toUpperCase());
    if (config.id.includes('shipping')) {
        const idx = upperHeaders.findIndex(h => h.includes('RECOVERY'));
        if (idx >= 0) valCol = headers[idx];
    }
    else if (config.id.includes('credit')) {
        const idx = upperHeaders.findIndex(h => h.includes('CREDIT') && h.includes('MEMO')); 
        if (idx === -1) {
             const idx2 = upperHeaders.findIndex(h => h.includes('CREDIT'));
             if (idx2 >= 0) valCol = headers[idx2];
        } else {
             valCol = headers[idx];
        }
    }
    else if (config.id.includes('gp')) {
        const idx = upperHeaders.findIndex(h => h.includes('MARGIN'));
        if (idx >= 0) valCol = headers[idx];
    }
    else if (config.id.includes('discount')) {
        const idx = upperHeaders.findIndex(h => h.includes('DISCOUNT'));
        if (idx >= 0) valCol = headers[idx];
    }
  }

  // Parse all rows first
  const processed = data.map(row => {
    const dateVal = row['DATE'] || row['Date'] || Object.values(row)[0];
    return {
      date: parseDate(dateVal),
      val: cleanNumber(row[valCol])
    };
  }).filter(p => p.date !== null) as { date: Date; val: number }[];

  // Aggregate daily data into monthly averages
  const monthlyData = getMonthlyAverages(processed, cutoffDate);

  const match = monthlyData.find(p => isSameMonth(p.dateObj, targetDate));
  const currentValue = match ? match.value : 0;

  const history = monthlyData.slice(-6).map(p => ({ date: p.date, value: p.value }));

  // Status calculation
  let status: 'success' | 'danger' = 'neutral' as any;
  if (config.thresholdConfig.operator === '>') {
    status = currentValue >= config.thresholdConfig.value ? 'success' : 'danger';
  } else {
    status = currentValue <= config.thresholdConfig.value ? 'success' : 'danger';
  }

  return {
    kpiId: config.id,
    currentValue,
    targetValue: config.thresholdConfig.value,
    status,
    history,
    note: currentValue === 0 ? 'No data' : undefined
  };
};

// 5. Revel Shipping Logic (Monthly Data)
export const processRevelShipping = (data: CSVRow[], filter: FilterOptions, config: KPIDefinition): KPIResult => {
  const targetDate = new Date(filter.year, filter.month, 1);
  
  const headers = data.length > 0 ? Object.keys(data[0]) : [];
  const revCol = headers.find(h => h.trim().toLowerCase() === 'shipping revenue') || 'Shipping Revenue';
  const expCol = headers.find(h => h.trim().toLowerCase() === 'shipping expenses') || 'Shipping Expenses';
  const recCol = headers.find(h => h.trim().toLowerCase() === 'shipping recovery') || 'Shipping Recovery';
  
  const processed = data.map(row => {
    const monthStr = row['Month'] || Object.values(row)[0];
    const date = parseDate(monthStr);
    if (!date) return null;
    
    return {
      dateObj: date,
      date: date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
      value: cleanNumber(row[recCol] || row['RECOVERY RATE'] || '0'),
      metadata: {
        revenue: cleanNumber(row[revCol] || '0'),
        expenses: cleanNumber(row[expCol] || '0')
      }
    };
  }).filter(p => p !== null) as { dateObj: Date; date: string; value: number; metadata: any }[];

  processed.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

  const historyData = processed.filter(p => p.dateObj <= targetDate);
  const match = historyData.find(p => isSameMonth(p.dateObj, targetDate));
  const currentValue = match ? match.value : 0;
  
  const history = historyData.slice(-6).map(p => ({ date: p.date, value: p.value, metadata: p.metadata }));

  let status: 'success' | 'danger' = 'neutral' as any;
  if (config.thresholdConfig.operator === '>') {
    status = currentValue >= config.thresholdConfig.value ? 'success' : 'danger';
  } else {
    status = currentValue <= config.thresholdConfig.value ? 'success' : 'danger';
  }

  return {
    kpiId: config.id,
    currentValue,
    targetValue: config.thresholdConfig.value,
    status,
    history,
    note: currentValue === 0 ? 'No data' : undefined
  };
};

// 6. Revel Credit Memos Logic (Dynamic Date Columns)
export const processRevelCredit = (data: CSVRow[], filter: FilterOptions, config: KPIDefinition): KPIResult => {
  const targetDate = new Date(filter.year, filter.month, 1);
  const cutoffDate = endOfMonth(targetDate);
  
  if (data.length === 0) {
    return {
      kpiId: config.id,
      currentValue: 0,
      targetValue: config.thresholdConfig.value,
      status: 'danger',
      history: [],
      note: 'No data'
    };
  }

  const headers = Object.keys(data[0]);
  const dateCol = headers.find(h => h.trim().toUpperCase() === 'DATE') || headers[0];
  const valCol = headers.find(h => h.trim().toUpperCase().includes('CREDIT')) || headers[1];

  const processed = data.map(row => {
    const dateStr = row[dateCol];
    const valStr = row[valCol];
    const date = parseDate(dateStr);
    return {
      date,
      val: Math.abs(cleanNumber(valStr))
    };
  }).filter(item => item.date !== null) as { date: Date; val: number }[];

  const map = new Map<number, number>();
  processed.forEach(item => {
    if (item.date <= cutoffDate) {
      const key = new Date(item.date.getFullYear(), item.date.getMonth(), 1).getTime();
      map.set(key, (map.get(key) || 0) + item.val);
    }
  });

  const monthlyData = Array.from(map.entries())
    .map(([ts, sum]) => ({
      dateObj: new Date(ts),
      date: new Date(ts).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
      value: sum
    }))
    .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

  const match = monthlyData.find(p => isSameMonth(p.dateObj, targetDate));
  const currentValue = match ? match.value : 0;

  const history = monthlyData.slice(-6).map(p => ({ date: p.date, value: p.value }));

  let status: 'success' | 'danger' = 'neutral' as any;
  if (config.thresholdConfig.operator === '>') {
    status = currentValue >= config.thresholdConfig.value ? 'success' : 'danger';
  } else {
    status = currentValue <= config.thresholdConfig.value ? 'success' : 'danger';
  }

  return {
    kpiId: config.id,
    currentValue,
    targetValue: config.thresholdConfig.value,
    status,
    history,
    note: currentValue === 0 ? 'No data' : undefined
  };
};

export const processKPI = (kpi: KPIDefinition, data: CSVRow[], filter: FilterOptions): KPIResult => {
  const columns = data.length > 0 ? Object.keys(data[0]).join(',').toUpperCase() : '';

  if (kpi.id === 'gaf-aov') return processGafAov(data, filter, kpi);
  if (kpi.id === 'gaf-calls') return processGafCalls(data, filter, kpi);
  if (kpi.id === 'force-aio') return processForceAio(data, filter, kpi);
  if (kpi.id === 'revel-shipping') return processRevelShipping(data, filter, kpi);
  if (kpi.id === 'revel-credit') return processRevelCredit(data, filter, kpi);

  if (kpi.businessUnit === 'REVEL') {
    if (columns.includes('COUNTRY') && !columns.includes('DATE')) {
       return {
        kpiId: kpi.id,
        currentValue: 0,
        targetValue: kpi.thresholdConfig.value,
        status: 'danger',
        history: [],
        note: 'Invalid Data Source'
       };
    }
    
    // Route GP and Discount to Weighted Logic
    if (kpi.id === 'revel-gp' || kpi.id === 'revel-discount') {
        return processRevelWeighted(data, filter, kpi);
    }

    return processRevelGeneric(data, filter, kpi);
  }

  return {
    kpiId: kpi.id,
    currentValue: 0,
    targetValue: 0,
    status: 'neutral',
    history: []
  };
};