
import { ProcessedTheme, SubTheme } from '../types';

// Minimal CSV parser that handles quoted fields and commas
export function parseCSV(text: string): Record<string, any>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (c === "\r") {
        // ignore CR
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj: Record<string, any> = {};
    headers.forEach((h, j) => {
      obj[h] = r[j] !== undefined ? r[j] : "";
    });
    return obj;
  });
}

export function splitList(s: string | undefined): string[] {
  if (!s) return [];
  return s
    .split(/[,;|]/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function normalizeSentiment(s: string): string {
  const v = String(s || "").toLowerCase();
  if (v.includes("pos")) return "Positive";
  if (v.includes("neg")) return "Negative";
  if (v.includes("neu")) return "Neutral";
  return s || "Unknown";
}

export function normalizeDirection(s: string): string {
  const v = String(s || "").toLowerCase();
  if (v.includes("out")) return "Outbound";
  if (v.includes("in")) return "Inbound";
  return s || "Unknown";
}

export const fmt = (n: number) => n.toLocaleString("en-AU");

/**
 * AI-like logic to categorise raw job strings into a "Middle Layer" sub-theme.
 */
export function categorizeJob(job: string): string {
  const lower = job.toLowerCase();

  // Functional Groupings
  if (lower.match(/install|setup|assemble|build|construction|flooring|mat/)) return "Installation & Setup";
  if (lower.match(/buy|purchase|acquire|get|order|stock|availability/)) return "Acquisition & Availability";
  if (lower.match(/research|compare|evaluate|investigate|browse|look for/)) return "Research & Selection";
  if (lower.match(/upgrade|replace|change|switch|modernize/)) return "Upgrade & Replacement";
  if (lower.match(/fix|repair|maintain|service|parts|warranty/)) return "Maintenance & Support";
  if (lower.match(/gift|present|someone else|partner|spouse|son|daughter/)) return "Gifting & Others";
  if (lower.match(/space|fit|measure|room|garage|size|dimension/)) return "Space Optimization";
  if (lower.match(/budget|cost|price|cheap|expensive|afford|finance/)) return "Budget & Cost";
  if (lower.match(/start|begin|new|first time|beginner/)) return "Starting Out";
  if (lower.match(/expand|add|more|collection|complete/)) return "Expansion";

  // Emotional Groupings
  if (lower.match(/confiden|safe|secure|trust|reliable/)) return "Confidence & Safety";
  if (lower.match(/excite|happy|joy|fun|love|passion/)) return "Excitement & Joy";
  if (lower.match(/frustrat|worry|anxious|concern|stress|fear/)) return "Relief from Negativity";
  if (lower.match(/proud|pride|accomplish|achieve/)) return "Pride & Achievement";
  if (lower.match(/motivat|inspire|drive|energy/)) return "Motivation";

  // Social Groupings
  if (lower.match(/impress|show off|status|envy|look good/)) return "Status & Impression";
  if (lower.match(/community|friend|share|group|belong/)) return "Belonging & Community";
  if (lower.match(/help|support|teach|coach|train others/)) return "Helping Others";

  // Default fallback if no specific keywords found, but try to group very short strings
  if (lower.length < 5) return "General";
  
  return "Specific Needs";
}

export function aggregateThemes(data: any[], jobField: string, themeField: string): ProcessedTheme[] {
  // Map<ThemeName, Map<SubThemeName, Map<JobName, count>>>
  const themeMap = new Map<string, Map<string, Map<string, number>>>();

  data.forEach((row) => {
    const theme = row[themeField]; // Top Level (e.g., Convenience)
    const job = row[jobField];     // Low Level (e.g., Install flooring)

    if (!theme || !job) return;

    // 1. Get or Create Theme
    if (!themeMap.has(theme)) {
      themeMap.set(theme, new Map());
    }
    const subThemeMap = themeMap.get(theme)!;

    // 2. Determine SubTheme (Middle Layer)
    const subTheme = categorizeJob(job);
    
    // 3. Get or Create SubTheme
    if (!subThemeMap.has(subTheme)) {
      subThemeMap.set(subTheme, new Map());
    }
    const jobMap = subThemeMap.get(subTheme)!;

    // 4. Count Job
    jobMap.set(job, (jobMap.get(job) || 0) + 1);
  });

  const totalCalls = data.length;

  // Convert Map structure to ProcessedTheme[]
  return Array.from(themeMap.entries())
    .map(([themeName, subThemeMap]) => {
      let themeTotal = 0;
      
      const subThemes: SubTheme[] = Array.from(subThemeMap.entries())
        .map(([subName, jobMap]) => {
          let subTotal = 0;
          const jobs = Array.from(jobMap.entries())
            .map(([jName, jCount]) => {
              subTotal += jCount;
              return { name: jName, count: jCount };
            })
            .sort((a, b) => b.count - a.count);
          
          themeTotal += subTotal;

          return {
            name: subName,
            count: subTotal,
            jobs: jobs
          };
        })
        .sort((a, b) => b.count - a.count);

      return {
        name: themeName,
        count: themeTotal,
        percentage: totalCalls > 0 ? ((themeTotal / totalCalls) * 100).toFixed(1) : "0",
        subThemes: subThemes
      };
    })
    .sort((a, b) => b.count - a.count);
}
