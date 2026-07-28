import React, { useState, useEffect, useMemo } from 'react';
import { Target, Flag, Users, Mountain, Compass, MapPin, Zap, Rocket, Star, Heart, TrendingUp, BarChart, ChevronRight, Loader2, PhoneIncoming, Info } from 'lucide-react';
import { ResponsiveContainer, BarChart as RechartsBarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Label } from 'recharts';
import { GAF_COLORS } from '../constants';
import { fetchBHAGData } from '../services/dataService';
import { BHAGData, InboundCallData } from '../types';

const TARGET_AOV = 1512.16; // $1454 * 1.04
const TARGET_CALLS = 40;

export default function OPSPDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [opspData, setOpspData] = useState<any>(null);
  const [bhagData, setBhagData] = useState<BHAGData | null>(null);

  // Fallback data in case HTML parsing fails or format changes
  const fallbackData = {
    coreValues: ["PEOPLE CENTRIC", "NIMBAGILITY", "CONTINUOUS IMPROVEMENT", "COLLABORATION", "EMPATHY", "INCLUSIVITY"],
    purpose: "Improve lives through fitness and wellness",
    bhag: "Design and deliver 10,000+ home gyms annually by 2030",
    brandPromises: [
      "Your Gym Designed for your space in real time",
      "Love your design or our fitness consultants will re-design it with you - until you love it"
    ],
    fy30Revenue: "$40,300,000",
    keyThrusts: [
      { title: "Win the Home Gym Builder", desc: "Become the #1 choice for home gym builders in Australia" },
      { title: "Own the End-to-End Home Gym Solution", desc: "Deliver a seamless design, packages, purchase and CX experience" },
      { title: "Simplify to Scale", desc: "Reduce complexity across SKUs, categories, and channels" },
      { title: "Build a High-Performance Profitable Growth Engine", desc: "Increase GM%, AOV, conversion, and customer quality" },
      { title: "Power with a Reliable Supply and Data Engine", desc: "Ensure availability, margin, and data-driven decisions" }
    ],
    fy27Revenue: "$25,239,066.87",
    fy27GPMargin: "37.19%",
    initiatives: [
      "Successfully pivot our brand positioning and digital acquisition to champion the Home Gym Builder by developing and executing on a Home Gym Builder marketing strategy - including brand positioning, channel plan, website direction, and the AI Gym Designer MVP",
      "By 30 June 2027, transform GAF into an industry-leading powerhouse by rationalising product and establishing a high-margin core range that focuses on GAF's best-performing customers",
      "Build a scalable, profitable wholesale channel that strengthens dealer relationships and strategically aligns with GAF Retail",
      "Improve GMROI performance through disciplined inventory optimisation, improved stock velocity, and stronger category margin management."
    ],
    q4AovProgress: "5%",
    q4GpProgress: "42.6%"
  };

  useEffect(() => {
    let cancelled = false;

    // BHAG charts fetch their own CSVs and must never block the OPSP text render.
    // Fire-and-forget: the chart useMemos already handle a null/empty result.
    fetchBHAGData()
        .then((res) => { if (!cancelled) setBhagData(res); })
        .catch((bhagErr) => console.warn("BHAG fetch failed", bhagErr));

    // Google publishes the doc cross-origin, so we proxy it. allorigins is flaky
    // (rate-limits / hangs), which used to leave the tab stuck on the loader — so we
    // race a timeout and fall back to a second proxy before degrading to static data.
    const buildProxyUrls = (docUrl: string) => [
        `https://api.allorigins.win/get?url=${encodeURIComponent(docUrl)}`,
        `https://corsproxy.io/?url=${encodeURIComponent(docUrl)}`,
    ];

    const fetchViaProxy = async (proxyUrl: string): Promise<string | null> => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        try {
            const res = await fetch(proxyUrl, { signal: controller.signal });
            if (!res.ok) throw new Error(`proxy HTTP ${res.status}`);
            const contentType = res.headers.get('content-type') || '';
            // allorigins wraps the payload as JSON { contents }; corsproxy returns raw HTML.
            if (contentType.includes('application/json')) {
                const json = await res.json();
                return json.contents || null;
            }
            return await res.text();
        } finally {
            clearTimeout(timer);
        }
    };

    const loadOpsp = async () => {
        const docUrl = `https://docs.google.com/document/d/e/2PACX-1vRKUADNpV9pz1kwD44mxS2sdmTKqhQ8E64f9d8AnODzC1ekkZeL6OU9ND6OrofrYeQFuJfiOJMlSgzg/pub?_t=${Date.now()}`;

        let htmlText: string | null = null;
        for (const proxyUrl of buildProxyUrls(docUrl)) {
            try {
                htmlText = await fetchViaProxy(proxyUrl);
                if (htmlText) break;
            } catch (e) {
                console.warn("OPSP proxy failed, trying next.", e);
            }
        }
        if (!htmlText) {
            console.warn("All OPSP proxies failed, utilizing fallback data.");
            if (!cancelled) setOpspData(fallbackData);
            return;
        }

        try {
            const doc = new DOMParser().parseFromString(htmlText, 'text/html');
            doc.querySelectorAll('script, style, head').forEach((el: Element) => el.remove());

            // Google publishes the doc as a SINGLE line with no newlines, so the old
            // textContent.split('\n') parse silently matched nothing and every field fell
            // back to hardcoded data (incl. the FY26-era Key Initiatives). Parse the DOM
            // structure directly instead — newline-independent and deterministic.
            const looksLikeCode = (s: string) =>
                /[{};]|=>|\bfunction\b|prototype|\bvar\b|typeof/.test(s);
            const clean = (s: string | null | undefined) =>
                (s && !looksLikeCode(s) ? s.trim() : null);

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

            // Read the Initiative column (2nd cell) of numbered rows in the table that
            // follows a given heading (e.g. "Key Initiatives", "Key Thrusts").
            const rowsOfTableAfter = (headingMatch: RegExp): string[] => {
                const heading = Array.from(doc.querySelectorAll('h1,h2,h3,h4,p,span'))
                    .find((el) => headingMatch.test(el.textContent || ''));
                if (!heading) return [];
                const tbl = Array.from(doc.querySelectorAll('table')).find(
                    (t) => heading.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING);
                if (!tbl) return [];
                const out: string[] = [];
                for (const row of Array.from(tbl.querySelectorAll('tr')).slice(1)) {
                    const cells = Array.from(row.querySelectorAll('td')).map((c) => (c.textContent || '').trim());
                    if (cells.length >= 2 && /^\d+$/.test(cells[0]) && cells[1]) out.push(cells[1]);
                }
                return out;
            };

            const parsed = { ...fallbackData };

            const purpose = clean(valueAfter("Purpose (Why)"));
            if (purpose) parsed.purpose = purpose;

            const bhag = clean(valueAfter("BHAG (Big Hairy Audacious Goal)"));
            if (bhag) parsed.bhag = bhag;

            const bpIdx = blocks.findIndex((b) => /Brand Promises/i.test(b));
            if (bpIdx !== -1) {
                const p1 = clean(blocks[bpIdx + 1]);
                const p2 = clean(blocks[bpIdx + 2]);
                if (p1 && p2) parsed.brandPromises = [p1, p2];
            }

            const fy30Rev = valueAfter("FY30", { exact: true });
            if (fy30Rev && fy30Rev.includes("$") && !looksLikeCode(fy30Rev)) parsed.fy30Revenue = fy30Rev;

            // FY27 numbers live in the "One Year - Goals FY2027" table; scope the search
            // after that heading so we don't pick up the 3-5yr (FY2030) figures.
            const oyIdx = blocks.findIndex((b) => /One Year.*FY2027/i.test(b));
            const from = oyIdx !== -1 ? oyIdx : 0;

            const fy27Rev = valueAfter("REVENUE", { exact: true, from });
            if (fy27Rev && fy27Rev.includes("$") && !looksLikeCode(fy27Rev)) parsed.fy27Revenue = fy27Rev;

            const fy27Gp = valueAfter("GROSS PROFIT %", { exact: true, from });
            if (fy27Gp && fy27Gp.includes("%") && !looksLikeCode(fy27Gp)) parsed.fy27GPMargin = fy27Gp;

            const thrusts = rowsOfTableAfter(/Key Thrusts/i).map((t) => {
                const [title, ...rest] = t.split(' - ');
                return { title: title.trim(), desc: rest.join(' - ').trim() };
            });
            if (thrusts.length) parsed.keyThrusts = thrusts;

            const initiatives = rowsOfTableAfter(/Key Initiatives/i).filter((x) => !looksLikeCode(x));
            if (initiatives.length) parsed.initiatives = initiatives;

            if (!cancelled) setOpspData(parsed);
        } catch (e) {
            console.warn("OPSP parse failed, utilizing fallback data.", e);
            if (!cancelled) setOpspData(fallbackData);
        }
    };

    loadOpsp().finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, []);

  const weeklyCallsData = useMemo(() => {
    if (!bhagData?.inboundCallData) return [];
    
    const weeks: Record<string, { weekStart: Date, calls: number, daysData: number }> = {};
    
    bhagData.inboundCallData.forEach(day => {
        const d = new Date(day.date);
        const dayOfWeek = d.getDay();
        const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        monday.setHours(0,0,0,0);
        
        const key = monday.toISOString();
        if (!weeks[key]) {
            weeks[key] = { weekStart: monday, calls: 0, daysData: 0 };
        }
        weeks[key].calls += day.calls;
        weeks[key].daysData += 1;
    });

    const sortedWeeks = Object.values(weeks).sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());
    
    return sortedWeeks.slice(-12).map(w => {
        const isCurrentWeek = (new Date().getTime() - w.weekStart.getTime()) < 7 * 24 * 60 * 60 * 1000;
        
        let projected = w.calls;
        if (isCurrentWeek && w.daysData < 7 && w.daysData > 0) {
            projected = Math.round((w.calls / w.daysData) * 7);
        }

        return {
            name: `Week of ${w.weekStart.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`,
            shortName: w.weekStart.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
            calls: w.calls,
            projected: projected,
            isCurrent: isCurrentWeek
        };
    });

  }, [bhagData]);

  const dailyAOVData = useMemo(() => {
      if (!bhagData?.aovData) return [];
      
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const completeData = bhagData.aovData.filter(d => {
          const dataDate = new Date(d.date);
          dataDate.setHours(0, 0, 0, 0);
          return dataDate.getTime() < now.getTime();
      });

      const last30 = completeData.slice(-30);
      return last30.map(d => ({
          date: d.date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
          aov: d.aov,
          fullDate: d.date
      }));
  }, [bhagData]);

  const currentMonthToDateAOV = useMemo(() => {
      if (!bhagData?.aovData) return 0;
      
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      const mtdData = bhagData.aovData.filter(d => {
          return d.date.getMonth() === currentMonth && d.date.getFullYear() === currentYear;
      });

      if (mtdData.length === 0) return 0;

      const totalRevenue = mtdData.reduce((sum, d) => sum + d.revenue, 0);
      const totalOrders = mtdData.reduce((sum, d) => sum + d.orders, 0);

      return totalOrders > 0 ? totalRevenue / totalOrders : 0;
  }, [bhagData]);

  const currentWeekCalls = weeklyCallsData.length > 0 ? weeklyCallsData[weeklyCallsData.length - 1] : null;

  if (isLoading || !opspData) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
        <p className="text-gray-500 font-medium">Fetching Live OPSP Data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f8fa] font-sans pb-20 animate-in fade-in duration-500">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 border-b border-white/20 shadow-lg">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-xl text-orange-600">
                    <Compass size={24} />
                </div>
                <div>
                    <h1 className="text-lg md:text-xl font-bold tracking-tight text-gray-900">One Page Strategic Plan</h1>
                    <p className="text-xs text-gray-500 font-medium">Q4 FY26 • 01/04/2026 - 30/06/2026</p>
                </div>
            </div>
            <a 
              href="https://docs.google.com/document/d/e/2PACX-1vRKUADNpV9pz1kwD44mxS2sdmTKqhQ8E64f9d8AnODzC1ekkZeL6OU9ND6OrofrYeQFuJfiOJMlSgzg/pub" 
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
        <div className="bg-gradient-to-br from-gray-900 to-black rounded-3xl p-8 md:p-10 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-bold uppercase tracking-widest mb-4">
                        <Heart size={12} className="text-orange-400" />
                        Purpose (Why)
                    </div>
                    <h2 className="text-2xl md:text-4xl font-black tracking-tight leading-tight mb-4 font-montserrat">
                        {opspData.purpose}
                    </h2>
                    
                    <div className="mt-8">
                        <div className="uppercase tracking-widest text-[10px] text-gray-400 font-bold mb-2">Brand Promises</div>
                        <p className="text-sm md:text-base text-gray-300 font-medium leading-relaxed border-l-2 border-orange-500 pl-4">
                            {opspData.brandPromises[0]} <br className="hidden md:block"/>
                            {opspData.brandPromises[1]}
                        </p>
                    </div>
                </div>
                
                <div className="md:border-l border-white/10 md:pl-8 flex flex-col justify-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-bold uppercase tracking-widest w-max mb-4">
                        <Mountain size={12} className="text-orange-400" />
                        BHAG (10-30 Yrs)
                    </div>
                    <h2 className="text-2xl md:text-3xl font-black tracking-tight leading-tight text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-200 font-montserrat">
                        {opspData.bhag}
                    </h2>
                </div>
            </div>
        </div>

        {/* CRITICAL NUMBERS SECTION (Now live here) */}
        <div>
            <div className="flex items-center gap-2 mb-6 mt-4">
                <Target className="text-orange-600" size={24} />
                <h2 className="text-xl font-bold text-gray-900">Critical Numbers (FY26)</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* METRIC 1: AOV */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <div className="flex items-center gap-2 mb-1 group">
                               <div className="p-1.5 bg-green-100 text-green-700 rounded-lg">
                                  <TrendingUp size={16} />
                               </div>
                               <h3 className="font-bold text-gray-900">Increase GAF AOV by 4%</h3>
                               <a 
                                  href="https://docs.google.com/spreadsheets/d/1nE1DXvDAg3ozg4iSoSFL4YXAk9oVo2Etbtz9qJZ4U1g/edit?gid=176781390#gid=176781390" 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-gray-400 hover:text-blue-500 transition-colors ml-1"
                                  title="View Source Spreadsheet"
                               >
                                  <Info size={16} />
                               </a>
                            </div>
                            <p className="text-xs text-gray-500 ml-9">Baseline: $1454 <span className="mx-1">•</span> Target: <span className="font-bold text-green-600">${TARGET_AOV.toFixed(0)}</span></p>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-bold text-gray-900">${currentMonthToDateAOV.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            <div className="text-xs text-gray-500 font-medium mb-1">Month to Date</div>
                            <div className={`text-xs font-bold ${currentMonthToDateAOV >= TARGET_AOV ? 'text-green-600' : 'text-red-500'}`}>
                                {currentMonthToDateAOV >= TARGET_AOV ? 'On Track' : `${((currentMonthToDateAOV/TARGET_AOV)*100).toFixed(1)}% to Target`}
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <RechartsBarChart data={dailyAOVData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" axisLine={false} tickLine={false} dy={10} />
                                <YAxis 
                                  tickFormatter={(v) => `$${v}`} 
                                  domain={['auto', 'auto']} 
                                  tick={{ fontSize: 11 }} 
                                  stroke="#9ca3af" 
                                  axisLine={false} 
                                  tickLine={false}
                                />
                                <Tooltip 
                                  formatter={(val: number) => [`$${val.toLocaleString(undefined, {maximumFractionDigits: 0})}`, 'Daily AOV']}
                                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                />
                                <ReferenceLine y={TARGET_AOV} stroke={GAF_COLORS.green} strokeDasharray="3 3">
                                    <Label value="Target $1512" position="insideTopRight" fill={GAF_COLORS.green} fontSize={10} />
                                </ReferenceLine>
                                <Bar 
                                  dataKey="aov" 
                                  fill={GAF_COLORS.orange} 
                                  radius={[4, 4, 0, 0]} 
                                  barSize={20}
                                />
                            </RechartsBarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* METRIC 2: INBOUND CALLS */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                               <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                                  <PhoneIncoming size={16} />
                               </div>
                               <h3 className="font-bold text-gray-900">Weekly Inbound Sales Calls</h3>
                            </div>
                            <p className="text-xs text-gray-500 ml-9">Maintain 40+ calls per week</p>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-bold text-gray-900">
                                {currentWeekCalls ? (currentWeekCalls.isCurrent ? `${currentWeekCalls.calls} (${currentWeekCalls.projected} proj.)` : currentWeekCalls.calls) : 0}
                            </div>
                            <div className={`text-xs font-bold ${currentWeekCalls && currentWeekCalls.projected >= TARGET_CALLS ? 'text-green-600' : 'text-red-500'}`}>
                                {currentWeekCalls && currentWeekCalls.projected >= TARGET_CALLS ? 'On Track' : 'Below Target'}
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <RechartsBarChart data={weeklyCallsData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                                <XAxis dataKey="shortName" tick={{ fontSize: 11 }} stroke="#9ca3af" axisLine={false} tickLine={false} dy={10} />
                                <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" axisLine={false} tickLine={false} />
                                <Tooltip 
                                  formatter={(val: number, name: string, props: any) => {
                                      if (name === 'projected') return [val, 'Projected End of Week'];
                                      return [val, 'Calls So Far'];
                                  }}
                                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                />
                                <ReferenceLine y={TARGET_CALLS} stroke={GAF_COLORS.green} strokeDasharray="3 3">
                                    <Label value="Target 40" position="insideTopRight" fill={GAF_COLORS.green} fontSize={10} />
                                </ReferenceLine>
                                <Bar dataKey="calls" fill={GAF_COLORS.blue} radius={[4, 4, 0, 0]} barSize={30} />
                                <Bar dataKey="projected" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={30} style={{ opacity: 0.3 }} />
                            </RechartsBarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>
        </div>

        {/* FOUNDATION ROW */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Core Values */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-5">
                    <div className="p-2 bg-gray-100 text-gray-700 rounded-lg"><Star size={18} /></div>
                    <h3 className="font-bold text-gray-900 text-lg">Core Values</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                    {opspData.coreValues.map((val: string, idx: number) => (
                        <div key={idx} className="bg-gray-50 border border-gray-100 px-3 py-2 rounded-lg text-sm font-semibold text-gray-700 flex items-center gap-2 w-full sm:w-auto flex-1 text-center justify-center">
                            {val}
                        </div>
                    ))}
                </div>
            </div>

            {/* Sandbox / Ideal Client */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 lg:col-span-2">
                <div className="flex items-center gap-2 mb-5">
                    <div className="p-2 bg-gray-100 text-gray-700 rounded-lg"><MapPin size={18} /></div>
                    <h3 className="font-bold text-gray-900 text-lg">Sandbox / Ideal Client</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-orange-50/50 rounded-xl border border-orange-100/50 transition-colors">
                        <div className="text-xs font-bold uppercase tracking-wider text-orange-600 mb-1">Primary Market</div>
                        <div className="text-gray-900 font-semibold mb-1">Home Gym Builders (B2C)</div>
                        <div className="text-xs text-gray-500 font-medium">70% of Focus</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 transition-colors">
                        <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Secondary Market</div>
                        <div className="text-gray-900 font-semibold mb-1">B2B Commercial / Mining / ADF</div>
                        <div className="text-xs text-gray-500 font-medium">30% of Focus</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 transition-colors sm:col-span-2 flex justify-between items-center px-6">
                        <div>
                            <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Channel</div>
                            <div className="text-gray-900 font-semibold text-sm">Ecommerce + Assisted + Showroom</div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Geography</div>
                            <div className="text-gray-900 font-semibold text-sm">Australia</div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Offering</div>
                            <div className="text-gray-900 font-semibold text-sm">End-to-End Solutions</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* TIMELINE GOALS (3-5 YEARS & ONE YEAR) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* 3-5 Years */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-300 p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gray-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-gray-100 text-gray-700 rounded-lg"><Target size={18} /></div>
                        <h3 className="font-bold text-gray-900 text-lg">3-5 Years (FY2030)</h3>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] uppercase font-bold text-gray-400 mb-1">Revenue Target</div>
                        <div className="text-xl font-black text-gray-900">{opspData.fy30Revenue}</div>
                    </div>
                </div>
                
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Key Thrusts / Capabilities</h4>
                <div className="space-y-3">
                    {opspData.keyThrusts.map((thrust: any, i: number) => (
                        <div key={i} className="flex gap-3 group">
                            <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 group-hover:bg-orange-100 group-hover:text-orange-600 transition-colors">
                                {i + 1}
                            </div>
                            <div>
                                <div className="text-sm text-gray-900 font-bold mb-0.5">{thrust.title}</div>
                                <div className="text-xs text-gray-500">{thrust.desc}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 1 Year */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-300 p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><Flag size={18} /></div>
                        <h3 className="font-bold text-gray-900 text-lg">One Year (FY2027)</h3>
                    </div>
                    <div className="text-right flex gap-4">
                        <div>
                            <div className="text-[10px] uppercase font-bold text-gray-400 mb-1">Revenue</div>
                            <div className="text-lg font-black text-gray-900">{opspData.fy27Revenue}</div>
                        </div>
                        <div>
                            <div className="text-[10px] uppercase font-bold text-gray-400 mb-1">GP Margin</div>
                            <div className="text-lg font-black text-orange-600">{opspData.fy27GPMargin}</div>
                        </div>
                    </div>
                </div>

                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Key Initiatives (Annual Priorities)</h4>
                <div className="space-y-3">
                    {opspData.initiatives.map((init: string, i: number) => (
                        <div key={i} className="flex gap-3 p-3 bg-gray-50 rounded-xl hover:bg-orange-50/50 transition-colors border border-transparent hover:border-orange-100">
                            <div className="w-2 h-2 rounded-full bg-orange-400 shrink-0 mt-1.5" />
                            <div className="text-sm font-medium text-gray-700 leading-snug">{init}</div>
                        </div>
                    ))}
                </div>
            </div>

        </div>

        {/* CURRENT QUARTER SECTION */}
        <div className="bg-gray-900 rounded-2xl shadow-md border-gray-800 p-6 md:p-8 text-white relative overflow-hidden">
            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-gray-500"></div>
            
            <div className="flex items-center gap-2 mb-8">
                <div className="p-2 bg-white/10 text-white rounded-lg"><Rocket size={20} /></div>
                <h3 className="font-bold text-xl">Quarterly Critical Numbers (Q4 FY26)</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white/5 rounded-2xl p-6 border border-white/10 backdrop-blur-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="font-bold text-lg">Increase GAF AOV by 4%</div>
                        <div className="px-2 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded">Green</div>
                    </div>
                    <div className="flex justify-between items-end border-t border-white/10 pt-4 mt-4">
                        <div>
                            <div className="text-[10px] uppercase text-gray-400 font-bold mb-1">Current Progress</div>
                            <div className="text-2xl font-black">{opspData.q4AovProgress} <span className="text-sm font-medium text-gray-400 ml-1">Achieved</span></div>
                        </div>
                        <div>
                            <div className="text-xs text-green-400 font-semibold flex items-center gap-1">
                                <TrendingUp size={14}/> Target Exceeded
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white/5 rounded-2xl p-6 border border-white/10 backdrop-blur-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="font-bold text-lg">Increase GAF IDC GP% to &gt;40%</div>
                        <div className="px-2 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded">Super Green</div>
                    </div>
                    <div className="flex justify-between items-end border-t border-white/10 pt-4 mt-4">
                        <div>
                            <div className="text-[10px] uppercase text-gray-400 font-bold mb-1">Current Progress</div>
                            <div className="text-2xl font-black text-green-400">{opspData.q4GpProgress} <span className="text-sm font-medium text-gray-400 ml-1">Avg Margin</span></div>
                        </div>
                        <div>
                            <div className="text-xs text-green-400 font-semibold flex items-center gap-1">
                                <TrendingUp size={14}/> Target Exceeded
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
