import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import { Target, Flag, Star, Heart, Mountain, Compass, MapPin, Rocket, TrendingUp, Loader2, Shield, AlertTriangle, Lightbulb, Users, Crosshair, Calendar } from 'lucide-react';

const FORCE_USA_DOC_URL = "https://docs.google.com/document/d/e/2PACX-1vQPEzXwMibBUTbQ8CzisOeZmHNUypfxF-vQtJvCdv32pa6PN5gnQYlMZTzYiJFPd0OVg8OJFkr9mgxe/pub";

const PROXIES = [
  (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

const fyMonths = ["JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER","JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE"];
const today = new Date();
const fyMonthIndex = (today.getMonth() + 6) % 12;
const monthColumns: Record<string, { budget: number; actual: number }> = {
  JULY: { budget: 2, actual: 3 }, AUGUST: { budget: 4, actual: 5 },
  SEPTEMBER: { budget: 6, actual: 7 }, OCTOBER: { budget: 8, actual: 9 },
  NOVEMBER: { budget: 10, actual: 11 }, DECEMBER: { budget: 12, actual: 13 },
  JANUARY: { budget: 16, actual: 17 }, FEBRUARY: { budget: 18, actual: 19 },
  MARCH: { budget: 20, actual: 21 }, APRIL: { budget: 22, actual: 23 },
  MAY: { budget: 24, actual: 25 }, JUNE: { budget: 26, actual: 27 },
};

const europeCountries = ["Austria","Belgium","Bulgaria","Croatia","Cyprus","Czechia","Czech Republic","Denmark","Estonia","Finland","France","Germany","Greece","Hungary","Ireland","Italy","Latvia","Lithuania","Luxembourg","Malta","Netherlands","Poland","Portugal","Romania","Slovakia","Slovenia","Spain","Sweden","United Kingdom","UK","Norway","Switzerland","Ukraine"];
const euCountryCodes = ["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE","GB","UK","NO","CH","UA"];

const cleanCurrency = (v: any) => {
  if (!v) return 0;
  const n = Number.parseFloat(v.toString().replace(/[$,\s]/g, ""));
  return Number.isNaN(n) ? 0 : n;
};
const formatCompactCurrency = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M` : v >= 1_000 ? `$${(v / 1_000).toFixed(2)}K` : new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

const ShowroomTable = ({ data }: any) => {
  const [open, setOpen] = useState<Set<string>>(new Set());
  if (!data) return null;
  const { byCountry } = data;
  const toggle = (c: string) => { const n = new Set(open); n.has(c) ? n.delete(c) : n.add(c); setOpen(n); };

  return (
    <div className="overflow-auto max-h-96">
      <table className="w-full">
        <thead className="sticky top-0 bg-gray-50 z-10">
          <tr className="border-b-2 border-gray-200 text-left text-sm font-semibold text-gray-500">
            <th className="py-3 px-3 bg-gray-50">Country</th>
            <th className="py-3 px-3 bg-gray-50">Store</th>
            <th className="py-3 px-3 text-right bg-gray-50">Unit Count</th>
            <th className="py-3 px-3 bg-gray-50">Models</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(byCountry).map(([country, d]: any) => (
            <React.Fragment key={country}>
              <tr onClick={() => toggle(country)} className={`cursor-pointer border-b transition-colors hover:bg-gray-50 ${open.has(country) ? "bg-gray-50" : ""}`}>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-3">
                    <div className="font-bold text-[#185787]">{country}</div>
                    <div className="ml-auto"><span className="text-lg text-gray-400">{open.has(country) ? "▼" : "▶"}</span></div>
                  </div>
                </td>
                <td className="py-3 px-3 text-sm text-gray-500">{d.stores.length} stores</td>
                <td className="py-3 px-3 text-right font-bold text-lg text-[#185787]">{d.totalUnits}</td>
                <td className="py-3 px-3" />
              </tr>
              {open.has(country) && d.stores.map((s: any, i: number) => (
                <tr key={s.id} className="border-b hover:bg-gray-50" style={{ backgroundColor: i % 2 ? "#FFFFFF" : "#FAFBFC" }}>
                  <td className="py-3 pl-8" />
                  <td className="py-3 px-3"><div className="font-medium text-sm text-gray-800">{s.store}</div></td>
                  <td className="py-3 px-3 text-right text-sm text-gray-800">{s.unitCount}</td>
                  <td className="py-3 px-3 text-sm text-gray-500 font-medium">{s.models.length > 0 ? s.models.join(", ") : "-"}</td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default function OPSPDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [opspData, setOpspData] = useState<any>(null);
  const [showroomData, setShowroomData] = useState<any>(null);
  const [revenueYtd, setRevenueYtd] = useState<number>(0);

  const fallbackData = {
    coreValues: ["PEOPLE", "NIMBAGILITY", "CONTINUOUS IMPROVEMENT", "COLLABORATION", "EMPATHY", "INCLUSIVITY"],
    purpose: "Improve lives through fitness and wellness",
    bhag: "By 2030 Force will become the Top 3 global strength brand delivering innovative, integrated strength systems, generating $100M+ revenue with 1,000+ physical locations globally",
    fy30Revenue: "$100,000,000",
    keyThrusts: [] as { title: string; desc: string }[],
    initiatives: [
      { text: "Build customer intelligence into a competitive advantage: a direct, first-party understanding of who our end customers are and why they buy, used to sharpen product and brand decisions and to support distributors with insight no competitor can give them", owner: "JH", status: "In Progress" },
      { text: "Improve ROI on existing distributors and attract more strong distributors, shifting the distributor mix", owner: "SH", status: "Not Set" },
      { text: "Embed the NPI process and sales toolkit across new product launches", owner: "LP", status: "Not Set" },
      { text: "Lift CX management capacity to support distribution: after-sales, warranty, spare parts and fulfilment", owner: "SH", status: "Not Set" },
      { text: "Accelerate product content and process using AI", owner: "MV", status: "Not Set" },
    ],
    strengths: [
      "Proprietary, vertically integrated product with ~90% in-house manufacturing (Body Longer)",
      "Differentiated core category: integrated all-in-one strength systems",
      "C20 award-winning product with industry recognition",
      "Strong growth in US (~30% YoY) and UK markets",
      "Established global distributor network (Fit Shop EU, Jimco, and partners across SEA, Middle East, Africa, South America)",
      "Force App provides a direct channel to end users",
      "ECDesign integration: 25 SKUs live on the 2D/3D gym design platform for distributors and sales",
    ],
    weaknesses: [
      "Limited visibility of end-customer data; the customer is largely owned by the distributor",
      "Reliance on distributors for market access and sales",
      "NPI process historically ad hoc, only now being formalised",
      "Low retail floor-model footprint (21 of a 100-store target)",
      "Margin pressure (~25% Q4 margin) and freight/shipping cost exposure",
      "App development cost and external dependency (~$8k/mo, Stormotion)",
      "Brand consistency across markets and localised-content burden",
    ],
    opportunities: [
      "Functional trainers are the fastest-growing US segment (9.64% CAGR)",
      "Large home-strength headroom (power rack ownership only 6.39% in AU study)",
      "Rebel Sport AU retail partnership (Australia's largest sporting goods retailer)",
      "UK expansion via Amazon UK and Decathlon UK",
      "Customer intelligence as a competitive advantage and a distributor-support tool",
      "Retail floor-model expansion toward the 1,000-store BHAG",
      "Leverage US-developed content across international distributors",
      "Market Development Fund (MDF) built into new-product pricing to fund marketing",
    ],
    threats: [
      "Middle East instability (Garner distributor postponed)",
      "Competition from Rogue, Rep Fitness and other strength brands",
      "Ultra-cheap offshore platforms and new product-safety obligations (2026 Federal Budget)",
      "Freight and shipping cost volatility impacting margin",
      "Post-COVID normalisation of home-fitness demand",
    ],
    quarterlyActions: [
      "By 31 July, define the key questions about the end customer (who they are, why they bought, jobs-to-be-done, what they buy next) and the decisions they drive, for Force and for distributors (JH)",
      "By 31 July, audit the first-party data and direct-capture channels Force already has (Force App, US DTC, enquiry and sales data, existing GAF/Revel archetype work) (JH)",
      "By 31 August, identify and prioritise the avenues to build customer intelligence (app and product registration, post-purchase surveys, DTC data, distributor collaboration) with a recommended mix (JH)",
      "By 31 August, shape the distributor-support offering and test it in principle with one or two lead distributors, e.g. Jimco and Fit Shop (JH)",
      "By 30 September, prove the approach with at least one working pilot capturing real first-party customer data, reviewed in the monthly BU cadence (JH)",
      "By 30 September, deliver a signed-off customer-intelligence roadmap covering data capture and distributor support (JH)",
    ],
    companyPriorities: [
      { owner: "Josh Hancock (JH)", text: "Define the customer intelligence we need and the decisions it drives; prioritise the capture avenues; ship one working pilot and a signed-off roadmap" },
      { owner: "Simon Heinrich (SH)", text: "Identify the % split of Tier 1/2/3 distributors; agree and align scorecard ranking; build grow / reward / stop plans" },
      { owner: "Laura Paul (LP)", text: "100% of hero products have a completed Ready-for-Sale checklist by end of Q1" },
      { owner: "Simon Heinrich (SH)", text: "Distributor job scorecard (Ashleigh); create the online warranty process by Q1; hire a CX Force A-player to onboard by Q4" },
      { owner: "Mario Vargas (MV)", text: "Access urgent SKUs for content; review SKUs and agency capability; stand up an AI-driven content production process with testing and learnings" },
    ],
    yourPriority: {
      goal: "By 30 September, define the customer intelligence we need and the decisions it drives, prioritise the avenues to capture it, prove the approach with one working pilot, and deliver a signed-off roadmap for the year",
      kpi: "First-party customer records captured globally [target TBC]; number of distributors actively using Force customer intelligence [target TBC]",
    },
    sandbox: {
      geography: "Global: Australia, USA, UK, Europe, plus SEA, Middle East, Africa, South America",
      channel: "Distributors (wholesale) + US DTC + Force App",
      offering: "Integrated all-in-one strength systems and hero units",
    },
    processes: {
      makeBuy: "In-house manufacturing via Body Longer (~90% of production)",
      sell: "Global distributor network + US DTC (forceusa.co) + Force App",
      recordkeeping: "Align (projects), A-line (forecasting), Asana",
    },
    onePhraseStrategy: [
      "Focus on a Global Brand",
      "Expand A+ Distributors",
      "Enable Innovative, Integrated Strength Systems",
      "Lead in Physical Display & CX",
      "FEEL: increasing accessibility of physical product in locations and retail floors where people can experience it first-hand",
    ],
    strategicPillars: [
      "Innovative & Integrated Strength Systems",
      "High-Performance Distributor Network",
      "Product & NPI Excellence",
      "Content and Commercial Execution Engine",
      "Customer and CX Visibility and Improvement",
    ],
    brandPromises: [
      "One system, every workout: premium integrated strength, built in-house to last (WIP - TBC)",
      "A partner that brings you customers and insight, not just product (WIP - TBC)",
    ],
    brandPromiseKpis: "Trustpilot / NPS; distributor satisfaction + reorder rate (WIP - TBC)",
    people: {
      employees: "Employee engagement / eNPS score (WIP - TBC)",
      customers: "NPS + Trustpilot rating; distributor satisfaction score (WIP - TBC)",
      shareholders: "Revenue growth %, gross margin %, EBITDA (WIP - TBC)",
    },
    theme: { theme: "TBC", target: "TBC", celebration: "TBC", reward: "TBC" },
    fy27Goals: { revenue: "TBC", grossProfit: "TBC", gpPercent: "TBC" },
    profitX: "(TBC)",
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const docUrl = `${FORCE_USA_DOC_URL}?_t=${Date.now()}`;
        let htmlContent: string | null = null;
        for (const proxyFn of PROXIES) {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            const res = await fetch(proxyFn(docUrl), { signal: controller.signal });
            clearTimeout(timeout);
            if (!res.ok) continue;
            const ct = res.headers.get('content-type') || '';
            if (ct.includes('json')) {
              const json = await res.json();
              htmlContent = json.contents;
            } else {
              htmlContent = await res.text();
            }
            if (htmlContent) break;
          } catch { continue; }
        }
        if (!htmlContent) throw new Error('All proxies failed');

        const doc = new DOMParser().parseFromString(htmlContent, 'text/html');
        doc.querySelectorAll('script, style, head').forEach((el: Element) => el.remove());

        // Google publishes the doc as a SINGLE line with no newlines, so the old
        // textContent.split('\n') parse matched nothing and every field silently fell
        // back to hardcoded data (incl. Key Initiatives / SWOT). Parse the DOM structure
        // directly instead — newline-independent and deterministic.
        const looksLikeCode = (s: string) => /[{};]|=>|\bfunction\b|prototype|\bvar\b|typeof/.test(s);
        const clean = (s: string | null | undefined) => (s && !looksLikeCode(s) ? s.trim() : null);

        // Ordered list of text runs (each paragraph / table cell is one block).
        const blocks = Array.from(doc.querySelectorAll('p, h1, h2, h3, h4, li'))
          .map((el) => (el.textContent || '').trim())
          .filter(Boolean);

        const valueAfter = (label: string, opts: { exact?: boolean; from?: number } = {}) => {
          const { exact = false, from = 0 } = opts;
          const i = blocks.findIndex((b, idx) => idx >= from && (exact
            ? b.toLowerCase() === label.toLowerCase()
            : b.toLowerCase().includes(label.toLowerCase())));
          return i !== -1 && blocks[i + 1] ? blocks[i + 1] : null;
        };

        // Numbered rows of the table following a heading, as arrays of cell text.
        const rowsAfter = (headingMatch: RegExp): string[][] => {
          const heading = Array.from(doc.querySelectorAll('h1,h2,h3,h4,p,span'))
            .find((el) => headingMatch.test(el.textContent || ''));
          if (!heading) return [];
          const tbl = Array.from(doc.querySelectorAll('table')).find(
            (t) => heading.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING);
          if (!tbl) return [];
          const out: string[][] = [];
          for (const row of Array.from(tbl.querySelectorAll('tr')).slice(1)) {
            const cells = Array.from(row.querySelectorAll('td')).map((c) => (c.textContent || '').trim());
            if (cells.length >= 2 && /^\d+$/.test(cells[0])) out.push(cells);
          }
          return out;
        };
        // Second column (the content column) of a numbered table.
        const listAfter = (headingMatch: RegExp) =>
          rowsAfter(headingMatch).map((c) => c[1]).filter((v) => v && !looksLikeCode(v));

        const parsed = { ...fallbackData };

        const coreValues = listAfter(/Core Values/i);
        if (coreValues.length) parsed.coreValues = coreValues;

        const purpose = clean(valueAfter("Purpose (Why)"));
        if (purpose) parsed.purpose = purpose;

        const bhag = clean(valueAfter("BHAG (Big Hairy Audacious Goal)"));
        if (bhag) parsed.bhag = bhag;

        const fy30Rev = valueAfter("FY30", { exact: true });
        if (fy30Rev && fy30Rev.includes("$") && !looksLikeCode(fy30Rev)) parsed.fy30Revenue = fy30Rev;

        // Initiatives: the owner is embedded as a trailing "(XX)" tag, status is the last cell.
        const initiatives = rowsAfter(/Key Initiatives/i).map((cells) => {
          let text = cells[1] || '';
          const ownerMatch = text.match(/\(([A-Za-z]{2,4})\)\s*$/);
          const owner = ownerMatch ? ownerMatch[1] : '';
          if (ownerMatch) text = text.slice(0, ownerMatch.index).trim();
          return { text, owner, status: cells[cells.length - 1] || 'Not Set' };
        }).filter((i) => i.text && !looksLikeCode(i.text));
        if (initiatives.length) parsed.initiatives = initiatives;

        const strengths = listAfter(/^Strengths$/i);
        if (strengths.length) parsed.strengths = strengths;
        const weaknesses = listAfter(/Weaknesses/i);
        if (weaknesses.length) parsed.weaknesses = weaknesses;
        const opportunities = listAfter(/Opportunities/i);
        if (opportunities.length) parsed.opportunities = opportunities;
        const threats = listAfter(/Trends \/ Threats/i);
        if (threats.length) parsed.threats = threats;

        // Sandbox + Process are label→value pairs in their own tables.
        const sbFrom = blocks.findIndex((b) => /Sandbox \/ Ideal Client/i.test(b));
        if (sbFrom !== -1) {
          parsed.sandbox = {
            geography: clean(valueAfter("Geography", { exact: true, from: sbFrom })) || fallbackData.sandbox.geography,
            channel: clean(valueAfter("Channel", { exact: true, from: sbFrom })) || fallbackData.sandbox.channel,
            offering: clean(valueAfter("Offering", { exact: true, from: sbFrom })) || fallbackData.sandbox.offering,
          };
        }
        parsed.processes = {
          makeBuy: clean(valueAfter("Make/Buy", { exact: true })) || fallbackData.processes.makeBuy,
          sell: clean(valueAfter("Sell", { exact: true })) || fallbackData.processes.sell,
          recordkeeping: clean(valueAfter("Recordkeeping", { exact: true })) || fallbackData.processes.recordkeeping,
        };

        // Index of the first block matching a heading (for scoped lookups).
        const idxOf = (re: RegExp, from = 0) => blocks.findIndex((b, i) => i >= from && re.test(b));
        // Body-text lines between two heading markers (for paragraph sections).
        const blocksBetween = (startRe: RegExp, endRe: RegExp) => {
          const s = idxOf(startRe);
          if (s === -1) return [];
          const e = idxOf(endRe, s + 1);
          return blocks.slice(s + 1, e === -1 ? undefined : e).filter((b) => b && !looksLikeCode(b));
        };

        // Strategic Pillars (the "Key Thrusts / Capabilities" 3-5yr table).
        const strategicPillars = listAfter(/Key Thrusts/i);
        if (strategicPillars.length) parsed.strategicPillars = strategicPillars;

        // One-phrase strategy (body lines between its label and the BHAG heading).
        const onePhrase = blocksBetween(/Strategy \(one phrase\)/i, /BHAG/i);
        if (onePhrase.length) parsed.onePhraseStrategy = onePhrase;

        // Brand Promises + KPIs (paragraph sections between their labels).
        const promises = blocksBetween(/^Brand Promises$/i, /Brand Promises KPIs/i);
        if (promises.length) parsed.brandPromises = promises;
        const promiseKpi = blocksBetween(/Brand Promises KPIs/i, /Three to Five/i);
        if (promiseKpi.length) parsed.brandPromiseKpis = promiseKpi.join(" ");

        // People (Reputation Drivers) — non-numbered label→value rows, scoped by heading.
        const peopleFrom = idxOf(/People \(Reputation Drivers\)/i);
        if (peopleFrom !== -1) {
          parsed.people = {
            employees: clean(valueAfter("Employees", { exact: true, from: peopleFrom })) || fallbackData.people.employees,
            customers: clean(valueAfter("Customers", { exact: true, from: peopleFrom })) || fallbackData.people.customers,
            shareholders: clean(valueAfter("Shareholders", { exact: true, from: peopleFrom })) || fallbackData.people.shareholders,
          };
        }

        // Theme (Qtr/Annual) — scoped label→value rows.
        const themeFrom = idxOf(/Theme \(Qtr\/Annual\)/i);
        if (themeFrom !== -1) {
          parsed.theme = {
            theme: valueAfter("Theme", { exact: true, from: themeFrom }) || fallbackData.theme.theme,
            target: valueAfter("Measurable Target / Critical #", { exact: true, from: themeFrom }) || fallbackData.theme.target,
            celebration: valueAfter("Celebration", { exact: true, from: themeFrom }) || fallbackData.theme.celebration,
            reward: valueAfter("Reward", { exact: true, from: themeFrom }) || fallbackData.theme.reward,
          };
        }

        // One Year Goals FY2027 (Revenue / Gross Profit / GP%).
        const goalsFrom = idxOf(/One Year - Goals FY2027/i);
        if (goalsFrom !== -1) {
          parsed.fy27Goals = {
            revenue: valueAfter("REVENUE", { exact: true, from: goalsFrom }) || fallbackData.fy27Goals.revenue,
            grossProfit: valueAfter("GROSS PROFIT", { exact: true, from: goalsFrom }) || fallbackData.fy27Goals.grossProfit,
            gpPercent: valueAfter("GROSS PROFIT %", { exact: true, from: goalsFrom }) || fallbackData.fy27Goals.gpPercent,
          };
        }

        // Profit/X (heading carries an inline value, e.g. "Profit/X (TBC)").
        const profitBlock = blocks.find((b) => /^Profit\/X/i.test(b));
        if (profitBlock) parsed.profitX = profitBlock.replace(/^Profit\/X\s*/i, "").trim() || "(TBC)";

        setOpspData(parsed);
      } catch (e) {
        console.warn("Live parsing failed, using fallback data.", e);
        setOpspData(fallbackData);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQiboUvN6uqddlmcX7SqCwKbgtDrvxffq945XtCYb8qQNhOTZXZZ_phwIZQR3VVjti_CI4EjJDZR-lB/pub?gid=2093632728&single=true&output=csv";
        const csv = await (await fetch(url + "&t=" + new Date().getTime(), { cache: "no-store" })).text();
        const rows = Papa.parse(csv, { header: false, skipEmptyLines: true }).data as string[][];
        for (let i = 2; i < rows.length; i++) {
          const nameRaw = rows[i][0]?.toString().trim();
          if (nameRaw && /^TOTAL\b/i.test(nameRaw)) {
            let ytdActual = 0;
            fyMonths.forEach((m, idx) => {
              if (idx <= fyMonthIndex) {
                ytdActual += cleanCurrency(rows[i][monthColumns[m].actual]);
              }
            });
            setRevenueYtd(ytdActual);
            break;
          }
        }
      } catch (e) {
        console.error("Revenue data load error:", e);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQiboUvN6uqddlmcX7SqCwKbgtDrvxffq945XtCYb8qQNhOTZXZZ_phwIZQR3VVjti_CI4EjJDZR-lB/pub?gid=2034170474&single=true&output=csv";
        const csv = await (await fetch(url + "&t=" + new Date().getTime(), { cache: "no-store" })).text();
        const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
        const rows = parsed.data as any[];
        const allColumns = Object.keys(rows[0] || {});
        const modelColumns = allColumns.filter(col => col !== "Store" && col !== "Country" && col !== "Comments" && col.trim() !== "");

        const byCountry: any = {};
        let totalStoresWithUnits = 0;
        let euStoresWithUnits = 0;
        const countriesSet = new Set<string>();

        rows.forEach((row, idx) => {
          const store = row["Store"]?.trim() || "";
          const country = row["Country"]?.trim() || "Unknown";
          if (!store) return;
          const models: string[] = [];
          let unitCount = 0;
          modelColumns.forEach(modelCol => {
            const value = row[modelCol]?.toString().trim();
            if (value && value !== "0" && value !== "") {
              models.push(modelCol);
              const count = Number.parseInt(value, 10);
              unitCount += Number.isNaN(count) ? 1 : count;
            }
          });

          if (models.length > 0) {
            totalStoresWithUnits++;
            countriesSet.add(country);
            const isEU = europeCountries.some(eu => eu.toLowerCase() === country.toLowerCase()) ||
                         euCountryCodes.some(eu => eu.toLowerCase() === country.toLowerCase());
            if (isEU) euStoresWithUnits++;
            if (!byCountry[country]) byCountry[country] = { stores: [], totalUnits: 0 };
            byCountry[country].stores.push({ id: idx, store, models, unitCount });
            byCountry[country].totalUnits += unitCount;
          }
        });

        setShowroomData({ byCountry, totalStoresWithUnits, euStoresWithUnits, countryCount: countriesSet.size, euTarget: 100 });
      } catch (e) {
        console.error("Showroom data load error:", e);
      }
    })();
  }, []);

  const monthsPassed = fyMonthIndex + 1;
  const revenueRunRate = revenueYtd > 0 ? (revenueYtd / monthsPassed) * 12 : 0;
  const revenueTarget = 100_000_000;
  const currentEuStores = showroomData?.euStoresWithUnits || 0;
  const currentTotalStores = showroomData?.totalStoresWithUnits || 0;
  const storeTarget = 100;
  const showroomBhagTarget = 1000;

  if (isLoading || !opspData) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <Loader2 className="w-10 h-10 text-[#185787] animate-spin" />
        <p className="text-gray-500 font-medium">Fetching Live OPSP Data...</p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    if (status === "In Progress") return "bg-blue-100 text-blue-800";
    if (status === "Complete") return "bg-green-100 text-green-800";
    return "bg-gray-100 text-gray-600";
  };

  return (
    <div className="min-h-screen bg-[#f8f8fa] font-sans pb-20 animate-in fade-in duration-500">
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 border-b border-white/20 shadow-lg">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl text-[#185787]">
              <Compass size={24} />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold tracking-tight text-gray-900">One Page Strategic Plan</h1>
              <p className="text-xs text-gray-500 font-medium">Force USA - Q1 FY27</p>
            </div>
          </div>
          <a
            href={FORCE_USA_DOC_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors shadow-sm hidden sm:block"
          >
            View Live Source Document
          </a>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">

        {/* PURPOSE & BHAG HERO */}
        <div className="bg-gradient-to-br from-[#081C28] to-black rounded-3xl p-8 md:p-10 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-bold uppercase tracking-widest mb-4">
                <Heart size={12} className="text-[#185787]" />
                Purpose (Why)
              </div>
              <h2 className="text-2xl md:text-4xl font-black tracking-tight leading-tight mb-4">
                {opspData.purpose}
              </h2>
            </div>
            <div className="md:border-l border-white/10 md:pl-8 flex flex-col justify-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-bold uppercase tracking-widest w-max mb-4">
                <Mountain size={12} className="text-[#185787]" />
                BHAG (10-30 Yrs)
              </div>
              <h2 className="text-2xl md:text-3xl font-black tracking-tight leading-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-200">
                {opspData.bhag}
              </h2>
            </div>
          </div>
        </div>

        {/* STRATEGY (ONE PHRASE) + BRAND PROMISES */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="p-2 bg-blue-100 text-[#185787] rounded-lg"><Compass size={18} /></div>
              <h3 className="font-bold text-gray-900 text-lg">Strategy (One Phrase)</h3>
            </div>
            <div className="space-y-2">
              {opspData.onePhraseStrategy.filter((s: string) => !/^FEEL\b/i.test(s)).map((s: string, i: number) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="w-6 h-6 rounded-full bg-blue-50 text-[#185787] flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</div>
                  <div className="text-sm text-gray-700 leading-snug">{s}</div>
                </div>
              ))}
            </div>
            {(() => {
              const feel = opspData.onePhraseStrategy.find((s: string) => /^FEEL\b/i.test(s));
              if (!feel) return null;
              const desc = feel.replace(/^FEEL[:\s-]*/i, "");
              return (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-start gap-3 p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                    <div className="text-xl font-black tracking-[0.2em] text-[#185787] shrink-0 leading-none pt-0.5">FEEL</div>
                    <div className="text-sm text-gray-600 leading-snug">
                      <span className="block text-[10px] uppercase font-bold text-[#185787]/70 tracking-widest mb-0.5">Key Differentiator</span>
                      {desc}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="p-2 bg-blue-100 text-[#185787] rounded-lg"><Heart size={18} /></div>
              <h3 className="font-bold text-gray-900 text-lg">Brand Promises</h3>
            </div>
            <div className="space-y-3">
              {opspData.brandPromises.map((p: string, i: number) => (
                <div key={i} className="flex gap-3 text-sm text-gray-700 leading-snug">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#185787] shrink-0 mt-1.5" /><span>{p}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mb-1">KPIs</div>
              <div className="text-sm text-gray-600">{opspData.brandPromiseKpis}</div>
            </div>
          </div>
        </div>

        {/* STRATEGIC GOALS (BHAGs) */}
        <div>
          <div className="flex items-center gap-2 mb-5">
            <div className="p-2 bg-blue-100 text-[#185787] rounded-lg"><TrendingUp size={18} /></div>
            <h3 className="font-bold text-gray-900 text-lg">Strategic Goals (BHAGs)</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl bg-[#081C28] text-white p-8 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[280px]">
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <span className="bg-[#185787] px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase">FY30 Revenue BHAG</span>
                </div>
                <div className="text-4xl md:text-5xl font-black mb-2 tracking-tight">$100.00M USD</div>
                <div className="text-gray-400 font-medium text-lg mb-6">in a financial year by FY2030</div>
              </div>
              <div className="relative z-10 pt-6 border-t border-white/10">
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <div className="text-sm text-gray-400 font-medium mb-1">Current Run Rate</div>
                    <div className="text-2xl font-bold">{formatCompactCurrency(revenueRunRate)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-[#00AC75]">{revenueTarget ? ((revenueRunRate / revenueTarget) * 100).toFixed(1) : 0}%</div>
                    <div className="text-sm text-gray-400">to target</div>
                  </div>
                </div>
                <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-[#00AC75] rounded-full transition-all duration-1000" style={{ width: `${Math.min((revenueRunRate / revenueTarget) * 100, 100)}%` }} />
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-gray-200 p-8 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[280px]">
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <span className="bg-blue-50 text-[#185787] px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase">2030 Showroom BHAG</span>
                </div>
                <div className="text-4xl md:text-5xl font-black text-[#081C28] mb-2 tracking-tight">1,000 Stores</div>
                <div className="text-gray-500 font-medium text-lg mb-6">globally with an Ai1 Unit by 2030</div>
              </div>
              <div className="relative z-10 pt-6 border-t border-gray-100">
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <div className="text-sm text-gray-500 font-medium mb-1">Current Status</div>
                    <div className="text-2xl font-bold text-[#081C28]">{currentTotalStores} Stores</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-[#185787]">{((currentTotalStores / showroomBhagTarget) * 100).toFixed(1)}%</div>
                    <div className="text-sm text-gray-500">to target</div>
                  </div>
                </div>
                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#185787] rounded-full transition-all duration-1000" style={{ width: `${Math.min((currentTotalStores / showroomBhagTarget) * 100, 100)}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* STRATEGIC PILLARS (3-5 YEARS) */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="p-2 bg-blue-100 text-[#185787] rounded-lg"><Target size={18} /></div>
            <h3 className="font-bold text-gray-900 text-lg">Strategic Pillars (3-5 Years)</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {opspData.strategicPillars.map((p: string, i: number) => (
              <div key={i} className="flex gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 items-center">
                <div className="w-7 h-7 rounded-full bg-[#185787] text-white flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</div>
                <div className="text-sm font-semibold text-gray-800 leading-snug">{p}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ONE YEAR GOALS (FY2027) */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 text-[#185787] rounded-lg"><TrendingUp size={18} /></div>
              <h3 className="font-bold text-gray-900 text-lg">One Year Goals (FY2027)</h3>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mb-0.5">Profit / X</div>
              <div className="text-sm font-bold text-gray-700">{opspData.profitX}</div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Revenue</div>
              <div className="text-xl font-black text-[#081C28]">{opspData.fy27Goals.revenue}</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Gross Profit</div>
              <div className="text-xl font-black text-[#081C28]">{opspData.fy27Goals.grossProfit}</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">GP %</div>
              <div className="text-xl font-black text-[#185787]">{opspData.fy27Goals.gpPercent}</div>
            </div>
          </div>
        </div>

        {/* CRITICAL NUMBER */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="p-2 bg-blue-100 text-[#185787] rounded-lg"><Target size={18} /></div>
            <div>
              <h3 className="font-bold text-gray-900 text-lg">Critical Number</h3>
              <p className="text-xs text-gray-500">All-In-One Showroom Presence</p>
            </div>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div className="pb-6 border-b-2 border-[#185787]">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-base font-bold text-[#185787]"># Stores in EU + UK with an Ai1 Unit</p>
                  <span className="text-sm font-medium text-gray-500 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">Target: 100 Stores</span>
                </div>
                <div className="flex items-end gap-4">
                  <p className="text-6xl font-extrabold text-[#185787]">{showroomData?.euStoresWithUnits || 0}</p>
                  <div className="pb-2">
                    <span className={`px-3 py-1 rounded-md text-sm font-medium ${(showroomData?.euStoresWithUnits || 0) >= (showroomData?.euTarget || 100) ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                      {showroomData?.euTarget ? `${(((showroomData?.euStoresWithUnits || 0) / showroomData.euTarget) * 100).toFixed(0)}%` : "N/A"}
                    </span>
                  </div>
                </div>
                {showroomData && showroomData.euStoresWithUnits < showroomData.euTarget && (
                  <p className="text-sm text-orange-600 mt-2">{showroomData.euTarget - showroomData.euStoresWithUnits} more stores needed to reach target</p>
                )}
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1"># Stores with an Ai1 Unit</p>
                  <p className="text-3xl font-bold text-[#081C28]">{showroomData?.totalStoresWithUnits || 0}</p>
                </div>
                <p className="text-sm text-gray-500">Across {showroomData?.countryCount || 0} {showroomData?.countryCount === 1 ? "country" : "countries"}</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-5 bg-[#185787] rounded-full" />
                <h4 className="text-base font-bold text-gray-800">Store Breakdown</h4>
              </div>
              <ShowroomTable data={showroomData} />
            </div>
          </div>
        </div>

        {/* FOUNDATION ROW */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="p-2 bg-gray-100 text-gray-700 rounded-lg"><Star size={18} /></div>
              <h3 className="font-bold text-gray-900 text-lg">Core Values</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {opspData.coreValues.map((val: string, idx: number) => (
                <div key={idx} className="bg-gray-50 border border-gray-100 px-3 py-2 rounded-lg text-sm font-semibold text-gray-700 flex items-center gap-2 w-full sm:w-auto flex-1 text-center justify-center min-w-[120px]">
                  {val}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 lg:col-span-2">
            <div className="flex items-center gap-2 mb-5">
              <div className="p-2 bg-gray-100 text-gray-700 rounded-lg"><MapPin size={18} /></div>
              <h3 className="font-bold text-gray-900 text-lg">Sandbox / Ideal Client</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100/50">
                <div className="text-xs font-bold uppercase tracking-wider text-[#185787] mb-1">Channel</div>
                <div className="text-gray-900 font-semibold text-sm">{opspData.sandbox.channel}</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Geography</div>
                <div className="text-gray-900 font-semibold text-sm">{opspData.sandbox.geography}</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Offering</div>
                <div className="text-gray-900 font-semibold text-sm">{opspData.sandbox.offering}</div>
              </div>
            </div>
          </div>
        </div>

        {/* FY27 INITIATIVES */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-300 p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 text-[#185787] rounded-lg"><Flag size={18} /></div>
              <h3 className="font-bold text-gray-900 text-lg">Key Initiatives - FY2027</h3>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold text-gray-400 mb-1">FY30 Revenue Target</div>
              <div className="text-lg font-black text-gray-900">{opspData.fy30Revenue}</div>
            </div>
          </div>

          <div className="space-y-3">
            {opspData.initiatives.map((init: any, i: number) => (
              <div key={i} className="flex gap-3 p-3 bg-gray-50 rounded-xl hover:bg-blue-50/50 transition-colors border border-transparent hover:border-blue-100">
                <div className="w-6 h-6 rounded-full bg-[#185787] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-700 leading-snug">{init.text}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] font-bold text-[#185787] bg-blue-50 px-2 py-0.5 rounded">{init.owner}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${getStatusColor(init.status)}`}>{init.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SWOT */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-green-100 text-green-700 rounded-lg"><Shield size={18} /></div>
              <h3 className="font-bold text-gray-900 text-lg">Strengths</h3>
            </div>
            <div className="space-y-2">
              {opspData.strengths.map((s: string, i: number) => (
                <div key={i} className="flex gap-2 text-sm text-gray-700"><span className="text-green-500 shrink-0 mt-0.5">+</span><span>{s}</span></div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-yellow-100 text-yellow-700 rounded-lg"><AlertTriangle size={18} /></div>
              <h3 className="font-bold text-gray-900 text-lg">Weaknesses</h3>
            </div>
            <div className="space-y-2">
              {opspData.weaknesses.map((w: string, i: number) => (
                <div key={i} className="flex gap-2 text-sm text-gray-700"><span className="text-yellow-500 shrink-0 mt-0.5">-</span><span>{w}</span></div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-blue-100 text-[#185787] rounded-lg"><Lightbulb size={18} /></div>
              <h3 className="font-bold text-gray-900 text-lg">Opportunities</h3>
            </div>
            <div className="space-y-2">
              {opspData.opportunities.map((o: string, i: number) => (
                <div key={i} className="flex gap-2 text-sm text-gray-700"><span className="text-blue-500 shrink-0 mt-0.5">{i + 1}.</span><span>{o}</span></div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-red-100 text-red-700 rounded-lg"><AlertTriangle size={18} /></div>
              <h3 className="font-bold text-gray-900 text-lg">Trends / Threats</h3>
            </div>
            <div className="space-y-2">
              {opspData.threats.map((t: string, i: number) => (
                <div key={i} className="flex gap-2 text-sm text-gray-700"><span className="text-red-500 shrink-0 mt-0.5">!</span><span>{t}</span></div>
              ))}
            </div>
          </div>
        </div>

        {/* PEOPLE (REPUTATION DRIVERS) + THEME */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="p-2 bg-blue-100 text-[#185787] rounded-lg"><Users size={18} /></div>
              <h3 className="font-bold text-gray-900 text-lg">People (Reputation Drivers)</h3>
            </div>
            <div className="space-y-3">
              {[
                { label: "Employees", value: opspData.people.employees },
                { label: "Customers", value: opspData.people.customers },
                { label: "Shareholders", value: opspData.people.shareholders },
              ].map((r) => (
                <div key={r.label} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#185787] mb-1">{r.label}</div>
                  <div className="text-sm text-gray-700 leading-snug">{r.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="p-2 bg-blue-100 text-[#185787] rounded-lg"><Rocket size={18} /></div>
              <h3 className="font-bold text-gray-900 text-lg">Theme (Q1 FY27)</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: "Theme", value: opspData.theme.theme },
                { label: "Measurable Target", value: opspData.theme.target },
                { label: "Celebration", value: opspData.theme.celebration },
                { label: "Reward", value: opspData.theme.reward },
              ].map((r) => (
                <div key={r.label} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">{r.label}</div>
                  <div className="text-sm text-gray-700 font-medium">{r.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* PROCESS */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="p-2 bg-gray-100 text-gray-700 rounded-lg"><Rocket size={18} /></div>
            <h3 className="font-bold text-gray-900 text-lg">Process (Productivity Drivers)</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Make / Buy</div>
              <div className="text-sm text-gray-900 font-medium">{opspData.processes.makeBuy}</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Sell</div>
              <div className="text-sm text-gray-900 font-medium">{opspData.processes.sell}</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Recordkeeping</div>
              <div className="text-sm text-gray-900 font-medium">{opspData.processes.recordkeeping}</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
