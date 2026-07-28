
import { BrandData, BrandBudget, BrandInstagram, DayData, DayBudget, InstagramPost, ProductPerformance, ProductTrend, ProductInsightsData, CategoryInsights, SubCategoryInsight, SubCategoryProduct, BhagData, PeriodStats } from "../types";
import { parseCSV } from "../utils/helpers";

console.log("🔄 FORCE UPDATE: Data Service Loaded (Revel Edition - Smart Headers - Universal Posts - BHAG v2)");

const URLS = {
  REVEL: {
    main: "https://docs.google.com/spreadsheets/d/e/2PACX-1vT72MxE6-ziV7qfKCkHXatwJC47qjSAm0Fv0553yd09v3b0fLo-9QI3VZ-ehF_qjpaDNdd9jrYwDbU6/pub?gid=1965640519&single=true&output=csv",
    ig: "https://docs.google.com/spreadsheets/d/e/2PACX-1vT72MxE6-ziV7qfKCkHXatwJC47qjSAm0Fv0553yd09v3b0fLo-9QI3VZ-ehF_qjpaDNdd9jrYwDbU6/pub?gid=1894108367&single=true&output=csv",
  },
  PRODUCTS: {
    rolling30: "https://docs.google.com/spreadsheets/d/e/2PACX-1vT-kE6f7kHVXePLnWMSZVH5tMo94ATxniZCz2q7uje1JPAtsTtIWj6Y0MVBJEl0kE94yMt_I4wQkIle/pub?gid=132632060&single=true&output=csv",
    trends7day: "https://docs.google.com/spreadsheets/d/e/2PACX-1vT-kE6f7kHVXePLnWMSZVH5tMo94ATxniZCz2q7uje1JPAtsTtIWj6Y0MVBJEl0kE94yMt_I4wQkIle/pub?gid=1012090810&single=true&output=csv"
  },
  BHAG: {
    shipping: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRoi-4K1YP0v-rUgbOI8vg_Iyfh-gmXDArjAWGwg3FBvhh6BfV-UauXkBSwUfS4LId4MYLFWL2i4Sgz/pub?gid=949589139&single=true&output=csv",
    credit: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQjaWaELMLtVfRVqqxcBjt8a3O8eOfprExR9iFBHVti9Zi1I-FD0qVrW-8xqy1zfqRXztfVAdfyS0JW/pub?gid=1995533469&single=true&output=csv"
  },
  SALES: {
    ets: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRPpWKad4OJFAb7-SYb9-yz8sj1q8UpbcSoYTVwLUWvaqPsEMUunpZTlfiDdiLkqlRm3g9Y0_Zqxkqt/pub?gid=88121376&single=true&output=csv"
  }
};

const safeFetch = async (url: string, options?: RequestInit, timeoutMs = 60000): Promise<string> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.warn(`Fetch failed for ${url}: ${response.status} ${response.statusText}`);
      return "";
    }
    return await response.text();
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn(`⏳ Fetch timed out after ${timeoutMs / 1000} seconds for ${url}. Google Sheets might be taking too long to respond.`);
    } else {
      console.warn(`Network error fetching ${url}:`, error);
    }
    return "";
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

const parseMainData = (csvText: string, brandType: string): { data: DayData[], budgetData: DayBudget[], quarterData: DayData[], quarterBudgetData: DayBudget[], allData: DayData[], allBudgetData: DayBudget[], periodStats: { currentPeriod: PeriodStats, priorPeriod: PeriodStats } } => {
  const defaultPeriodStats: PeriodStats = {
    grossProfitCreated: 0,
    grossProfitFulfilled: 0,
    sessions: 0,
    abandonedCarts: 0,
    adSpend: 0,
    inboundSalesCalls: 0,
    outboundSalesCalls: 0,
  };

  if (!csvText || csvText.trim() === "") return { data: [], budgetData: [], quarterData: [], quarterBudgetData: [], allData: [], allBudgetData: [], periodStats: { currentPeriod: { ...defaultPeriodStats }, priorPeriod: { ...defaultPeriodStats } } };
  const lines = csvText.split("\n");
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  const currentQuarter = Math.floor(now.getMonth() / 3);
  const startOfQuarter = new Date(now.getFullYear(), currentQuarter * 3, 1);
  const endOfQuarter = new Date(now.getFullYear(), currentQuarter * 3 + 3, 0);

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(23, 59, 59, 999);

  const currentPeriodStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), 1);
  currentPeriodStart.setHours(0, 0, 0, 0);
  
  const priorPeriodStart = new Date(yesterday.getFullYear(), yesterday.getMonth() - 1, 1);
  priorPeriodStart.setHours(0, 0, 0, 0);

  const lastDayOfPriorMonth = new Date(yesterday.getFullYear(), yesterday.getMonth(), 0).getDate();
  const priorDay = Math.min(yesterday.getDate(), lastDayOfPriorMonth);

  const priorPeriodEnd = new Date(yesterday.getFullYear(), yesterday.getMonth() - 1, priorDay);
  priorPeriodEnd.setHours(23, 59, 59, 999);

  const data: DayData[] = [];
  const budgetData: DayBudget[] = [];
  const quarterData: DayData[] = [];
  const quarterBudgetData: DayBudget[] = [];
  const allData: DayData[] = [];
  const allBudgetData: DayBudget[] = [];
  const currentPeriod: PeriodStats = { ...defaultPeriodStats };
  const priorPeriod: PeriodStats = { ...defaultPeriodStats };

  for (let i = 0; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    if (cells[0]?.trim().toUpperCase() === "DATE") {
      for (let j = i + 1; j < lines.length; j++) {
        const dataCells = parseCSVLine(lines[j]);
        const dateStr = dataCells[0]?.trim();
        if (!dateStr) continue;

        const dateParts = dateStr.split("/");
        let rowDate: Date;
        if (dateParts.length === 3) {
           const day = parseInt(dateParts[0]);
           const month = parseInt(dateParts[1]);
           const year = parseInt(dateParts[2]);
           rowDate = new Date(year, month - 1, day);
        } else {
           rowDate = new Date(dateStr);
        }

        if (isNaN(rowDate.getTime())) continue;

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
        const fullDateStr = `${rowDate.getFullYear()}-${String(rowDate.getMonth() + 1).padStart(2, '0')}-${String(rowDate.getDate()).padStart(2, '0')}`;

        allBudgetData.push({
          fullDate: fullDateStr,
          grossProfitCreatedBudget,
          grossProfitFulfilledBudget,
          targetSessions
        });

        allData.push({
          date: formattedDate,
          fullDate: fullDateStr,
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

        if (rowDate >= currentPeriodStart && rowDate <= yesterday) {
          currentPeriod.grossProfitCreated += grossProfitCreated;
          currentPeriod.grossProfitFulfilled += grossProfitFulfilled;
          currentPeriod.sessions += sessions;
          currentPeriod.abandonedCarts += abandonedCarts;
          currentPeriod.adSpend += adSpend;
          currentPeriod.inboundSalesCalls += inboundSalesCalls;
          currentPeriod.outboundSalesCalls += outboundSalesCalls;
        } else if (rowDate >= priorPeriodStart && rowDate <= priorPeriodEnd) {
          priorPeriod.grossProfitCreated += grossProfitCreated;
          priorPeriod.grossProfitFulfilled += grossProfitFulfilled;
          priorPeriod.sessions += sessions;
          priorPeriod.abandonedCarts += abandonedCarts;
          priorPeriod.adSpend += adSpend;
          priorPeriod.inboundSalesCalls += inboundSalesCalls;
          priorPeriod.outboundSalesCalls += outboundSalesCalls;
        }

        if (rowDate >= startOfQuarter && rowDate <= endOfQuarter) {
          quarterBudgetData.push({ grossProfitCreatedBudget, grossProfitFulfilledBudget, targetSessions });
          
          if (rowDate <= yesterday) {
            quarterData.push({
              date: formattedDate,
              fullDate: fullDateStr,
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

        if (rowDate >= startOfMonth && rowDate <= endOfMonth) {
          budgetData.push({ grossProfitCreatedBudget, grossProfitFulfilledBudget, targetSessions });

          if (rowDate <= yesterday) {
            data.push({
              date: formattedDate,
              fullDate: fullDateStr,
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
      }
      break;
    }
  }
  return { data, budgetData, quarterData, quarterBudgetData, allData, allBudgetData, periodStats: { currentPeriod, priorPeriod } };
};

const parseIgData = (csvText: string, brandType: string): InstagramPost[] => {
  if (!csvText || csvText.trim() === "") return [];

  const rawRows = parseCSVRaw(csvText);

  let headerIndex = -1;
  // Look in first 20 rows for a row that has Caption and some URL field
  for (let i = 0; i < Math.min(20, rawRows.length); i++) {
    const rowStr = rawRows[i].join(" ").toLowerCase();
    // Broadened check to be more robust
    if (rowStr.includes("caption") && (rowStr.includes("thumbnail") || rowStr.includes("permalink") || rowStr.includes("media url") || rowStr.includes("comments"))) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    // Fallback: simple check for Caption column
    headerIndex = rawRows.findIndex(r => r.some(c => c.trim().toLowerCase() === "caption"));
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

  dataRows.forEach(rowArr => {
    const getVal = (key: string) => {
        const idx = headers.indexOf(key);
        let val = "";
        if (idx !== -1 && rowArr[idx]) {
            val = rowArr[idx];
        } else {
            // Case insensitive lookup
            const fuzzyIdx = headers.findIndex(h => h.toLowerCase() === key.toLowerCase());
            if (fuzzyIdx !== -1 && rowArr[fuzzyIdx]) {
                val = rowArr[fuzzyIdx];
            }
        }
        return val ? val.trim() : "";
    };

    const dateStr = getVal("Publish Date") || getVal("Date"); 
    let rowDate: Date | null = null;

    if (dateStr) {
        const cleanDateStr = dateStr.trim();
        // Try direct parse
        const directDate = new Date(cleanDateStr);
        if (!isNaN(directDate.getTime())) {
            rowDate = directDate;
        } else {
             // Try DD/MM/YYYY or similar formats
             const datePart = cleanDateStr.split(" ")[0]; // remove time if present
             const parts = datePart.split("/");
             if (parts.length === 3) {
                 const day = parseInt(parts[0]);
                 const month = parseInt(parts[1]);
                 const year = parseInt(parts[2].length === 2 ? "20" + parts[2] : parts[2]);
                 const candidate = new Date(year, month - 1, day);
                 if (!isNaN(candidate.getTime())) rowDate = candidate;
             }
        }
    }

    if (rowDate) {
        if (rowDate < cutoffDate) {
            return; // Too old
        }
    } else {
        // If no date, skip to be safe
        return; 
    }

    // Relaxed media type check to include all posts (Reels, Images, Carousels)
    const thumb = getVal("Media Thumbnail URL") || 
                  getVal("Thumbnail URL") || 
                  getVal("Media URL") || 
                  getVal("Image URL") ||
                  getVal("Picture");

    posts.push({
         caption: getVal("Caption"),
         comments: parseInt(cleanNumber(getVal("Comments"))) || 0,
         likes: parseInt(cleanNumber(getVal("Likes"))) || 0,
         thumbnailUrl: thumb,
         permalink: getVal("Permalink") || getVal("Link"),
         reach: parseInt(cleanNumber(getVal("Reach"))) || 0,
         shares: parseInt(cleanNumber(getVal("Shares"))) || 0,
         totalInteractions: parseInt(cleanNumber(getVal("Total Interactions"))) || 0,
         views: parseInt(cleanNumber(getVal("Views"))) || parseInt(cleanNumber(getVal("Impressions"))) || 0,
    });
  });

  return posts.sort((a, b) => b.totalInteractions - a.totalInteractions).slice(0, 5);
};

// --- PRODUCT INSIGHTS PARSERS ---

const parseProductPerformance = (csvText: string): ProductPerformance[] => {
  if (!csvText || csvText.trim() === "") return [];
  const lines = csvText.split("\n");
  const data: ProductPerformance[] = [];
  
  let headerIndex = -1;
  let headers: string[] = [];
  
  // 1. Identify Header Row
  for(let i=0; i<Math.min(50, lines.length); i++) {
      const line = parseCSVLine(lines[i]).map(c => c.toUpperCase().trim());
      // Relaxed check: look for SKU or Name or Product Name
      const hasSku = line.some(c => c.includes("SKU") || c.includes("ITEM CODE"));
      const hasName = line.some(c => c.includes("NAME") || c.includes("TITLE"));

      if (hasSku && hasName) {
          headerIndex = i;
          headers = line;
          break;
      }
  }

  if (headerIndex === -1) {
      console.error("Could not find Product Performance header row. First few rows:", lines.slice(0,3).join("\n"));
      return [];
  }

  // 2. Helper to get index with broad matching
  const getIdx = (patterns: string[]) => {
    const uppercasedPatterns = patterns.map(p => p.toUpperCase());
    // Try exact match first
    let idx = headers.findIndex(h => uppercasedPatterns.includes(h));
    if (idx !== -1) return idx;
    // Try partial match
    return headers.findIndex(h => uppercasedPatterns.some(p => h.includes(p)));
  };

  // 3. Robust Column Mapping with multiple aliases
  const idxSku = getIdx(["SKU", "ITEM CODE", "ITEM"]);
  const idxName = getIdx(["NAME", "PRODUCT NAME", "TITLE", "ITEM NAME"]);
  const idxExclusion = getIdx(["EXLUSION LIST", "EXCLUSION", "EXCLUDE"]);
  
  // GP metrics
  const idxGpVisit30 = getIdx(["GP / VISIT LAST 30 DAYS", "GP PER VISIT", "GP/VISIT", "GP / VISIT", "GP PER VISIT (30D)"]);
  const idxGpVisit3m = getIdx(["GP / VISIT LAST 3 MONTHS", "GP PER VISIT 3M", "GP/VISIT 3M", "GP / VISIT (3M)"]); 
  
  // Qty metrics
  const idxQty30 = getIdx(["QTY PURCHASED LAST 30 DAYS", "QTY 30", "QUANTITY 30", "UNITS SOLD 30", "SALES 30D"]);
  const idxQty3m = getIdx(["QTY PURCHASED LAST 3 MONTHS", "QTY 3M", "QUANTITY 3M", "UNITS SOLD 3M", "SALES 3M"]); 
  
  // Inventory
  const idxInventory = getIdx(["INVENTORY", "STOCK", "QUANTITY ON HAND", "QOH"]);
  const idxDaysSoldOut = getIdx(["DAYS UNTIL SOLD OUT", "DAYS LEFT", "DAYS OF STOCK", "WEEKS OF COVER"]); 
  const idxStockRunRate = getIdx(["ENOUGH STOCK? (RUN RATE)", "RUN RATE OK", "RUN RATE", "HEALTHY STOCK?", "STOCK OK"]);
  const idxPreOrderInv = getIdx(["PREORDER INVENTORY", "PRE-ORDER STOCK", "PREORDER QTY", "PRE ORDER"]);
  const idxNextEta = getIdx(["NEXT ETA", "ETA", "ARRIVAL DATE"]);
  const idxWebPreDate = getIdx(["WEBSITE PREORDER DATE", "PREORDER DATE", "PRE-ORDER DATE"]);
  
  // Views
  const idxPageViews30 = getIdx(["PAGE VIEWS LAST 30 DAYS", "VIEWS 30", "PAGE VIEWS 30", "SESSIONS 30", "TRAFFIC 30D"]);
  const idxPageViews3m = getIdx(["PAGE VIEWS LAST 3 MONTHS", "VIEWS 3M", "PAGE VIEWS 3M", "SESSIONS 3M", "TRAFFIC 3M"]);
  
  // Product details
  const idxProductType = getIdx(["PRODUCT TYPE", "TYPE", "CATEGORY", "DEPARTMENT"]);
  const idxUrl = getIdx(["URL", "PAGE URL", "LINK", "HANDLE"]);
  const idxRrp = getIdx(["RRP", "MSRP", "COMP PRICE", "COMPETITOR PRICE"]); // Note: Comp Price might be ambiguous with Lowest Comp
  const idxPriceIncGst = getIdx(["CURRENT PRICE (INC. GST)", "PRICE INC GST", "PRICE", "SELLING PRICE", "AUD"]);
  const idxPriceLessGst = getIdx(["CURRENT PRICE LESS GST", "CURRENT PRICE (EX. GST)", "PRICE EX GST", "PRICE EX", "PRICE NET"]);
  const idxCost = getIdx(["COST PRICE (EXC. GST)", "COST PRICE", "COST", "UNIT COST", "LANDED COST"]);
  const idxGpPercent = getIdx(["GP (%)", "GP %", "MARGIN %", "MARGIN"]);
  
  const idxVendor = getIdx(["VENDOR", "BRAND", "SUPPLIER", "MANUFACTURER"]);
  const idxPubDate = getIdx(["PUBLISHED DATE", "CREATED AT", "DATE ADDED"]);
  const idxDiscontinued = getIdx(["DISCONTINUED?", "DISCONTINUED", "IS DISCONTINUED", "ARCHIVED"]);
  const idxLowestComp = getIdx(["LOWEST COMPETITOR PRICE", "COMPETITOR PRICE", "MARKET PRICE"]);

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
const parseProductTrends = (csvText: string): { trends: ProductTrend[], categoryInsights: CategoryInsights } => {
  if (!csvText || csvText.trim() === "") return { trends: [], categoryInsights: { cardio: { currentGP: 0, previousGP: 0, currentShare: 0, previousShare: 0, subCategories: [] }, totalGP: 0 } };
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
      return { trends: [], categoryInsights: { cardio: { currentGP: 0, previousGP: 0, currentShare: 0, previousShare: 0, subCategories: [] }, totalGP: 0 } };
  }

  const getIdx = (patterns: string[]) => headers.findIndex(h => patterns.some(p => h.includes(p)));
  const idxDate = getIdx(["DATE"]);
  const idxName = getIdx(["NAME", "ITEM"]);
  const idxAmount = getIdx(["AMOUNT", "TOTAL", "REVENUE"]);
  const idxCost = getIdx(["EST. UNIT COST", "COST"]);
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

      const dateParts = dateStr.split("/");
      let rowDate: Date;
      if (dateParts.length === 3) {
          const day = parseInt(dateParts[0]);
          const month = parseInt(dateParts[1]);
          const year = parseInt(dateParts[2]);
          rowDate = new Date(year, month - 1, day);
      } else {
          rowDate = new Date(dateStr);
      }

      if (isNaN(rowDate.getTime())) continue;
      if (rowDate.getTime() > new Date().getTime()) continue;
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

  if (maxTime === 0) return { trends: [], categoryInsights: { cardio: { currentGP: 0, previousGP: 0, currentShare: 0, previousShare: 0, subCategories: [] }, totalGP: 0 } };
  
  const maxDate = new Date(maxTime);

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

  return { trends: top20Products, categoryInsights };
}

const parseShippingRecovery = (csvText: string): { date: string, rate: number, revenue: number, expenses: number }[] => {
  if (!csvText || csvText.trim() === "") return [];
  const data: { date: string, rate: number, revenue: number, expenses: number, dateObj: Date }[] = [];
  const rawRows = parseCSVRaw(csvText);
  const now = new Date();
  
  // Calculate dates
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const twelveMonthsAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1);

  let headerIndex = -1;
  for(let i=0; i<Math.min(10, rawRows.length); i++) {
    const row = rawRows[i].map(c => c.toUpperCase().trim());
    if (row.includes("MONTH") && row.includes("SHIPPING RECOVERY")) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) return [];
  
  const headers = rawRows[headerIndex].map(h => h.toUpperCase().trim());
  const idxMonth = headers.indexOf("MONTH");
  const idxRevenue = headers.indexOf("SHIPPING REVENUE");
  const idxExpenses = headers.indexOf("SHIPPING EXPENSES");
  const idxRecovery = headers.indexOf("SHIPPING RECOVERY");

  for(let i = headerIndex + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (row.length < 4) continue;
    
    const dateStr = row[idxMonth];
    const revenueStr = row[idxRevenue];
    const expensesStr = row[idxExpenses];
    const rateStr = row[idxRecovery];
    
    if (!dateStr || dateStr.trim() === "") continue;
    
    // Skip rows with #DIV/0! or empty rates
    if (!rateStr || rateStr.includes("#DIV/0!")) continue;

    const rate = parseFloat(cleanNumber(rateStr));
    const revenue = parseFloat(cleanNumber(revenueStr)) || 0;
    const expenses = parseFloat(cleanNumber(expensesStr)) || 0;
    
    if (!isNaN(rate)) {
      const rowDate = new Date(dateStr);
      if (!isNaN(rowDate.getTime()) && rowDate >= twelveMonthsAgo && rowDate < startOfCurrentMonth) {
        data.push({ 
          date: dateStr, 
          rate, 
          revenue, 
          expenses,
          dateObj: rowDate
        });
      }
    }
  }
  
  // Sort chronologically
  return data.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime()).map(d => ({
    date: d.date,
    rate: d.rate,
    revenue: d.revenue,
    expenses: d.expenses
  }));
}

const parseInstallRecovery = (csvText: string): { date: string, rate: number, revenue: number, expenses: number }[] => {
  if (!csvText || csvText.trim() === "") return [];
  const data: { date: string, rate: number, revenue: number, expenses: number, dateObj: Date }[] = [];
  const rawRows = parseCSVRaw(csvText);
  const now = new Date();
  
  // Calculate dates
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const twelveMonthsAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1);

  let headerIndex = -1;
  for(let i=0; i<Math.min(10, rawRows.length); i++) {
    const row = rawRows[i].map(c => c.toUpperCase().trim());
    if (row.includes("MONTH") && row.includes("INSTALL RECOVERY")) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) return [];
  
  const headers = rawRows[headerIndex].map(h => h.toUpperCase().trim());
  const idxMonth = headers.indexOf("MONTH");
  const idxRevenue = headers.indexOf("INSTALL REVENUE");
  const idxExpenses = headers.indexOf("INSTALL EXPENSES");
  const idxRecovery = headers.indexOf("INSTALL RECOVERY");

  for(let i = headerIndex + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (row.length < 4) continue;
    
    const dateStr = row[idxMonth];
    const revenueStr = row[idxRevenue];
    const expensesStr = row[idxExpenses];
    const rateStr = row[idxRecovery];
    
    if (!dateStr || dateStr.trim() === "") continue;
    
    // Skip rows with #DIV/0! or empty rates
    if (!rateStr || rateStr.includes("#DIV/0!")) continue;

    const rate = parseFloat(cleanNumber(rateStr));
    const revenue = parseFloat(cleanNumber(revenueStr)) || 0;
    const expenses = parseFloat(cleanNumber(expensesStr)) || 0;
    
    if (!isNaN(rate)) {
      const rowDate = new Date(dateStr);
      if (!isNaN(rowDate.getTime()) && rowDate >= twelveMonthsAgo && rowDate < startOfCurrentMonth) {
        data.push({ 
          date: dateStr, 
          rate, 
          revenue, 
          expenses,
          dateObj: rowDate
        });
      }
    }
  }
  
  // Sort chronologically
  return data.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime()).map(d => ({
    date: d.date,
    rate: d.rate,
    revenue: d.revenue,
    expenses: d.expenses
  }));
}

// BHAG Parsers with "Until Yesterday" logic and redirected GP/Discount data
const parseMonthlyData = (csvText: string): { date: string, rate: number }[] => {
  if (!csvText || csvText.trim() === "") return [];
  const data: { date: string, rate: number }[] = [];
  const rawRows = parseCSVRaw(csvText);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(23, 59, 59, 999);

  let headerIndex = -1;
  for(let i=0; i<Math.min(10, rawRows.length); i++) {
    const row = rawRows[i].map(c => c.toUpperCase());
    if (row.includes("DATE") && (row.some(c => c.includes("RATE") || c.includes("PERCENT")))) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) return [];

  for(let i = headerIndex + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (row.length < 2) continue;
    const dateStr = row[0];
    const rateStr = row[1];
    
    const rate = parseFloat(cleanNumber(rateStr));
    
    if (dateStr && !isNaN(rate)) {
      const rowDate = new Date(dateStr);
      if (!isNaN(rowDate.getTime()) && rowDate > yesterday) continue;
      data.push({ date: dateStr, rate });
    }
  }
  return data;
}

const parseCreditMemosWeekly = (csvText: string): { date: string, rate: number }[] => {
  if (!csvText || csvText.trim() === "") return [];
  const rawRows = parseCSVRaw(csvText);
  
  const data: { date: string, rate: number, dateObj: Date }[] = [];
  
  const now = new Date();
  const oneHundredThirtyDaysAgo = new Date(now);
  oneHundredThirtyDaysAgo.setDate(now.getDate() - 130); // ~18 weeks to match other charts
  
  // Find header row
  let headerIndex = -1;
  for (let i = 0; i < Math.min(10, rawRows.length); i++) {
    const row = rawRows[i].map(c => c.toUpperCase().trim());
    if (row.includes("DATE") && row.includes("CREDIT AMOUNT")) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    console.log("parseCreditMemosWeekly: Could not find header row");
    return [];
  }

  for (let i = headerIndex + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (row.length < 2) continue;
    
    const dateStr = row[0];
    const valStr = row[1];
    
    if (!dateStr || !valStr) continue;
    
    // Try to parse the date string robustly
    let dateObj: Date | null = null;
    
    const parts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');
    if (parts.length === 3) {
      let p0 = parseInt(parts[0], 10);
      let p1 = parseInt(parts[1], 10);
      let p2 = parseInt(parts[2], 10);
      
      if (p2 > 1000) {
        // DD/MM/YYYY or MM/DD/YYYY
        if (p1 > 12) {
          // MM/DD/YYYY
          dateObj = new Date(p2, p0 - 1, p1);
        } else {
          // DD/MM/YYYY
          dateObj = new Date(p2, p1 - 1, p0);
        }
      } else if (p0 > 1000) {
        // YYYY-MM-DD
        dateObj = new Date(p0, p1 - 1, p2);
      } else {
        // 2-digit year, assume DD/MM/YY
        const year = p2 < 100 ? 2000 + p2 : p2;
        if (p1 > 12) {
          dateObj = new Date(year, p0 - 1, p1);
        } else {
          dateObj = new Date(year, p1 - 1, p0);
        }
      }
    } else {
      // Fallback to standard Date parsing
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        dateObj = parsed;
      }
    }
    
    if (dateObj) {
      // Add a generous buffer for 'now' to account for timezone differences
      const futureBuffer = new Date(now);
      futureBuffer.setDate(now.getDate() + 7);
      
      if (!isNaN(dateObj.getTime()) && dateObj >= oneHundredThirtyDaysAgo && dateObj <= futureBuffer) {
        const val = Math.abs(parseFloat(cleanNumber(valStr)));
        
        data.push({
          date: dateObj.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
          rate: val,
          dateObj
        });
      } else {
        console.log("parseCreditMemosWeekly: date out of range", dateObj, "oneHundredThirtyDaysAgo", oneHundredThirtyDaysAgo, "futureBuffer", futureBuffer);
      }
    } else {
      console.log("parseCreditMemosWeekly: failed to parse date", dateStr);
    }
  }
  
  console.log("parseCreditMemosWeekly: parsed data length", data.length);
  return data.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime()).map(d => ({ date: d.date, rate: d.rate }));
}

/**
 * Aggregates daily REVEL main data into ISO weeks for GP Margin and Sales Discount cadence.
 * Uses weighted averages for both GP Margin and Sales Discount based on dollar values.
 */
const aggregateSalesDataToWeekly = (csvText: string): { gp: { date: string, amount: number, margin: number }[], salesDiscount: { date: string, rate: number }[] } => {
    if (!csvText || csvText.trim() === "") return { gp: [], salesDiscount: [] };
    const rawRows = parseCSVRaw(csvText);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 59, 59, 999);

    let headerIndex = -1;
    for(let i=0; i<Math.min(20, rawRows.length); i++) {
        const row = rawRows[i].map(c => c.toUpperCase());
        if (row.includes("DATE") && row.includes("GROSS PROFIT FULFILLED")) {
            headerIndex = i;
            break;
        }
    }

    if (headerIndex === -1) return { gp: [], salesDiscount: [] };

    // Grouping structure with accumulators for weighted calculation
    const weeks: Record<string, { 
        gpSum: number, 
        revenueSum: number, // Track revenue for margin weighting
        discountAmtSum: number, // Track discount $ for weighting
        grossSalesSum: number, // Track gross sales for weighting
        count: number, 
        startDate: Date 
    }> = {};

    for(let i = headerIndex + 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (row.length < 14) continue;
        
        const dateStr = row[0];
        const gp = parseFloat(cleanNumber(row[4]));
        const margin = parseFloat(cleanNumber(row[5]));
        const discount = parseFloat(cleanNumber(row[13]));

        if (dateStr) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                 const d = new Date(parseInt(parts[2]), parseInt(parts[1])-1, parseInt(parts[0]));
                 if (!isNaN(d.getTime())) {
                     if (d > yesterday) continue;

                     // Determine ISO Week or w/c (week commencing Monday)
                     const day = d.getDay(),
                     diff = d.getDate() - day + (day == 0 ? -6:1); // adjust when day is sunday
                     const monday = new Date(d.setDate(diff));
                     monday.setHours(0,0,0,0);
                     const weekKey = monday.toISOString().split('T')[0];

                     if (!weeks[weekKey]) {
                         weeks[weekKey] = { gpSum: 0, revenueSum: 0, discountAmtSum: 0, grossSalesSum: 0, count: 0, startDate: monday };
                     }
                     
                     // Weighted GP Logic
                     const revenue = (margin && margin !== 0) ? gp / (margin / 100) : 0;
                     weeks[weekKey].gpSum += isNaN(gp) ? 0 : gp;
                     weeks[weekKey].revenueSum += isNaN(revenue) ? 0 : revenue;

                     // Weighted Discount Logic
                     // Using fulfilled numbers (row 4, 5) for deriving base revenue
                     // Net Revenue = Gross Sales - Discount Amt
                     // Discount % = Discount Amt / Gross Sales
                     // Gross Sales = Net Revenue / (1 - Discount %)
                     let discountAmt = 0;
                     let grossSales = 0;
                     if (revenue > 0 && !isNaN(discount)) {
                         const rate = discount / 100;
                         if (rate < 1) {
                             grossSales = revenue / (1 - rate);
                             discountAmt = grossSales * rate;
                         } else {
                             // Fallback if bad data
                             grossSales = revenue;
                         }
                     }
                     weeks[weekKey].discountAmtSum += discountAmt;
                     weeks[weekKey].grossSalesSum += grossSales;
                     
                     weeks[weekKey].count++;
                 }
            }
        }
    }

    const sortedWeeks = Object.entries(weeks).sort((a, b) => a[0].localeCompare(b[0]));
    
    return {
        gp: sortedWeeks.map(([key, w]) => ({
            date: w.startDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
            amount: w.gpSum,
            // Weighted Margin % = (Total GP / Total Revenue) * 100
            margin: w.revenueSum > 0 ? (w.gpSum / w.revenueSum) * 100 : 0
        })),
        salesDiscount: sortedWeeks.map(([key, w]) => ({
            date: w.startDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
            // Weighted Discount % = (Total Discount $ / Total Gross Sales) * 100
            rate: w.grossSalesSum > 0 ? (w.discountAmtSum / w.grossSalesSum) * 100 : 0
        }))
    };
}

// Cache structures
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

const cache: Record<string, CacheEntry<any>> = {};

export const getCachedData = <T>(key: string): T | null => {
  const entry = cache[key];
  if (entry) {
    return entry.data;
  }
  return null;
};

export const isCacheStale = (key: string): boolean => {
  const entry = cache[key];
  if (!entry) return true;
  return Date.now() - entry.timestamp >= CACHE_DURATION;
};

export const setCachedData = <T>(key: string, data: T) => {
  cache[key] = {
    data,
    timestamp: Date.now(),
  };
};

export const fetchBHAGData = async (forceRefresh = false): Promise<BhagData> => {
    const cacheKey = 'bhag_data';
    if (!forceRefresh && !isCacheStale(cacheKey)) {
        const cached = getCachedData<BhagData>(cacheKey);
        if (cached) return cached;
    }

    try {
        const [shippingCsv, creditCsv, salesCsv] = await Promise.all([
            safeFetch(URLS.BHAG.shipping),
            safeFetch(URLS.BHAG.credit),
            safeFetch(URLS.REVEL.main) // Redirect GP and Discount to pool from the REVEL main dataset
        ]);

        const salesWeekly = aggregateSalesDataToWeekly(salesCsv);

        const result = {
            shippingRecovery: parseShippingRecovery(shippingCsv),
            installRecovery: parseInstallRecovery(shippingCsv),
            creditMemos: parseCreditMemosWeekly(creditCsv),
            gp: salesWeekly.gp,
            salesDiscount: salesWeekly.salesDiscount
        };
        setCachedData(cacheKey, result);
        return result;
    } catch (error) {
        console.error("💥 BHAG Fetch error:", error);
        return { shippingRecovery: [], installRecovery: [], creditMemos: [], gp: [], salesDiscount: [] };
    }
}

export const fetchDashboardData = async (forceRefresh = false): Promise<{
  data: BrandData;
  budgetData: BrandBudget;
  quarterData: BrandData;
  quarterBudgetData: BrandBudget;
  allData: BrandData;
  allBudgetData: BrandBudget;
  periodStats: {
    GAF: { currentPeriod: PeriodStats, priorPeriod: PeriodStats },
    REVEL: { currentPeriod: PeriodStats, priorPeriod: PeriodStats }
  };
  etsData: { GAF: number, REVEL: number };
}> => {
  const cacheKey = 'dashboard_data';
  if (!forceRefresh && !isCacheStale(cacheKey)) {
      const cached = getCachedData<any>(cacheKey);
      if (cached) return cached;
  }

  try {
    // 1. Fetch main sales data first with high priority
    const [revelMainCsv, etsCsv] = await Promise.all([
      safeFetch(URLS.REVEL.main, { priority: 'high' } as RequestInit),
      safeFetch(URLS.SALES.ets)
    ]);

    const revelParsed = parseMainData(revelMainCsv, "REVEL");
    
    // Parse ETS data
    let etsGAF = 0;
    let etsREVEL = 0;
    if (etsCsv) {
      const etsRows = parseCSVRaw(etsCsv);
      // Find rows that contain "Expected to be shipped before end of Month"
      for (const row of etsRows) {
        if (row[0] && row[0].includes("Expected to be shipped before end of Month") && !row[0].includes("Next Month")) {
          // parseCSVRaw handles the quotes properly, so the array elements will be:
          // [0] "Expected to be shipped before end of Month - Revel - Total"
          // [1] ""
          // [2] "$219,544.19" (Column C)
          // [3] "$58,398.75" (Column D)
          const val = parseFloat((row[3] || "0").replace(/[^0-9.-]+/g, ""));
          if (row[0].includes("GAF - Total")) etsGAF = val;
          if (row[0].includes("Revel - Total")) etsREVEL = val;
        }
      }
    }

    const result = {
      data: { GAF: [], REVEL: revelParsed.data },
      budgetData: { GAF: [], REVEL: revelParsed.budgetData },
      quarterData: { GAF: [], REVEL: revelParsed.quarterData },
      quarterBudgetData: { GAF: [], REVEL: revelParsed.quarterBudgetData },
      allData: { GAF: [], REVEL: revelParsed.allData },
      allBudgetData: { GAF: [], REVEL: revelParsed.allBudgetData },
      periodStats: { 
        GAF: { currentPeriod: { grossProfitCreated: 0, grossProfitFulfilled: 0, sessions: 0, abandonedCarts: 0, adSpend: 0, inboundSalesCalls: 0, outboundSalesCalls: 0 }, priorPeriod: { grossProfitCreated: 0, grossProfitFulfilled: 0, sessions: 0, abandonedCarts: 0, adSpend: 0, inboundSalesCalls: 0, outboundSalesCalls: 0 } }, 
        REVEL: revelParsed.periodStats 
      },
      etsData: { GAF: etsGAF, REVEL: etsREVEL }
    };
    setCachedData(cacheKey, result);
    return result;
  } catch (error) {
    console.error("💥 Fetch error:", error);
    return { 
      data: { GAF: [], REVEL: [] }, 
      budgetData: { GAF: [], REVEL: [] }, 
      quarterData: { GAF: [], REVEL: [] }, 
      quarterBudgetData: { GAF: [], REVEL: [] }, 
      allData: { GAF: [], REVEL: [] }, 
      allBudgetData: { GAF: [], REVEL: [] }, 
      periodStats: { 
        GAF: { currentPeriod: { grossProfitCreated: 0, grossProfitFulfilled: 0, sessions: 0, abandonedCarts: 0, adSpend: 0, inboundSalesCalls: 0, outboundSalesCalls: 0 }, priorPeriod: { grossProfitCreated: 0, grossProfitFulfilled: 0, sessions: 0, abandonedCarts: 0, adSpend: 0, inboundSalesCalls: 0, outboundSalesCalls: 0 } }, 
        REVEL: { currentPeriod: { grossProfitCreated: 0, grossProfitFulfilled: 0, sessions: 0, abandonedCarts: 0, adSpend: 0, inboundSalesCalls: 0, outboundSalesCalls: 0 }, priorPeriod: { grossProfitCreated: 0, grossProfitFulfilled: 0, sessions: 0, abandonedCarts: 0, adSpend: 0, inboundSalesCalls: 0, outboundSalesCalls: 0 } } 
      },
      etsData: { GAF: 0, REVEL: 0 }
    };
  }
};

export const fetchInstagramData = async (forceRefresh = false): Promise<BrandInstagram> => {
  const cacheKey = 'instagram_data';
  if (!forceRefresh && !isCacheStale(cacheKey)) {
      const cached = getCachedData<BrandInstagram>(cacheKey);
      if (cached) return cached;
  }

  try {
    const [revelIgCsv] = await Promise.all([
      safeFetch(URLS.REVEL.ig),
    ]);

    const result = {
      GAF: [],
      REVEL: parseIgData(revelIgCsv, "REVEL")
    };
    setCachedData(cacheKey, result);
    return result;
  } catch (error) {
    console.error("💥 IG Fetch error:", error);
    return { GAF: [], REVEL: [] };
  }
};

export const fetchProductInsightsData = async (forceRefresh = false): Promise<ProductInsightsData> => {
    const cacheKey = 'product_insights_data';
    if (!forceRefresh && !isCacheStale(cacheKey)) {
        const cached = getCachedData<ProductInsightsData>(cacheKey);
        if (cached) return cached;
    }

    try {
        console.log("🛍️ STARTING PRODUCT INSIGHTS FETCH...");
        const [rollingCsv, trendsCsv] = await Promise.all([
            safeFetch(URLS.PRODUCTS.rolling30),
            safeFetch(URLS.PRODUCTS.trends7day)
        ]);

        const trendsData = parseProductTrends(trendsCsv);

        const result = {
            performance: parseProductPerformance(rollingCsv),
            trends: trendsData.trends,
            categoryInsights: trendsData.categoryInsights
        };
        setCachedData(cacheKey, result);
        return result;

    } catch (error) {
        console.error("💥 Product Fetch error:", error);
        return { performance: [], trends: [] };
    }
}
