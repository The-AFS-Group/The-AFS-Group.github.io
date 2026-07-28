
import React, { useState, useEffect } from "react";
import { DashboardSkeleton } from './DashboardSkeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Calendar, BarChart3, ShoppingCart, DollarSign, Loader2, PhoneIncoming, PhoneOutgoing, TrendingUp, TrendingDown, Video, Heart, MessageCircle, Repeat, Package, Trophy, PieChart as PieChartIcon, Activity, ChevronDown, ChevronRight, ChevronLeft, Target, Info, Eye, Percent, ExternalLink, Image as ImageIcon, MapPin, ArrowUp, ArrowDown } from "lucide-react";
import { fetchDashboardData, fetchProductInsightsData, fetchInstagramData, getCachedData, isCacheStale } from "../services/dataService";
import { BrandConfig, BrandData, BrandData as BrandDataType, BrandBudget, BrandInstagram, ProductInsightsData, ProductPerformance } from "../types";
import { GAF_COLORS, CHART_COLORS } from "../constants";
import { UpdatingBadge } from "./UpdatingBadge";

const DATA_SOURCE_URL = "https://docs.google.com/spreadsheets/d/17an6G2laOVcI8t0nDNsRkiax-ihYUIUqGtviyfaX9Gw/edit?gid=1965640519#gid=1965640519";

const brandConfig: BrandConfig = {
  GAF: {
    colors: { accent: "#ABB99C", gradient: "from-orange-500 to-red-500" },
    currencySymbol: "$",
    targetMargin: 38,
  },
  REVEL: {
    colors: { accent: "#ABB99C", gradient: "from-gray-800 to-black" },
    currencySymbol: "$",
    targetMargin: 40,
  }
};

interface InstagramPostCardProps {
  post: any;
  index: number;
  brand: any;
}

const InstagramPostCard: React.FC<InstagramPostCardProps> = ({ post, index, brand }) => {
  const [hasError, setHasError] = useState(false);
  const displayInteractions = post.likes + post.comments + post.shares;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 flex-shrink-0 w-72 flex flex-col h-full snap-center group">
      <div className="relative aspect-[9/16] bg-gray-100 flex items-center justify-center overflow-hidden rounded-t-xl">
        {!hasError && post.thumbnailUrl ? (
          <img
            src={post.thumbnailUrl}
            alt="Instagram thumbnail"
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            onError={() => setHasError(true)}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-gray-400 bg-gray-100 w-full h-full rounded-t-xl">
            <Video size={48} strokeWidth={1.5} />
          </div>
        )}
        <div
          className="absolute top-4 left-4 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md z-10"
          style={{ backgroundColor: brand.colors.accent }}
        >
          {index + 1}
        </div>
        <a 
          href={post.permalink} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors z-20"
        />
      </div>
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🔥</span>
          <span className="font-bold text-gray-900 text-sm">
            {displayInteractions.toLocaleString()} interactions
          </span>
        </div>
        <div className="flex-1 mb-6">
           <p className="text-xs text-gray-600 line-clamp-4 leading-relaxed">
            {post.caption}
           </p>
        </div>
        <div className="space-y-3 pt-4 border-t border-gray-100">
           <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500 font-medium">Views</span>
              <span className="font-bold text-gray-900">{post.views.toLocaleString()}</span>
           </div>
           <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500 font-medium">Reach</span>
              <span className="font-bold text-gray-900">{post.reach.toLocaleString()}</span>
           </div>
           <div className="flex items-center gap-5 text-xs text-gray-500 pt-2">
               <div className="flex items-center gap-1.5">
                  <Heart size={14} className="text-red-500 fill-red-500" />
                  <span className="font-medium text-gray-700">{post.likes}</span>
               </div>
               <div className="flex items-center gap-1.5">
                  <MessageCircle size={14} className="text-gray-400" />
                  <span className="font-medium text-gray-700">{post.comments}</span>
               </div>
               <div className="flex items-center gap-1.5">
                  <Repeat size={14} className="text-gray-400" />
                  <span className="font-medium text-gray-700">{post.shares}</span>
               </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const CustomYAxisTick = ({ x, y, payload }: any) => {
  return (
    <g transform={`translate(${x},${y})`}>
      <foreignObject x={-240} y={-10} width={230} height={20} style={{ textAlign: "right" }}>
        <div className="text-xs text-gray-600 truncate font-medium" style={{ fontFamily: "'Open Sans', sans-serif" }} title={payload.value}>
          {payload.value}
        </div>
      </foreignObject>
    </g>
  );
};

export default function SalesDashboard() {
  const activeBrand = "REVEL";
  const [metricType, setMetricType] = useState<"created" | "fulfilled">("created");
  const [progress, setProgress] = useState(0);
  
  const dashboardCacheKey = 'dashboard_data';
  const productCacheKey = 'product_insights_data';
  const igCacheKey = 'instagram_data';
  const cachedDashboard = !isCacheStale(dashboardCacheKey) ? getCachedData<any>(dashboardCacheKey) : null;
  const cachedProduct = !isCacheStale(productCacheKey) ? getCachedData<any>(productCacheKey) : null;
  const cachedIg = !isCacheStale(igCacheKey) ? getCachedData<any>(igCacheKey) : null;

  const [isUpdating, setIsUpdating] = useState(!cachedDashboard || !cachedProduct);
  const [isIgUpdating, setIsIgUpdating] = useState(!cachedIg);

  const [data, setData] = useState<BrandDataType>(cachedDashboard?.data || { GAF: [], REVEL: [] });
  const [budgetData, setBudgetData] = useState<BrandBudget>(cachedDashboard?.budgetData || { GAF: [], REVEL: [] });
  const [quarterData, setQuarterData] = useState<BrandDataType>(cachedDashboard?.quarterData || { GAF: [], REVEL: [] });
  const [quarterBudgetData, setQuarterBudgetData] = useState<BrandBudget>(cachedDashboard?.quarterBudgetData || { GAF: [], REVEL: [] });
  const [allData, setAllData] = useState<BrandDataType>(cachedDashboard?.allData || { GAF: [], REVEL: [] });
  const [allBudgetData, setAllBudgetData] = useState<BrandBudget>(cachedDashboard?.allBudgetData || { GAF: [], REVEL: [] });
  const [igData, setIgData] = useState<BrandInstagram>(cachedIg || { GAF: [], REVEL: [] });
  const [periodStats, setPeriodStats] = useState<any>(cachedDashboard?.periodStats || null);
  const [etsData, setEtsData] = useState<{ GAF: number, REVEL: number }>(cachedDashboard?.etsData || { GAF: 0, REVEL: 0 });
  const [productData, setProductData] = useState<ProductInsightsData | null>(cachedProduct || null);

  const [timeframe, setTimeframe] = useState<"month" | "quarter">("month");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(new Date().toLocaleString("en-US", { timeZone: "Australia/Adelaide" })));

  useEffect(() => {
    const fetchData = async (force = false) => {
      try {
        if (!force && !isCacheStale(dashboardCacheKey) && !isCacheStale(productCacheKey)) {
            setIsUpdating(false);
        } else {
            setIsUpdating(true);
            console.log("📊 SalesDashboard fetching...");
            
            // Sequence fetching: Dashboard first, then Products
            const dashboardRes = await fetchDashboardData(force);
            setData(dashboardRes.data);
            setBudgetData(dashboardRes.budgetData);
            setQuarterData(dashboardRes.quarterData);
            setQuarterBudgetData(dashboardRes.quarterBudgetData);
            setAllData(dashboardRes.allData);
            setAllBudgetData(dashboardRes.allBudgetData);
            setPeriodStats(dashboardRes.periodStats);
            setEtsData(dashboardRes.etsData);

            const productRes = await fetchProductInsightsData(force);
            setProductData(productRes);
            setIsUpdating(false);
        }

        if (force || isCacheStale(igCacheKey)) {
            setIsIgUpdating(true);
            const igRes = await fetchInstagramData(force);
            setIgData(igRes);
            setIsIgUpdating(false);
        }

      } catch (error) {
        console.error("Failed to fetch dashboard data", error);
        setIsUpdating(false);
        setIsIgUpdating(false);
      }
    };

    fetchData();
    const interval = setInterval(() => fetchData(true), 15 * 60 * 1000); 
    return () => clearInterval(interval);
  }, []);

  const brand = brandConfig[activeBrand];
  const brandData = data[activeBrand as keyof BrandDataType] || [];
  const brandBudget = budgetData[activeBrand as keyof BrandBudget] || [];
  const brandIgData = igData[activeBrand as keyof BrandInstagram] || [];

  const getPeriodComparison = (dataKey: string) => {
    if (!periodStats || !periodStats[activeBrand]) return null;
    
    // Only show period comparison if looking at the current month/quarter
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Australia/Adelaide" }));
    if (selectedYear !== now.getFullYear() || selectedMonth !== now.getMonth()) {
      return null;
    }

    const current = periodStats[activeBrand].currentPeriod[dataKey as keyof typeof periodStats[typeof activeBrand]['currentPeriod']] || 0;
    const prior = periodStats[activeBrand].priorPeriod[dataKey as keyof typeof periodStats[typeof activeBrand]['priorPeriod']] || 0;
    
    if (prior === 0) return null;
    
    const percentChange = ((current - prior) / prior) * 100;
    const isPositive = percentChange >= 0;
    const isGood = isPositive; // Abandoned carts: red if down, green if up (so isGood = isPositive)
    const isNeutral = dataKey === 'adSpend';
    
    return {
      percentChange: Math.abs(percentChange).toFixed(1),
      isPositive,
      isGood,
      isNeutral
    };
  };

  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Australia/Adelaide" }));
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const currentDay = now.getDate();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const isCreated = metricType === "created";
  
  const selectedMonth = selectedDate.getMonth();
  const selectedYear = selectedDate.getFullYear();
  const selectedQuarter = Math.floor(selectedMonth / 3);
  
  const startOfSelectedMonth = new Date(selectedYear, selectedMonth, 1);
  const endOfSelectedMonth = new Date(selectedYear, selectedMonth + 1, 0);
  
  const startOfSelectedQuarter = new Date(selectedYear, selectedQuarter * 3, 1);
  const endOfSelectedQuarter = new Date(selectedYear, selectedQuarter * 3 + 3, 0);

  const handlePrevious = () => {
    setSelectedDate(prev => {
      const newDate = new Date(prev);
      if (timeframe === "month") {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() - 3);
      }
      return newDate;
    });
  };

  const handleNext = () => {
    setSelectedDate(prev => {
      const newDate = new Date(prev);
      if (timeframe === "month") {
        newDate.setMonth(prev.getMonth() + 1);
      } else {
        newDate.setMonth(prev.getMonth() + 3);
      }
      return newDate;
    });
  };

  const displayDateRange = React.useMemo(() => {
    if (timeframe === "month") {
      return selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    } else {
      const q = Math.floor(selectedDate.getMonth() / 3) + 1;
      return `Q${q} ${selectedDate.getFullYear()}`;
    }
  }, [selectedDate, timeframe]);

  const allBrandData = allData[activeBrand as keyof BrandDataType] || [];
  const allBrandBudget = allBudgetData[activeBrand as keyof BrandBudget] || [];

  const activeData = React.useMemo(() => {
    return allBrandData.filter(d => {
      if (!d.fullDate) return false;
      const [year, month, day] = d.fullDate.split('-').map(Number);
      const dDate = new Date(year, month - 1, day);
      if (timeframe === "month") {
        return dDate >= startOfSelectedMonth && dDate <= endOfSelectedMonth;
      } else {
        return dDate >= startOfSelectedQuarter && dDate <= endOfSelectedQuarter;
      }
    });
  }, [allBrandData, timeframe, startOfSelectedMonth, endOfSelectedMonth, startOfSelectedQuarter, endOfSelectedQuarter]);

  const activeBudgetData = React.useMemo(() => {
    return allBrandBudget.filter(d => {
      if (!d.fullDate) return false;
      const [year, month, day] = d.fullDate.split('-').map(Number);
      const dDate = new Date(year, month - 1, day);
      if (timeframe === "month") {
        return dDate >= startOfSelectedMonth && dDate <= endOfSelectedMonth;
      } else {
        return dDate >= startOfSelectedQuarter && dDate <= endOfSelectedQuarter;
      }
    });
  }, [allBrandBudget, timeframe, startOfSelectedMonth, endOfSelectedMonth, startOfSelectedQuarter, endOfSelectedQuarter]);

  const fullCampaignData: any[] = [];
  const startDate = timeframe === "month" ? startOfSelectedMonth : startOfSelectedQuarter;
  const endDate = timeframe === "month" ? endOfSelectedMonth : endOfSelectedQuarter;
  const daysInTimeframe = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  for (let i = 0; i < daysInTimeframe; i++) {
    const loopDate = new Date(startDate);
    loopDate.setDate(startDate.getDate() + i);
    const dateStr = `${monthNames[loopDate.getMonth()]} ${loopDate.getDate()}`;
    const fullDateStr = `${loopDate.getFullYear()}-${String(loopDate.getMonth() + 1).padStart(2, '0')}-${String(loopDate.getDate()).padStart(2, '0')}`;
    
    const budgetItem = activeBudgetData.find(d => d.fullDate === fullDateStr);
    const actualData = activeData.find((d) => d.fullDate === fullDateStr);
    
    // Future day logic: if the loopDate is strictly after 'now' (ignoring time)
    const isFutureDay = loopDate.getFullYear() > currentYear || 
                        (loopDate.getFullYear() === currentYear && loopDate.getMonth() > currentMonth) ||
                        (loopDate.getFullYear() === currentYear && loopDate.getMonth() === currentMonth && loopDate.getDate() >= currentDay);

    fullCampaignData.push({
      date: dateStr,
      grossProfitCreated: isFutureDay ? null : (actualData?.grossProfitCreated || null),
      grossMarginCreated: isFutureDay ? null : (actualData?.grossMarginCreated || null),
      grossProfitCreatedBudget: budgetItem?.grossProfitCreatedBudget || 0,
      grossProfitFulfilled: isFutureDay ? null : (actualData?.grossProfitFulfilled || null),
      grossMarginFulfilled: isFutureDay ? null : (actualData?.grossMarginFulfilled || null),
      grossProfitFulfilledBudget: budgetItem?.grossProfitFulfilledBudget || 0,
      sessions: isFutureDay ? null : (actualData?.sessions || null),
      targetSessions: budgetItem?.targetSessions || 0,
      abandonedCarts: isFutureDay ? null : (actualData?.abandonedCarts || null),
      adSpend: isFutureDay ? null : (actualData?.adSpend || null),
      inboundSalesCalls: isFutureDay ? null : (actualData?.inboundSalesCalls || 0),
      outboundSalesCalls: isFutureDay ? null : (actualData?.outboundSalesCalls || 0),
    });
  }

  const totalGrossProfit = activeData.reduce(
    (sum, day) => sum + (isCreated ? day.grossProfitCreated || 0 : day.grossProfitFulfilled || 0),
    0
  );

  const totalGrossProfitBudget = activeBudgetData.reduce(
    (sum, day) => sum + (isCreated ? day.grossProfitCreatedBudget || 0 : day.grossProfitFulfilledBudget || 0),
    0
  );

  // Weighted Average Calculation for Margin and Discount
  const { weightedMargin, weightedDiscount } = React.useMemo(() => {
    let totalRevenue = 0;
    let totalGP = 0;
    
    let totalGrossSales = 0;
    let totalDiscount = 0;

    activeData.forEach((day) => {
        // GP Margin Calculation (Weighted)
        const gp = isCreated ? day.grossProfitCreated : day.grossProfitFulfilled;
        const marginPct = isCreated ? day.grossMarginCreated : day.grossMarginFulfilled;
        
        if (gp && marginPct && marginPct !== 0) {
            const revenue = gp / (marginPct / 100);
            totalRevenue += revenue;
            totalGP += gp;
        }

        // Sales Discount Calculation (Weighted)
        // Using fulfilled metrics for weighting discount to be consistent with the available discount data source (Column 13)
        const discPct = day.salesDiscountFulfilled;
        const gpFull = day.grossProfitFulfilled;
        const marginFull = day.grossMarginFulfilled;

        if (discPct !== undefined && gpFull && marginFull && marginFull !== 0) {
             const rev = gpFull / (marginFull / 100);
             // Assuming Discount % is off Gross Sales
             const discRate = discPct / 100;
             if (discRate < 1) {
                 const gross = rev / (1 - discRate);
                 const discAmt = gross - rev;
                 
                 totalGrossSales += gross;
                 totalDiscount += discAmt;
             }
        }
    });

    return {
        weightedMargin: totalRevenue !== 0 ? (totalGP / totalRevenue) * 100 : 0,
        weightedDiscount: totalGrossSales !== 0 ? (totalDiscount / totalGrossSales) * 100 : 0
    };
  }, [activeData, isCreated]);

  const totalSessions = activeData.reduce((sum, day) => sum + (day.sessions || 0), 0);
  
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  
  let daysWithData = 0;
  let daysRemaining = 0;

  if (timeframe === "month") {
    if (selectedYear === currentYear && selectedMonth === currentMonth) {
      daysWithData = yesterday.getMonth() === currentMonth ? yesterday.getDate() : 0;
      daysRemaining = endOfSelectedMonth.getDate() - daysWithData;
    } else if (selectedYear < currentYear || (selectedYear === currentYear && selectedMonth < currentMonth)) {
      daysWithData = endOfSelectedMonth.getDate();
      daysRemaining = 0;
    } else {
      daysWithData = 0;
      daysRemaining = endOfSelectedMonth.getDate();
    }
  } else {
    if (selectedYear === currentYear && selectedQuarter === Math.floor(currentMonth / 3)) {
      daysWithData = Math.max(0, Math.floor((yesterday.getTime() - startOfSelectedQuarter.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      const totalDaysInQuarter = Math.floor((endOfSelectedQuarter.getTime() - startOfSelectedQuarter.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      daysRemaining = totalDaysInQuarter - daysWithData;
    } else if (selectedYear < currentYear || (selectedYear === currentYear && selectedQuarter < Math.floor(currentMonth / 3))) {
      daysWithData = Math.floor((endOfSelectedQuarter.getTime() - startOfSelectedQuarter.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      daysRemaining = 0;
    } else {
      daysWithData = 0;
      daysRemaining = Math.floor((endOfSelectedQuarter.getTime() - startOfSelectedQuarter.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }
  }
    
  const isPastPeriod = timeframe === "month" 
    ? (selectedYear < currentYear || (selectedYear === currentYear && selectedMonth < currentMonth))
    : (selectedYear < currentYear || (selectedYear === currentYear && selectedQuarter < Math.floor(currentMonth / 3)));

  const safeDaysWithData = daysWithData || 1;
  const runRate = totalGrossProfit / safeDaysWithData;
  const projectedGrossProfit = totalGrossProfit + runRate * daysRemaining;
  const progressPercentage = totalGrossProfitBudget > 0 ? (totalGrossProfit / totalGrossProfitBudget) * 100 : 0;
  const projectedProgress = totalGrossProfitBudget > 0 ? (projectedGrossProfit / totalGrossProfitBudget) * 100 : 0;

  useEffect(() => {
    setProgress(0);
    let p = 0;
    let animationFrame: number;
    const animate = () => {
      p += 1.5;
      setProgress(Math.min(p, 100));
      if (p < 100) animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);
    return () => { if (animationFrame) cancelAnimationFrame(animationFrame); };
  }, [metricType]);

  const topGrossingProducts = React.useMemo(() => {
      if (!productData?.performance) return [];
      return [...productData.performance]
          .sort((a, b) => b.grossProfit - a.grossProfit)
          .slice(0, 10); 
  }, [productData]);
  
  const movingTrends = React.useMemo(() => {
     if (!productData?.trends) return [];
     return productData.trends.slice(0, 5);
  }, [productData]);

  if (brandData.length === 0 && isUpdating) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-transparent pb-20 font-sans">
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 border-b border-white/20 shadow-lg">
        <div className="mx-auto max-w-7xl px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center justify-between w-full md:auto gap-4">
            <div>
              <div className="flex items-center gap-2">
                  <h1 className="text-base md:text-lg font-bold tracking-tight" style={{ fontFamily: "'Montserrat', sans-serif", color: GAF_COLORS.black }}>
                    Sales Health
                  </h1>
                  <a href={DATA_SOURCE_URL} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-orange-500 transition-colors" title="View Source Spreadsheet">
                      <Info size={16} />
                  </a>
              </div>
              <div className="flex items-center gap-2 text-[10px] md:text-xs" style={{ color: GAF_COLORS.darkGrey }}>
                <Calendar className="w-3 h-3" />
                <span>{displayDateRange}</span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
            <button
              onClick={() => setMetricType("created")}
              className={`px-4 py-1.5 rounded-md font-medium text-xs md:text-sm transition-all ${
                metricType === "created" ? "bg-white shadow-sm text-gray-900" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Created
            </button>
            <button
              onClick={() => setMetricType("fulfilled")}
              className={`px-4 py-1.5 rounded-md font-medium text-xs md:text-sm transition-all ${
                metricType === "fulfilled" ? "bg-white shadow-sm text-gray-900" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Fulfilled
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-8">
        
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 p-6 relative">
            <UpdatingBadge isUpdating={isUpdating} />
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${brand.colors.gradient} shadow-lg`}>
                    <BarChart3 className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold text-gray-900">Sales Progress</h3>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-gray-50 px-2 py-1 rounded-lg border border-gray-200/50">
                  <button onClick={handlePrevious} className="p-1 hover:bg-gray-200 rounded-md text-gray-600 transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-medium text-gray-900 min-w-[100px] text-center">
                    {displayDateRange}
                  </span>
                  <button onClick={handleNext} className="p-1 hover:bg-gray-200 rounded-md text-gray-600 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                  <button
                    onClick={() => setTimeframe("month")}
                    className={`px-3 py-1 rounded-md font-medium text-xs transition-all ${
                      timeframe === "month" ? "bg-white shadow-sm text-gray-900" : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Month
                  </button>
                  <button
                    onClick={() => setTimeframe("quarter")}
                    className={`px-3 py-1 rounded-md font-medium text-xs transition-all ${
                      timeframe === "quarter" ? "bg-white shadow-sm text-gray-900" : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Quarter
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-sm font-medium text-gray-600 mb-1">
                  Total GP {metricType === "created" ? "Created" : "Fulfilled"}
                </p>
                <p className="text-2xl font-bold text-gray-900 break-words">
                  {brand.currencySymbol}{" "}
                  {((totalGrossProfit * progress) / 100).toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-sm font-medium text-gray-600 mb-1">Target</p>
                <p className="text-2xl font-bold text-gray-900 break-words">
                  {brand.currencySymbol}{" "}
                  {totalGrossProfitBudget.toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-sm font-medium text-gray-600 mb-1">Avg Gross Margin</p>
                <p className="text-2xl font-bold text-gray-900 break-words">
                  {((weightedMargin * progress) / 100).toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 mt-1">Target: {brand.targetMargin}%</p>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-sm font-medium text-gray-600 mb-1">Avg Discount (Created)</p>
                <p className="text-2xl font-bold text-gray-900 break-words">
                   {((weightedDiscount * progress) / 100).toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 mt-1">Target: 10%</p>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-sm font-medium text-gray-600 mb-1">Website Traffic</p>
                <p className="text-2xl font-bold text-gray-900 break-words">
                  {((totalSessions * progress) / 100).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="mb-8">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Target Progress</span>
                <span className="text-sm font-semibold" style={{ color: progressPercentage < 100 ? '#ef4444' : brand.colors.accent }}>
                  {((progressPercentage * progress) / 100).toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${Math.min(100, (progressPercentage * progress) / 100)}%`,
                    backgroundColor: progressPercentage < 100 ? '#ef4444' : brand.colors.accent,
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-white/50 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
                <p className="text-sm text-gray-600 mb-1">{isPastPeriod ? "Avg Daily GP" : "Daily Run Rate"}</p>
                <p className="text-lg font-semibold text-gray-900 break-words">
                  {brand.currencySymbol}{" "}
                  {((runRate * progress) / 100).toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}{" "}
                  / day
                </p>
              </div>
              <div className="p-4 bg-white/50 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
                <div className="flex items-center gap-1 mb-1">
                  <p className="text-sm text-gray-600">{isPastPeriod ? "Final Result" : "Projected End"}</p>
                  {!isPastPeriod && metricType === "fulfilled" && timeframe === "month" && (
                    <div className="group relative">
                      <Info className="w-3.5 h-3.5 text-gray-400 cursor-help" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 text-center">
                        Includes Expected to Ship (ETS) data from <a href="https://docs.google.com/spreadsheets/d/1nE1DXvDAg3ozg4iSoSFL4YXAk9oVo2Etbtz9qJZ4U1g/edit?gid=88121376#gid=88121376" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-300">AFS Sales Team Tracker</a>
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-lg font-semibold text-gray-900 break-words">
                  {brand.currencySymbol}{" "}
                  {((projectedGrossProfit * progress) / 100).toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </p>
                {!isPastPeriod && metricType === "fulfilled" && timeframe === "month" && (
                  <p className="text-xs text-gray-500 mt-1">
                    w/ ETS: {brand.currencySymbol}{" "}
                    {(((projectedGrossProfit + (etsData[activeBrand] || 0)) * progress) / 100).toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </p>
                )}
              </div>
              <div className="p-4 bg-white/50 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
                <div className="flex items-center gap-1 mb-1">
                  <p className="text-sm text-gray-600">{isPastPeriod ? "Final %" : "Projected %"}</p>
                  {!isPastPeriod && metricType === "fulfilled" && timeframe === "month" && (
                    <div className="group relative">
                      <Info className="w-3.5 h-3.5 text-gray-400 cursor-help" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 text-center">
                        Includes Expected to Ship (ETS) data from <a href="https://docs.google.com/spreadsheets/d/1nE1DXvDAg3ozg4iSoSFL4YXAk9oVo2Etbtz9qJZ4U1g/edit?gid=88121376#gid=88121376" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-300">AFS Sales Team Tracker</a>
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-lg font-semibold" style={{ color: projectedProgress < 100 ? '#ef4444' : brand.colors.accent }}>
                  {((projectedProgress * progress) / 100).toFixed(1)}%
                </p>
                {!isPastPeriod && metricType === "fulfilled" && timeframe === "month" && (
                  <p className="text-xs text-gray-500 mt-1">
                    w/ ETS: {totalGrossProfitBudget > 0 ? ((((projectedGrossProfit + (etsData[activeBrand] || 0)) / totalGrossProfitBudget) * 100 * progress) / 100).toFixed(1) : "0.0"}%
                  </p>
                )}
              </div>
              <div className="p-4 bg-white/50 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
                <p className="text-sm text-gray-600 mb-1">Timeline</p>
                <p className="text-lg font-semibold text-gray-900 break-words">
                  {isPastPeriod ? "Completed" : `${daysWithData} days in • ${daysRemaining} left`}
                </p>
              </div>
            </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
          {[
            {
              title: `Gross Profit (${metricType === "created" ? "Created" : "Fulfilled"})`,
              icon: TrendingUp,
              dataKey: metricType === "created" ? "grossProfitCreated" : "grossProfitFulfilled",
              budgetKey: metricType === "created" ? "grossProfitCreatedBudget" : "grossProfitFulfilledBudget",
              type: "bar",
            },
            {
              title: "Website Traffic",
              icon: BarChart3,
              dataKey: "sessions",
              budgetKey: "targetSessions",
              type: "bar",
            },
            { title: "Abandoned Carts", icon: ShoppingCart, dataKey: "abandonedCarts", type: "bar" },
            { title: "Marketing Spend", icon: DollarSign, dataKey: "adSpend", type: "bar" },
            { title: "Inbound Sales Calls", icon: PhoneIncoming, dataKey: "inboundSalesCalls", type: "bar" },
            { title: "Outbound Sales Calls", icon: PhoneOutgoing, dataKey: "outboundSalesCalls", type: "bar" },
          ].map((chart, i) => {
            const comparison = getPeriodComparison(chart.dataKey);
            return (
            <div key={i} className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 p-6 h-96 relative">
              <UpdatingBadge isUpdating={isUpdating} />
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${brand.colors.gradient} shadow-sm`}>
                    <chart.icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{chart.title}</h3>
                </div>
                {comparison && (
                  <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                    comparison.isNeutral 
                      ? 'bg-gray-100 text-gray-600' 
                      : comparison.isGood ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                  }`}>
                    {comparison.isPositive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                    {comparison.percentChange}%
                    <span className="text-gray-400 ml-1 font-normal">vs same period last month</span>
                  </div>
                )}
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={fullCampaignData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 11, fill: '#64748b' }} 
                      stroke="#cbd5e1"
                      interval="preserveStartEnd"
                      minTickGap={15}
                    />
                    <YAxis
                      tickFormatter={(val) => {
                         if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                         return `${val}`;
                      }}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      stroke="#cbd5e1"
                      width={40}
                    />
                    <Tooltip
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{
                        backgroundColor: "rgba(255,255,255,0.98)",
                        border: "1px solid #e2e8f0",
                        borderRadius: "12px",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                        fontSize: "13px"
                      }}
                      formatter={(val: number, name: string) => {
                        const formattedVal = val.toLocaleString(undefined, { maximumFractionDigits: 0 });
                        
                        if (chart.dataKey === "sessions") {
                          return [formattedVal, name === "targetSessions" ? "Target" : "Sessions"];
                        }

                        if (chart.dataKey.includes("grossProfit") || chart.dataKey === "adSpend") {
                          return [`${brand.currencySymbol} ${formattedVal}`, name.includes("Budget") ? "Budget" : "Actual"];
                        }

                        return [formattedVal, chart.title];
                      }}
                    />
                    {chart.budgetKey && (
                      <Bar
                        dataKey={chart.budgetKey}
                        fill="#94a3b8"
                        radius={[4, 4, 0, 0]}
                        opacity={0.3}
                        name="Budget"
                      />
                    )}
                    <Bar 
                      dataKey={chart.dataKey} 
                      fill={brand.colors.accent} 
                      radius={[4, 4, 0, 0]} 
                      opacity={0.9}
                      name="Actual" 
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            );
          })}
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 p-6 relative">
            <UpdatingBadge isUpdating={isUpdating} />
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-orange-100 text-orange-600 shadow-sm">
                    <DollarSign className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-900">Top Grossing Products</h3>
                    <p className="text-xs text-gray-500">Highest gross profit contributors over the last 30 days</p>
                </div>
            </div>
            
            <div className="h-[400px]">
                {topGrossingProducts.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            layout="vertical"
                            data={topGrossingProducts}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                            <XAxis 
                                type="number" 
                                tickFormatter={(val) => `$${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`}
                                stroke="#94a3b8" 
                                tick={{ fontSize: 11 }}
                            />
                            <YAxis 
                                type="category" 
                                dataKey="name" 
                                tick={<CustomYAxisTick />} 
                                width={240} 
                                interval={0}
                            />
                            <Tooltip
                                formatter={(value: number) => [`$${value.toLocaleString()}`, 'Gross Profit']}
                                cursor={{ fill: '#f8fafc' }}
                                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                            />
                            <Bar 
                                dataKey="grossProfit" 
                                fill={brand.colors.accent}
                                radius={[0, 4, 4, 0]} 
                                barSize={20}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex h-full items-center justify-center text-gray-400">No data available</div>
                )}
            </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 p-6 relative">
            <UpdatingBadge isUpdating={isUpdating} />
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-purple-100 text-purple-600 shadow-sm">
                    <Activity className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-900">7-Day Top Movers</h3>
                    <p className="text-xs text-gray-500">Products with largest GP variance vs previous week</p>
                </div>
            </div>
            <div className="space-y-3 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                {movingTrends.length > 0 ? (
                    movingTrends.map((t, i) => (
                        <div key={i} className="flex items-center justify-between group p-3 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                            <div className="flex-1 min-w-0 pr-4">
                                <p className="text-sm font-medium text-gray-900 truncate" title={t.title}>{t.title}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-gray-400">7d GP: ${Math.round(t.gpCurrent7Day).toLocaleString()}</span>
                                </div>
                            </div>
                            <div className={`flex flex-col items-end text-sm font-bold ${t.variance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                <div className="flex items-center gap-1">
                                    {t.variance >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                    ${Math.abs(t.variance).toLocaleString()}
                                </div>
                                <span className="text-[10px] font-normal opacity-70">vs prev 7d</span>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="h-full flex items-center justify-center text-sm text-gray-400 italic">No trend data</div>
                )}
            </div>
        </div>

        <div className="mb-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 p-6 relative">
            <UpdatingBadge isUpdating={isIgUpdating} />
            <div className="flex items-center gap-3 mb-6">
              <div className={`p-3 rounded-xl bg-gradient-to-br ${brand.colors.gradient} shadow-lg`}>
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                  <h3 className="text-2xl font-bold text-gray-900">Top 5 Instagram Posts</h3>
                  <p className="text-sm text-gray-500 font-medium">Last 30 Days</p>
              </div>
            </div>

            <div className="hidden md:flex gap-6 overflow-x-auto pb-6 scrollbar-hide">
              {brandIgData.length > 0 ? (
                brandIgData.map((post, i) => (
                  <InstagramPostCard key={i} post={post} index={i} brand={brand} />
                ))
              ) : (
                <div className="w-full text-center py-12 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                  No Instagram data available for this period.
                </div>
              )}
            </div>

            <div className="md:hidden overflow-x-auto snap-x snap-mandatory pb-6 -mx-6 px-6">
              <div className="flex gap-4">
                {brandIgData.length > 0 ? (
                  brandIgData.map((post, i) => (
                     <InstagramPostCard key={i} post={post} index={i} brand={brand} />
                  ))
                ) : (
                  <div className="w-full text-center py-8 text-gray-500 text-sm">No data available</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
