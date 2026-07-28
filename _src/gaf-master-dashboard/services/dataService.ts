
import { BrandData, BrandBudget, BrandInstagram, DayData, DayBudget, InstagramPost, ProductPerformance, ProductTrend, ProductInsightsData, CategoryInsights, SubCategoryInsight, SubCategoryProduct, ProductDailyStat, BHAGData, AOVData, InboundCallData, LeadData } from "../types";

console.log("🔄 FORCE UPDATE: Data Service Loaded (BHAG & Critical Numbers)");

const URLS = {
  GAF: {
    main: "https://docs.google.com/spreadsheets/d/e/2PACX-1vT72MxE6-ziV7qfKCkHXatwJC47qjSAm0Fv0553yd09v3b0fLo-9QI3VZ-ehF_qjpaDNdd9jrYwDbU6/pub?gid=0&single=true&output=csv",
    ig: "https://docs.google.com/spreadsheets/d/e/2PACX-1vT72MxE6-ziV7qfKCkHXatwJC47qjSAm0Fv0553yd09v3b0fLo-9QI3VZ-ehF_qjpaDNdd9jrYwDbU6/pub?gid=413441331&single=true&output=csv",
  },
  REVEL: {
    main: "https://docs.google.com/spreadsheets/d/e/2PACX-1vT72MxE6-ziV7qfKCkHXatwJC47qjSAm0Fv0553yd09v3b0fLo-9QI3VZ-ehF_qjpaDNdd9jrYwDbU6/pub?gid=1965640519&single=true&output=csv",
    ig: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSCib2uLbRE8z-rjgZsvm2SccX8Fqafi28wm-kFCJXxLHZHB_lqL2EG023AtCW7Txj-uyD8PSq1Zm4s/pub?gid=844588718&single=true&output=csv",
  },
  PRODUCTS: {
    rolling30: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTl42G3Hklnv03D9xWAClSSIsOhPNAJ5PEXUvvDR5WJuBb7iHJlo9Re1ky3iXEOehbBm73FOJo0rQTq/pub?gid=132632060&single=true&output=csv",
    trends7day: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTl42G3Hklnv03D9xWAClSSIsOhPNAJ5PEXUvvDR5WJuBb7iHJlo9Re1ky3iXEOehbBm73FOJo0rQTq/pub?gid=1444127791&single=true&output=csv"
  },
  BHAG: {
    aov: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRPpWKad4OJFAb7-SYb9-yz8sj1q8UpbcSoYTVwLUWvaqPsEMUunpZTlfiDdiLkqlRm3g9Y0_Zqxkqt/pub?gid=176781390&single=true&output=csv",
    inbound: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSPMy3bijFQbGlpduZQRbvd56NXgmWkNDWmHprMbQOb6fDsh8SC9oy893UHnaweW7SuCnWkVvZHMnYA/pub?gid=417630756&single=true&output=csv"
  },
  LEADS: {
    main: "https://docs.google.com/spreadsheets/d/e/2PACX-1vS_V9cff0zX8Qj7ZmbQP9Yp6O5QLP9oY9PIijTuGdhQzM8pMuLhWshm-m6TqB1Yb3uoaTPfXlovtkgf/pub?gid=2139548749&single=true&output=csv"
  },
  ETS: {
    main: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRPpWKad4OJFAb7-SYb9-yz8sj1q8UpbcSoYTVwLUWvaqPsEMUunpZTlfiDdiLkqlRm3g9Y0_Zqxkqt/pub?gid=88121376&single=true&output=csv"
  }
};

// Robust CSV Parser that handles quoted fields, newlines, and mixed delimiters correctly
const parseCSVRaw = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '"') {
      if (inQuotes && next === '"') {
        // Escaped quote: "" inside quoted field -> "
        field += '"';
        i++; // skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push(field);
      field = "";
    } else if ((c === '\n' || c === '\r') && !inQuotes) {
      // Handle CRLF or LF or CR
      if (c === '\r' && next === '\n') i++; // Skip \n if we have \r\n
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }

  // Flush last field/row
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
};

// Helper to manually parse CSV lines respecting quotes (used by Main Data parser)
const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

// Helper to clean currency strings
const cleanNumber = (str: string | undefined): string => {
  if (!str) return "0";
  return str.replace(/[$,%\s\u200E\u200F]/g, "").trim();
};

// Helper to check if a local midnight date is today or in the future in Adelaide time
const isTodayOrFutureInAdelaide = (date: Date): boolean => {
  const now = new Date();
  const adelaideTimeStr = now.toLocaleString("en-US", { timeZone: "Australia/Adelaide" });
  const adelaideTime = new Date(adelaideTimeStr);
  const adelaideDate = new Date(adelaideTime.getFullYear(), adelaideTime.getMonth(), adelaideTime.getDate());
  return date.getTime() >= adelaideDate.getTime();
};

const parseSafeDate = (dateStr: string | undefined): Date | null => {
    if (!dateStr) return null;
    const cleanStr = dateStr.trim();
    if (cleanStr.includes('-')) {
        const parts = cleanStr.split(' ')[0].split('-');
        if (parts.length === 3) {
            return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        }
    }
    if (cleanStr.includes('/')) {
        const parts = cleanStr.split(' ')[0].split('/');
        if (parts.length === 3) {
            let year = parseInt(parts[2]);
            if (year < 100) year += 2000;
            return new Date(year, parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
    }
    const fallback = new Date(cleanStr);
    return isNaN(fallback.getTime()) ? null : fallback;
};

const parseMainData = (csvText: string, brandType: string): { data: DayData[], budgetData: DayBudget[] } => {
  const lines = csvText.split("\n");
  // Removed filtering for current month to support historical view
  
  const data: DayData[] = [];
  const budgetData: DayBudget[] = [];

  for (let i = 0; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    if (cells[0]?.trim().toUpperCase() === "DATE") {
      for (let j = i + 1; j < lines.length; j++) {
        const dataCells = parseCSVLine(lines[j]);
        const dateStr = dataCells[0]?.trim();
        if (!dateStr) continue;

        const rowDate = parseSafeDate(dateStr);
        if (!rowDate) continue;

        // Store all data, let the UI filter
        const grossProfitCreated = parseFloat(cleanNumber(dataCells[1])) || 0;
        const grossMarginCreated = parseFloat(cleanNumber(dataCells[2])) || 0;
        const grossProfitCreatedBudget = parseFloat(cleanNumber(dataCells[3])) || 0;
        const grossProfitFulfilled = parseFloat(cleanNumber(dataCells[4])) || 0;
        const grossMarginFulfilled = parseFloat(cleanNumber(dataCells[5])) || 0;
        const grossProfitFulfilledBudget = parseFloat(cleanNumber(dataCells[6])) || 0;
        const sessions = parseInt(cleanNumber(dataCells[7])) || 0;
        const targetSessions = parseInt(cleanNumber(dataCells[8])) || 0;
        const abandonedCarts = parseInt(cleanNumber(dataCells[9])) || 0;
        const adSpend = parseFloat(cleanNumber(dataCells[10])) || 0;
        const inboundSalesCalls = parseInt(cleanNumber(dataCells[11])) || 0;
        const outboundSalesCalls = parseInt(cleanNumber(dataCells[12])) || 0;
        const salesDiscountFulfilled = parseFloat(cleanNumber(dataCells[13])) || 0;

        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const formattedDate = `${monthNames[rowDate.getMonth()]} ${rowDate.getDate()}`;

        budgetData.push({ 
            grossProfitCreatedBudget, 
            grossProfitFulfilledBudget, 
            targetSessions,
            date: formattedDate,
            fullDate: rowDate
        });

        if (!isTodayOrFutureInAdelaide(rowDate)) {
          data.push({
              date: formattedDate,
              fullDate: rowDate,
              grossProfitCreated,
              grossMarginCreated,
              grossProfitFulfilled,
              grossMarginFulfilled,
              salesDiscountFulfilled,
              sessions,
              abandonedCarts,
              adSpend,
              inboundSalesCalls,
              outboundSalesCalls,
          });
        }
      }
      break;
    }
  }
  return { data, budgetData };
};

const parseIgData = (csvText: string, brandType: string): InstagramPost[] => {
  if (!csvText) return [];

  const rawRows = parseCSVRaw(csvText);

  let headerIndex = -1;
  for (let i = 0; i < Math.min(20, rawRows.length); i++) {
    const rowStr = rawRows[i].join(" ").toLowerCase();
    if (rowStr.includes("caption") && (rowStr.includes("media thumbnail url") || rowStr.includes("permalink"))) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    headerIndex = rawRows.findIndex(r => r.some(c => c.trim() === "Caption"));
  }

  if (headerIndex === -1) {
      return [];
  }

  const headers = rawRows[headerIndex].map(h => h.trim());
  const dataRows = rawRows.slice(headerIndex + 1);

  const posts: InstagramPost[] = [];
  const now = new Date();
  const cutoffDate = new Date();
  cutoffDate.setDate(now.getDate() - 30);

  // Precompute header indices for O(1) lookup
  const headerMap = new Map<string, number>();
  headers.forEach((h, i) => {
      headerMap.set(h.toLowerCase(), i);
  });

  const getIdx = (...keys: string[]): number => {
      for (const key of keys) {
          const idx = headerMap.get(key.toLowerCase());
          if (idx !== undefined) return idx;
      }
      return -1;
  };

  const idxDate = getIdx("publish date", "date");
  const idxCaption = getIdx("caption");
  const idxProductType = getIdx("media product type");
  const idxMediaType = getIdx("media type");
  const idxThumb = getIdx("media thumbnail url", "thumbnail url", "media url", "image url", "picture");
  const idxComments = getIdx("comments");
  const idxLikes = getIdx("likes");
  const idxPermalink = getIdx("permalink", "link");
  const idxReach = getIdx("reach");
  const idxShares = getIdx("shares");
  const idxTotalInteractions = getIdx("total interactions");
  const idxViews = getIdx("views", "impressions");

  dataRows.forEach(rowArr => {
    const getVal = (idx: number) => (idx !== -1 && rowArr[idx]) ? rowArr[idx].trim() : "";

    const dateStr = getVal(idxDate); 
    const rowDate = parseSafeDate(dateStr);

    if (rowDate) {
        if (rowDate < cutoffDate) {
            return;
        }
    } else {
        if (getVal(idxCaption)) {
             // Skip
        }
        return; 
    }

    const productType = getVal(idxProductType).toUpperCase();
    const mediaType = getVal(idxMediaType).toUpperCase();
    const typeCombined = productType + " " + mediaType;

    if (typeCombined.includes("REEL") || typeCombined.includes("VIDEO")) {
       posts.push({
         caption: getVal(idxCaption),
         comments: parseInt(cleanNumber(getVal(idxComments))) || 0,
         likes: parseInt(cleanNumber(getVal(idxLikes))) || 0,
         thumbnailUrl: getVal(idxThumb),
         permalink: getVal(idxPermalink),
         reach: parseInt(cleanNumber(getVal(idxReach))) || 0,
         shares: parseInt(cleanNumber(getVal(idxShares))) || 0,
         totalInteractions: parseInt(cleanNumber(getVal(idxTotalInteractions))) || 0,
         views: parseInt(cleanNumber(getVal(idxViews))) || 0,
       });
    }
  });

  return posts.sort((a, b) => b.totalInteractions - a.totalInteractions).slice(0, 5);
};

// --- PRODUCT INSIGHTS PARSERS ---

const parseProductPerformance = (csvText: string): ProductPerformance[] => {
  const lines = csvText.split("\n");
  const data: ProductPerformance[] = [];
  
  let headerIndex = -1;
  let headers: string[] = [];
  
  // 1. Identify Header Row
  for(let i=0; i<Math.min(50, lines.length); i++) {
      const line = parseCSVLine(lines[i]).map(c => c.toUpperCase().trim());
      // Check for a few key columns to identify the header
      if (line.includes("SKU") && line.includes("NAME") && line.includes("GP / VISIT LAST 30 DAYS")) {
          headerIndex = i;
          headers = line;
          break;
      }
  }

  if (headerIndex === -1) {
      console.error("Could not find Product Performance header row");
      return [];
  }

  // 2. Helper to get index with Exact Match priority
  const getIdx = (patterns: string[]) => {
    const uppercasedPatterns = patterns.map(p => p.toUpperCase());
    const exactIndex = headers.findIndex(h => uppercasedPatterns.includes(h));
    if (exactIndex !== -1) return exactIndex;
    return headers.findIndex(h => uppercasedPatterns.some(p => h.includes(p)));
  };

  // 3. Precise Column Mapping using Uppercase Headers
  const idxSku = getIdx(["SKU"]);
  const idxName = getIdx(["NAME"]);
  const idxExclusion = getIdx(["EXLUSION LIST", "EXCLUSION"]);
  const idxGpVisit30 = getIdx(["GP / VISIT LAST 30 DAYS"]);
  
  const idxQty30 = headers.indexOf("QTY PURCHASED LAST 30 DAYS");
  
  const idxGpVisit3m = headers.indexOf("GP / VISIT LAST 3 MONTHS"); 
  const idxQty3m = headers.indexOf("QTY PURCHASED LAST 3 MONTHS"); 
  
  const idxInventory = getIdx(["INVENTORY"]);
  const idxDaysSoldOut = headers.indexOf("DAYS UNTIL SOLD OUT") !== -1 ? headers.indexOf("DAYS UNTIL SOLD OUT") : getIdx(["DAYS UNTIL SOLD OUT"]);
  const idxStockRunRate = getIdx(["ENOUGH STOCK? (RUN RATE)"]);
  const idxPreOrderInv = getIdx(["PREORDER INVENTORY"]);
  const idxNextEta = getIdx(["NEXT ETA"]);
  const idxWebPreDate = getIdx(["WEBSITE PREORDER DATE"]);
  
  const idxPageViews30 = headers.indexOf("PAGE VIEWS LAST 30 DAYS");
  const idxPageViews3m = headers.indexOf("PAGE VIEWS LAST 3 MONTHS");
  
  const idxProductType = getIdx(["PRODUCT TYPE"]);
  const idxUrl = getIdx(["URL", "PAGE URL"]);
  const idxRrp = getIdx(["RRP"]);
  const idxPriceIncGst = headers.indexOf("CURRENT PRICE (INC. GST)");
  const idxPriceLessGst = getIdx(["CURRENT PRICE LESS GST", "CURRENT PRICE (EX. GST)"]);
  const idxCost = getIdx(["COST PRICE (EXC. GST)", "COST PRICE"]);
  const idxGpPercent = headers.indexOf("GP (%)");
  
  const idxVendor = getIdx(["VENDOR"]);
  const idxPubDate = getIdx(["PUBLISHED DATE"]);
  const idxDiscontinued = getIdx(["DISCONTINUED?", "DISCONTINUED"]);
  const idxLowestComp = getIdx(["LOWEST COMPETITOR PRICE"]);

  for (let i = headerIndex + 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      if (row.length < 5) continue; // Skip empty rows

      const name = row[idxName] || "Unknown Product";
      const sku = row[idxSku] || "";
      const priceLessGst = parseFloat(cleanNumber(row[idxPriceLessGst])) || 0;
      const cost = parseFloat(cleanNumber(row[idxCost])) || 0;
      const qty30 = parseFloat(cleanNumber(row[idxQty30])) || 0;
      const priceIncGst = parseFloat(cleanNumber(row[idxPriceIncGst])) || 0;
      
      const grossProfit = (priceLessGst - cost) * qty30;
      
      // Calculate Est Revenue 30 Days = Price (Inc GST) * Qty 30 Days
      const estRevenue30d = priceIncGst * qty30;

      // Fix GP %: check if value > 1 (likely percentage point like 52.4) and convert to decimal
      let gpPercent = parseFloat(cleanNumber(row[idxGpPercent])) || 0;
      if (Math.abs(gpPercent) > 1.0) {
          gpPercent = gpPercent / 100;
      }

      data.push({
          sku,
          name,
          title: name,
          grossProfit, 
          estRevenue30d,
          dailySales: qty30 / 30,
          
          exclusionList: (row[idxExclusion] || "").toUpperCase() === "TRUE",
          gpPerVisit30d: parseFloat(cleanNumber(row[idxGpVisit30])) || 0,
          qtyPurchased30d: qty30,
          gpPerVisit3m: parseFloat(cleanNumber(row[idxGpVisit3m])) || 0,
          qtyPurchased3m: parseFloat(cleanNumber(row[idxQty3m])) || 0,
          inventory: parseFloat(cleanNumber(row[idxInventory])) || 0,
          daysUntilSoldOut: parseFloat(cleanNumber(row[idxDaysSoldOut])) || 0,
          enoughStockRunRate: row[idxStockRunRate] || "",
          preOrderInventory: parseFloat(cleanNumber(row[idxPreOrderInv])) || 0,
          nextEta: row[idxNextEta] || "",
          websitePreorderDate: row[idxWebPreDate] || "",
          pageViews30d: parseFloat(cleanNumber(row[idxPageViews30])) || 0,
          pageViews3m: parseFloat(cleanNumber(row[idxPageViews3m])) || 0,
          productType: row[idxProductType] || "",
          url: row[idxUrl] || "",
          rrp: parseFloat(cleanNumber(row[idxRrp])) || 0,
          currentPriceIncGst: priceIncGst,
          currentPriceLessGst: priceLessGst,
          costPriceExcGst: cost,
          gpPercent: gpPercent,
          vendor: row[idxVendor] || "",
          publishedDate: row[idxPubDate] || "",
          discontinued: (row[idxDiscontinued] || "").toUpperCase() === "TRUE",
          lowestCompetitorPrice: row[idxLowestComp] || "",
          
          stockStatus: (row[idxStockRunRate] || "").toUpperCase(), 
          gpPerVisit: parseFloat(cleanNumber(row[idxGpVisit30])) || 0,
          pageViews: parseFloat(cleanNumber(row[idxPageViews30])) || 0, 
      });
  }
  return data;
};

// Aggregates raw sales rows into trends AND category share
const parseProductTrends = (csvText: string): { trends: ProductTrend[], categoryInsights: CategoryInsights, yesterdayTopProducts: ProductDailyStat[] } => {
  const lines = csvText.split("\n");
  
  let headerIndex = -1;
  let headers: string[] = [];

  // 1. Find Header
  for(let i=0; i<Math.min(50, lines.length); i++) {
      const line = parseCSVLine(lines[i]).map(c => c.toUpperCase());
      if (line.includes("DATE") && (line.includes("NAME") || line.includes("ITEM"))) {
          headerIndex = i;
          headers = line;
          break;
      }
  }

  if (headerIndex === -1) {
      console.warn("⚠️ Could not find header row for Product Trends");
      return { trends: [], categoryInsights: { cardio: { currentGP: 0, previousGP: 0, currentShare: 0, previousShare: 0, subCategories: [] }, totalGP: 0 }, yesterdayTopProducts: [] };
  }

  const getIdx = (patterns: string[]) => headers.findIndex(h => patterns.some(p => h.includes(p)));
  const idxDate = getIdx(["DATE"]);
  const idxName = getIdx(["NAME", "ITEM"]);
  const idxAmount = getIdx(["AMOUNT", "TOTAL"]);
  const idxCost = getIdx(["EST. UNIT COST", "COST", "EST. UNIT SALES"]); // Added "EST. UNIT SALES" to cover COGS/Sales ambiguity
  const idxQty = getIdx(["QUANTITY", "QTY"]);
  const idxCategory = getIdx(["CATEGORY", "PRODUCT TYPE", "TYPE"]); 
  const idxSubCategory = getIdx(["SUB CATEGORY", "SUB-CATEGORY", "SUBCATEGORY", "SUB_CATEGORY"]); 

  const rawRows: { date: Date, name: string, gp: number, category: string, subCategory: string, amount: number, qty: number }[] = [];
  let maxTime = 0;

  for (let i = headerIndex + 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      if (row.length < headers.length) continue;

      const dateStr = row[idxDate];
      if (!dateStr) continue;

      const rowDate = parseSafeDate(dateStr);
      if (!rowDate) continue;
      // Filter out today and future dates in Adelaide time
      if (isTodayOrFutureInAdelaide(rowDate)) continue; 
      
      if (rowDate.getTime() > maxTime) maxTime = rowDate.getTime();

      const name = row[idxName] || "";
      const category = idxCategory !== -1 ? row[idxCategory] : "";
      
      let subCategory = "";
      if (row.length > 11) subCategory = row[11];
      if ((!subCategory || subCategory.trim() === "") && idxSubCategory !== -1) subCategory = row[idxSubCategory];
      
      const amount = parseFloat(cleanNumber(row[idxAmount])) || 0;
      let gp = amount;
      let qty = 0;
      
      if (idxCost !== -1 && idxQty !== -1) {
          const cost = parseFloat(cleanNumber(row[idxCost])) || 0;
          qty = parseFloat(cleanNumber(row[idxQty])) || 0;
          gp = amount - (cost * qty);
      } else if (idxQty !== -1) {
          qty = parseFloat(cleanNumber(row[idxQty])) || 0;
      }

      rawRows.push({ date: rowDate, name, gp, category, subCategory, amount, qty });
  }

  if (maxTime === 0) return { trends: [], categoryInsights: { cardio: { currentGP: 0, previousGP: 0, currentShare: 0, previousShare: 0, subCategories: [] }, totalGP: 0 }, yesterdayTopProducts: [] };
  
  const maxDate = new Date(maxTime);
  maxDate.setHours(0,0,0,0);

  const today = new Date();
  today.setHours(0,0,0,0);

  let targetDate = new Date(maxDate);

  // If the latest date in the dataset matches today's date (client time),
  // we assume the day is not finished and the data is partial.
  // We fallback to the previous day to show a full day's "Yesterday" stats.
  if (maxDate.getTime() >= today.getTime()) {
      targetDate.setDate(targetDate.getDate() - 1);
  }
  
  // Fallback: If maxDate was earlier than today, we keep targetDate = maxDate.
  // This handles the case where data might be stale (e.g. only updated 2 days ago).

  const targetTime = targetDate.getTime();
  
  // --- Calculate Yesterday's Top Products ---
  const yesterdayProductsMap = new Map<string, number>();
  
  rawRows.forEach(row => {
      const rTime = new Date(row.date);
      rTime.setHours(0,0,0,0);
      
      if (rTime.getTime() === targetTime) {
          yesterdayProductsMap.set(row.name, (yesterdayProductsMap.get(row.name) || 0) + row.gp);
      }
  });

  const yesterdayTopProducts = Array.from(yesterdayProductsMap.entries())
      .map(([name, grossProfit]) => ({ name, grossProfit }))
      .sort((a, b) => b.grossProfit - a.grossProfit)
      .slice(0, 10);
  
  // --- Continue Trend Calculation ---

  const currentStart7 = new Date(maxDate);
  currentStart7.setDate(maxDate.getDate() - 6);
  currentStart7.setHours(0,0,0,0);
  
  const prevEnd7 = new Date(currentStart7);
  prevEnd7.setDate(prevEnd7.getDate() - 1);
  prevEnd7.setHours(23,59,59,999);
  
  const prevStart7 = new Date(prevEnd7);
  prevStart7.setDate(prevEnd7.getDate() - 6);
  prevStart7.setHours(0,0,0,0);

  const productMap = new Map<string, { currentGP: number, prevGP: number }>();

  rawRows.forEach(row => {
      if (!productMap.has(row.name)) {
          productMap.set(row.name, { currentGP: 0, prevGP: 0 });
      }
      const entry = productMap.get(row.name)!;

      if (row.date >= currentStart7 && row.date <= maxDate) {
          entry.currentGP += row.gp;
      } else if (row.date >= prevStart7 && row.date <= prevEnd7) {
          entry.prevGP += row.gp;
      }
  });

  const allProducts: ProductTrend[] = [];
  productMap.forEach((val, key) => {
      if (val.currentGP !== 0 || val.prevGP !== 0) {
          allProducts.push({
              title: key,
              sku: "",
              gpCurrent7Day: val.currentGP,
              gpPrevious7Day: val.prevGP,
              variance: val.currentGP - val.prevGP
          });
      }
  });

  const top20Products = allProducts
      .sort((a, b) => (Math.abs(b.gpCurrent7Day) + Math.abs(b.gpPrevious7Day)) - (Math.abs(a.gpCurrent7Day) + Math.abs(a.gpPrevious7Day)))
      .slice(0, 20);

  const d30Start = new Date(maxDate);
  d30Start.setDate(maxDate.getDate() - 30);
  
  const prev30Start = new Date(d30Start);
  prev30Start.setDate(d30Start.getDate() - 30);
  const prev30End = new Date(d30Start);

  let currentTotalGP = 0;
  let currentCardioGP = 0;
  let prevTotalGP = 0;
  let prevCardioGP = 0;

  const isCardio = (cat: string, name: string) => {
     const text = (cat + " " + name).toUpperCase();
     return text.includes("CARDIO") || text.includes("TREADMILL") || text.includes("BIKE") || text.includes("ROWER") || text.includes("ELLIPTICAL") || text.includes("STEPR") || text.includes("SKI");
  }

  const subCatData = new Map<string, { gp: number, products: Map<string, { revenue: number, gp: number, qty: number }> }>();

  rawRows.forEach(row => {
      if (row.date > d30Start && row.date <= maxDate) {
          currentTotalGP += row.gp;
          if (isCardio(row.category, row.name)) {
             currentCardioGP += row.gp;
             let sc = row.subCategory ? row.subCategory.trim() : "Uncategorized";
             if (sc === "" || sc.toUpperCase() === "NULL" || sc.toUpperCase() === "NAN") sc = "Uncategorized";
             
             if (!subCatData.has(sc)) subCatData.set(sc, { gp: 0, products: new Map() });
             const scEntry = subCatData.get(sc)!;
             scEntry.gp += row.gp;

             if (!scEntry.products.has(row.name)) scEntry.products.set(row.name, { revenue: 0, gp: 0, qty: 0 });
             const prodEntry = scEntry.products.get(row.name)!;
             prodEntry.revenue += row.amount;
             prodEntry.gp += row.gp;
             prodEntry.qty += row.qty;
          }
      }
      else if (row.date > prev30Start && row.date <= prev30End) {
          prevTotalGP += row.gp;
          if (isCardio(row.category, row.name)) prevCardioGP += row.gp;
      }
  });

  const subCategories: SubCategoryInsight[] = [];
  subCatData.forEach((data, name) => {
      const products: SubCategoryProduct[] = [];
      data.products.forEach((vals, prodName) => {
          products.push({
              name: prodName,
              revenue: vals.revenue,
              gp: vals.gp,
              qty: vals.qty
          });
      });
      products.sort((a, b) => b.gp - a.gp);

      subCategories.push({
          name: name,
          gp: data.gp,
          shareOfTotal: currentTotalGP > 0 ? (data.gp / currentTotalGP) * 100 : 0,
          products: products
      });
  });
  subCategories.sort((a, b) => b.gp - a.gp);

  const categoryInsights: CategoryInsights = {
      cardio: {
          currentGP: currentCardioGP,
          previousGP: prevCardioGP,
          currentShare: currentTotalGP > 0 ? (currentCardioGP / currentTotalGP) * 100 : 0,
          previousShare: prevTotalGP > 0 ? (prevCardioGP / prevTotalGP) * 100 : 0,
          subCategories: subCategories
      },
      totalGP: currentTotalGP
  };

  return { trends: top20Products, categoryInsights, yesterdayTopProducts };
}

export const fetchSalesData = async (): Promise<{
  data: BrandData;
  budgetData: BrandBudget;
}> => {
  try {
    // Helper to fetch with error logging and caching
    const fetchWithLog = async (url: string, name: string) => {
        try {
            const cacheBusterUrl = `${url}&_t=${Date.now()}`;
            console.log(`Fetching ${name}: ${cacheBusterUrl}`);
            const res = await fetch(cacheBusterUrl, { cache: 'no-store', priority: 'high' } as any);
            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`HTTP error! status: ${res.status}, body: ${errText}`);
            }
            const text = await res.text();
            try { 
                localStorage.setItem(`cache_${name}`, text);
                localStorage.setItem(`cache_${name}_time`, Date.now().toString());
            } catch (e) {}
            return text;
        } catch (e) {
            console.error(`Failed to fetch ${name}:`, e);
            const cached = localStorage.getItem(`cache_${name}`);
            if (cached) return cached;
            throw e;
        }
    };

    // Only fetch GAF Main data
    const gafMain = await fetchWithLog(URLS.GAF.main, "GAF Main");
    
    const gafData = parseMainData(gafMain, "GAF");

    return {
      data: {
        GAF: gafData.data,
        REVEL: [],
      },
      budgetData: {
        GAF: gafData.budgetData,
        REVEL: [],
      },
    };
  } catch (error) {
    console.error("Error fetching sales data:", error);
    return {
      data: { GAF: [], REVEL: [] },
      budgetData: { GAF: [], REVEL: [] },
    };
  }
};

export const getCachedSalesData = (): { data: BrandData; budgetData: BrandBudget } | null => {
    try {
        const cachedMain = localStorage.getItem("cache_GAF Main");
        const cachedTime = localStorage.getItem("cache_GAF Main_time");
        
        if (cachedMain && cachedTime) {
            const age = Date.now() - parseInt(cachedTime, 10);
            // Only use cache if it's less than 15 minutes old
            if (age < 15 * 60 * 1000) {
                const gafData = parseMainData(cachedMain, "GAF");
                return {
                    data: { GAF: gafData.data, REVEL: [] },
                    budgetData: { GAF: gafData.budgetData, REVEL: [] }
                };
            }
        }
    } catch (e) {
        console.error("Error reading cached sales data", e);
    }
    return null;
};

export const fetchInstagramData = async (): Promise<{
  igData: BrandInstagram;
}> => {
  try {
    // Helper to fetch with error logging and caching
    const fetchWithLog = async (url: string, name: string) => {
        try {
            const cacheBusterUrl = `${url}&_t=${Date.now()}`;
            console.log(`Fetching ${name}: ${cacheBusterUrl}`);
            const res = await fetch(cacheBusterUrl, { cache: 'no-store' });
            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`HTTP error! status: ${res.status}, body: ${errText}`);
            }
            const text = await res.text();
            try { 
                localStorage.setItem(`cache_${name}`, text);
                localStorage.setItem(`cache_${name}_time`, Date.now().toString());
            } catch (e) {}
            return text;
        } catch (e) {
            console.error(`Failed to fetch ${name}:`, e);
            const cached = localStorage.getItem(`cache_${name}`);
            if (cached) return cached;
            throw e;
        }
    };

    // Only fetch GAF IG data
    const gafIg = await fetchWithLog(URLS.GAF.ig, "GAF IG");

    return {
      igData: {
        GAF: parseIgData(gafIg, "GAF"),
        REVEL: [],
      },
    };
  } catch (error) {
    console.error("Error fetching instagram data:", error);
    return {
      igData: { GAF: [], REVEL: [] },
    };
  }
};

export const getCachedInstagramData = (): { igData: BrandInstagram } | null => {
    try {
        const cachedIg = localStorage.getItem("cache_GAF IG");
        const cachedTime = localStorage.getItem("cache_GAF IG_time");
        if (cachedIg && cachedTime) {
            const age = Date.now() - parseInt(cachedTime, 10);
            if (age < 15 * 60 * 1000) {
                return {
                    igData: { GAF: parseIgData(cachedIg, "GAF"), REVEL: [] }
                };
            }
        }
    } catch (e) {
        console.error("Error reading cached instagram data", e);
    }
    return null;
};

export const fetchDashboardData = async (): Promise<{
  data: BrandData;
  budgetData: BrandBudget;
  igData: BrandInstagram;
}> => {
    // Kept for backward compatibility if needed, but ideally use separate functions
    const [sales, ig] = await Promise.all([fetchSalesData(), fetchInstagramData()]);
    return {
        ...sales,
        ...ig
    };
};

export const fetchProductInsightsData = async (): Promise<ProductInsightsData> => {
  try {
    const fetchWithLog = async (url: string, name: string) => {
        try {
            const cacheBusterUrl = `${url}&_t=${Date.now()}`;
            console.log(`Fetching ${name}: ${cacheBusterUrl}`);
            const res = await fetch(cacheBusterUrl, { cache: 'no-store' });
            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`HTTP error! status: ${res.status}, body: ${errText}`);
            }
            const text = await res.text();
            try { 
                localStorage.setItem(`cache_${name}`, text);
                localStorage.setItem(`cache_${name}_time`, Date.now().toString());
            } catch (e) {}
            return text;
        } catch (e) {
            console.error(`Failed to fetch ${name}:`, e);
            const cached = localStorage.getItem(`cache_${name}`);
            if (cached) return cached;
            throw e;
        }
    };

    const [perfText, trendsText] = await Promise.all([
      fetchWithLog(URLS.PRODUCTS.rolling30, "Products Rolling30"),
      fetchWithLog(URLS.PRODUCTS.trends7day, "Products Trends7Day"),
    ]);

    const performance = parseProductPerformance(perfText);
    const { trends, categoryInsights, yesterdayTopProducts } = parseProductTrends(trendsText);

    return {
      performance,
      trends,
      categoryInsights,
      yesterdayTopProducts
    };
  } catch (error) {
    console.error("Error fetching product insights:", error);
    return {
      performance: [],
      trends: [],
    };
  }
};

export const getCachedProductInsightsData = (): ProductInsightsData | null => {
    try {
        const perfText = localStorage.getItem("cache_Products Rolling30");
        const trendsText = localStorage.getItem("cache_Products Trends7Day");
        const cachedTimePerf = localStorage.getItem("cache_Products Rolling30_time");
        const cachedTimeTrends = localStorage.getItem("cache_Products Trends7Day_time");
        if (perfText && trendsText && cachedTimePerf && cachedTimeTrends) {
            const agePerf = Date.now() - parseInt(cachedTimePerf, 10);
            const ageTrends = Date.now() - parseInt(cachedTimeTrends, 10);
            if (agePerf < 15 * 60 * 1000 && ageTrends < 15 * 60 * 1000) {
                const performance = parseProductPerformance(perfText);
                const { trends, categoryInsights, yesterdayTopProducts } = parseProductTrends(trendsText);
                return { performance, trends, categoryInsights, yesterdayTopProducts };
            }
        }
    } catch (e) {
        console.error("Error reading cached product insights data", e);
    }
    return null;
};

// --- BHAG PARSERS ---

const parseAOVData = (csvText: string): AOVData[] => {
  const rows = parseCSVRaw(csvText);
  const data: AOVData[] = [];
  
  // Headers: Date, GAF OFFLINE REV, GAF OFFLINE # ORDERS, GAF COMMERCIAL REV, GAF COMMERCIAL # ORDERS, GAF ONLINE REV, GAF ONLINE # ORDERS, TOTAL REVENUE, TOTAL ORDERS, AOV
  // Indices: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 10) continue;

    const dateStr = row[0];
    const revenueStr = row[7];
    const ordersStr = row[8];
    const aovStr = row[9];

    if (dateStr) {
      const date = parseSafeDate(dateStr);

      if (date && !isTodayOrFutureInAdelaide(date)) {
          const orders = parseInt(cleanNumber(ordersStr)) || 0;
          const revenue = parseFloat(cleanNumber(revenueStr)) || 0;
          let aov = parseFloat(cleanNumber(aovStr));

          if (isNaN(aov) && orders > 0) {
            aov = revenue / orders;
          } else if (isNaN(aov)) {
            aov = 0;
          }

          data.push({
            date,
            orders,
            revenue,
            aov
          });
        }
    }
  }
  // Sort by date ascending just in case
  return data.sort((a, b) => a.date.getTime() - b.date.getTime());
};

const parseInboundCallData = (csvText: string): InboundCallData[] => {
  const lines = csvText.split("\n");
  const data: InboundCallData[] = [];
  
  // Headers in Source 2: DATE, Inbound Calls
  
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    if (row.length < 2) continue;

    const dateStr = row[0];
    const callsStr = row[1];

    if (dateStr && callsStr) {
       const calls = parseInt(cleanNumber(callsStr));
       const date = parseSafeDate(dateStr);
       
       if (!isNaN(calls) && date && !isTodayOrFutureInAdelaide(date)) {
         data.push({
           date,
           calls
         });
       }
    }
  }
  return data;
};

export const fetchBHAGData = async (): Promise<BHAGData> => {
  try {
    const [aovText, inboundText] = await Promise.all([
      fetch(`${URLS.BHAG.aov}&_t=${Date.now()}`).then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.text();
      }),
      fetch(`${URLS.BHAG.inbound}&_t=${Date.now()}`).then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.text();
      }),
    ]);

    const aovData = parseAOVData(aovText);
    const inboundData = parseInboundCallData(inboundText);
    
    console.log("Fetched BHAG AOV entries:", aovData.length, "Latest:", aovData[aovData.length-1]);
    console.log("Fetched BHAG Inbound entries:", inboundData.length);

    return {
      aovData: aovData,
      inboundCallData: inboundData
    };
  } catch (error) {
    console.error("Error fetching BHAG data", error);
    return { aovData: [], inboundCallData: [] };
  }
};

const parseLeadData = (csvText: string): LeadData[] => {
  const lines = csvText.split("\n");
  const data: LeadData[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    if (row.length < 2) continue;

    const dateStr = row[0];
    const listSizeStr = row[1];

    if (dateStr && listSizeStr) {
       const listSize = parseInt(cleanNumber(listSizeStr));
       
       const date = parseSafeDate(dateStr);
       
       if (!isNaN(listSize) && date) {
         data.push({
           date,
           totalListSize: listSize,
           dailyDelta: 0, // Will calculate below
         });
       }
    }
  }

  // Sort by date ascending to calculate delta
  data.sort((a, b) => a.date.getTime() - b.date.getTime());

  for (let i = 1; i < data.length; i++) {
    data[i].dailyDelta = data[i].totalListSize - data[i - 1].totalListSize;
  }

  return data;
};

export const fetchLeadData = async (): Promise<LeadData[]> => {
  try {
    const res = await fetch(URLS.LEADS.main);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const text = await res.text();
    return parseLeadData(text);
  } catch (error) {
    console.error("Error fetching Lead data", error);
    return [];
  }
};

export const fetchETSData = async (): Promise<{ GAF: number, REVEL: number }> => {
  try {
    const response = await fetch(URLS.ETS.main);
    if (!response.ok) throw new Error("Failed to fetch ETS data");
    const text = await response.text();
    const rows = parseCSVRaw(text);
    
    const etsData = { GAF: 0, REVEL: 0 };
    
    // The user explicitly requested to always use cell D37 for the ETS number.
    // In a 0-indexed array where row 1 is index 0, row 37 is index 36. Column D is index 3.
    if (rows[36] && rows[36][3]) {
      etsData.GAF = parseFloat(cleanNumber(rows[36][3])) || 0;
    }
    
    // Assuming D38 is for REVEL based on the spreadsheet structure
    if (rows[37] && rows[37][3]) {
      etsData.REVEL = parseFloat(cleanNumber(rows[37][3])) || 0;
    }

    return etsData;
  } catch (error) {
    console.error("Error fetching ETS data:", error);
    return { GAF: 0, REVEL: 0 };
  }
};
