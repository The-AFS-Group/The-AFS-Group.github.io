
import React, { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Calendar, BarChart3, ShoppingCart, DollarSign, Loader2, PhoneIncoming, PhoneOutgoing, TrendingUp, TrendingDown, Video, Heart, MessageCircle, Repeat, Package, Trophy, PieChart as PieChartIcon, Activity, ChevronDown, ChevronRight, Target } from "lucide-react";
import { fetchDashboardData, fetchProductInsightsData, fetchSalesData, fetchInstagramData, fetchLeadData, fetchETSData, getCachedSalesData, getCachedInstagramData, getCachedProductInsightsData } from "../services/dataService";
import { BrandConfig, BrandData, BrandBudget, BrandInstagram, ProductInsightsData, LeadData } from "../types";
import { GAF_COLORS, CHART_COLORS } from "../constants";

const brandConfig: BrandConfig = {
  GAF: {
    colors: { accent: "#F26422", gradient: "from-orange-500 to-red-500" },
    currencySymbol: "$",
    targetMargin: 38,
  },
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
            alt="Reel thumbnail"
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

// Custom Tick for Horizontal Bar Chart
const CustomYAxisTick = ({ x, y, payload }: any) => {
  return (
    <g transform={`translate(${x},${y})`}>
      <foreignObject x={-240} y={-10} width={230} height={20} style={{ textAlign: "right" }}>
        <div className="text-xs text-gray-600 truncate font-medium" style={{ fontFamily: 'Open Sans' }} title={payload.value}>
          {payload.value}
        </div>
      </foreignObject>
    </g>
  );
};

export default function SalesDashboard() {
  const activeBrand = "GAF";
  const [metricType, setMetricType] = useState<"created" | "fulfilled">("created");
  const [progress, setProgress] = useState(0);
  
  // Initialize state without cached sales data to prevent stale data flash
  const [data, setData] = useState<BrandData>({ GAF: [], REVEL: [] });
  const [budgetData, setBudgetData] = useState<BrandBudget>({ GAF: [], REVEL: [] });
  
  const [igData, setIgData] = useState<BrandInstagram>(() => {
      const cached = getCachedInstagramData();
      return cached ? cached.igData : { GAF: [], REVEL: [] };
  });
  const [productData, setProductData] = useState<ProductInsightsData | null>(() => {
      return getCachedProductInsightsData();
  });
  const [leadData, setLeadData] = useState<LeadData[]>([]);
  const [etsData, setEtsData] = useState<{ GAF: number, REVEL: number }>({ GAF: 0, REVEL: 0 });

  const [isFetchingSales, setIsFetchingSales] = useState(true);
  const [isFetchingInstagram, setIsFetchingInstagram] = useState(() => !getCachedInstagramData());
  const [isFetchingProducts, setIsFetchingProducts] = useState(() => !getCachedProductInsightsData());
  const [isFetchingLeads, setIsFetchingLeads] = useState(true);
  const [isFetchingETS, setIsFetchingETS] = useState(true);
  
  const [topProductsPeriod, setTopProductsPeriod] = useState<'30d' | '1d'>('30d');
  const [progressView, setProgressView] = useState<'month' | 'quarter'>('month');
  
  // Month Selection State
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Accordion state for Cardio Widget
  const [expandedSubCategory, setExpandedSubCategory] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchSales = async () => {
      try {
        if (isMounted) setIsFetchingSales(true);
        console.log("📊 Fetching Sales Data...");
        const salesRes = await fetchSalesData();
        if (isMounted) {
          setData(salesRes.data);
          setBudgetData(salesRes.budgetData);
        }
      } catch (error) {
        console.error("Failed to fetch sales data", error);
      } finally {
        if (isMounted) setIsFetchingSales(false);
      }
    };

    const fetchInstagram = async () => {
      try {
        if (isMounted) setIsFetchingInstagram(true);
        console.log("📸 Fetching Instagram Data...");
        const igRes = await fetchInstagramData();
        if (isMounted) {
          setIgData(igRes.igData);
        }
      } catch (error) {
        console.error("Failed to fetch instagram data", error);
      } finally {
        if (isMounted) setIsFetchingInstagram(false);
      }
    };

    const fetchProducts = async () => {
      try {
        if (isMounted) setIsFetchingProducts(true);
        console.log("📦 Fetching Product Data...");
        const productRes = await fetchProductInsightsData();
        if (isMounted) {
          setProductData(productRes);
        }
      } catch (error) {
        console.error("Failed to fetch product data", error);
      } finally {
        if (isMounted) setIsFetchingProducts(false);
      }
    };

    const fetchLeads = async () => {
      try {
        if (isMounted) setIsFetchingLeads(true);
        console.log("👥 Fetching Lead Data...");
        const leadsRes = await fetchLeadData();
        if (isMounted) {
          setLeadData(leadsRes);
        }
      } catch (error) {
        console.error("Failed to fetch lead data", error);
      } finally {
        if (isMounted) setIsFetchingLeads(false);
      }
    };

    const fetchETS = async () => {
      try {
        if (isMounted) setIsFetchingETS(true);
        console.log("📦 Fetching ETS Data...");
        const etsRes = await fetchETSData();
        if (isMounted) {
          setEtsData(etsRes);
        }
      } catch (error) {
        console.error("Failed to fetch ETS data", error);
      } finally {
        if (isMounted) setIsFetchingETS(false);
      }
    };

    const init = async () => {
      // Sequence fetching: Fetch critical sales data first, then others
      if (isMounted) {
        await fetchSales();
        if (isMounted) {
          fetchProducts();
          fetchLeads();
          fetchETS();
          // Delay Instagram fetch so it doesn't block the initial dashboard render
          setTimeout(() => {
              if (isMounted) fetchInstagram();
          }, 1500);
        }
      }
    };

    init();

    const interval = setInterval(() => {
        fetchSales();
        fetchInstagram();
        fetchProducts();
        fetchLeads();
        fetchETS();
    }, 15 * 60 * 1000); // Auto-refresh every 15 minutes
    
    return () => {
        isMounted = false;
        clearInterval(interval);
    };
  }, []);

  const brand = brandConfig[activeBrand];
  
  // Filter Data by Selected Month
  const currentMonth = selectedDate.getMonth();
  const currentYear = selectedDate.getFullYear();
  const isCurrentMonth = new Date().getMonth() === currentMonth && new Date().getFullYear() === currentYear;

  const brandData = useMemo(() => {
      const allData = data[activeBrand as keyof BrandData] || [];
      return allData.filter(d => {
          if (!d.fullDate) return false;
          const dDate = new Date(d.fullDate);
          return dDate.getMonth() === currentMonth && dDate.getFullYear() === currentYear;
      });
  }, [data, activeBrand, currentMonth, currentYear]);

  const brandBudget = useMemo(() => {
      const allBudget = budgetData[activeBrand as keyof BrandBudget] || [];
      return allBudget.filter(d => {
          if (!d.fullDate) return false;
          const dDate = new Date(d.fullDate);
          return dDate.getMonth() === currentMonth && dDate.getFullYear() === currentYear;
      });
  }, [budgetData, activeBrand, currentMonth, currentYear]);

  const periodOverPeriod = useMemo(() => {
    const allData = data[activeBrand as keyof BrandData] || [];
    
    const now = new Date();
    const isCurrentMonth = selectedDate.getMonth() === now.getMonth() && selectedDate.getFullYear() === now.getFullYear();
    
    // Period 1 (Current selection)
    const period1Start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    period1Start.setHours(0, 0, 0, 0);
    
    let period1End = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
    if (isCurrentMonth) {
      period1End = new Date(); // Up to today
    }
    period1End.setHours(23, 59, 59, 999);
    
    // Period 2 (Previous month, same period)
    const period2Start = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1);
    period2Start.setHours(0, 0, 0, 0);
    
    let period2EndDay = period1End.getDate();
    const daysInPrevMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 0).getDate();
    
    if (!isCurrentMonth) {
      // If looking at a past full month, compare to the full previous month
      period2EndDay = daysInPrevMonth;
    } else if (period2EndDay > daysInPrevMonth) {
      period2EndDay = daysInPrevMonth;
    }
    
    const period2End = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, period2EndDay);
    period2End.setHours(23, 59, 59, 999);

    const period1Data = allData.filter(d => {
      if (!d.fullDate) return false;
      const dDate = new Date(d.fullDate);
      return dDate >= period1Start && dDate <= period1End;
    });

    const period2Data = allData.filter(d => {
      if (!d.fullDate) return false;
      const dDate = new Date(d.fullDate);
      return dDate >= period2Start && dDate <= period2End;
    });

    const period1LeadData = leadData.filter(d => d.date >= period1Start && d.date <= period1End);
    const period2LeadData = leadData.filter(d => d.date >= period2Start && d.date <= period2End);

    const sum = (arr: any[], key: string) => arr.reduce((acc, curr) => acc + (curr[key] || 0), 0);

    const calcChange = (key: string) => {
      const p1 = sum(period1Data, key);
      const p2 = sum(period2Data, key);
      if (p2 === 0) return p1 > 0 ? 100 : 0;
      return ((p1 - p2) / p2) * 100;
    };

    const calcLeadChange = () => {
      const p1 = sum(period1LeadData, 'dailyDelta');
      const p2 = sum(period2LeadData, 'dailyDelta');
      if (p2 === 0) return p1 > 0 ? 100 : 0;
      return ((p1 - p2) / Math.abs(p2)) * 100;
    };

    return {
      grossProfitCreated: calcChange('grossProfitCreated'),
      grossProfitFulfilled: calcChange('grossProfitFulfilled'),
      sessions: calcChange('sessions'),
      abandonedCarts: calcChange('abandonedCarts'),
      adSpend: calcChange('adSpend'),
      inboundSalesCalls: calcChange('inboundSalesCalls'),
      outboundSalesCalls: calcChange('outboundSalesCalls'),
      dailyLeadDelta: calcLeadChange(),
    };
  }, [data, activeBrand, selectedDate, leadData]);

  const brandIgData = igData[activeBrand as keyof BrandInstagram] || [];

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const monthName = selectedDate.toLocaleString('default', { month: 'long' });
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const fullCampaignData: any[] = [];
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${monthNames[currentMonth]} ${i}`;
    // Budget data should align by day index if available, or date matching
    // Since we filtered brandBudget, we can try to find by date or index
    // Assuming budget data is complete for the month
    const budgetItem = brandBudget.find(b => b.date === dateStr) || brandBudget[i-1]; 
    const actualData = brandData.find((d) => d.date === dateStr);
    const leadItem = leadData.find(l => l.date.getMonth() === currentMonth && l.date.getFullYear() === currentYear && l.date.getDate() === i);

    fullCampaignData.push({
      date: dateStr,
      grossProfitCreated: actualData?.grossProfitCreated || null,
      grossMarginCreated: actualData?.grossMarginCreated || null,
      grossProfitCreatedBudget: budgetItem?.grossProfitCreatedBudget || 0,
      grossProfitFulfilled: actualData?.grossProfitFulfilled || null,
      grossMarginFulfilled: actualData?.grossMarginFulfilled || null,
      grossProfitFulfilledBudget: budgetItem?.grossProfitFulfilledBudget || 0,
      salesDiscountFulfilled: actualData?.salesDiscountFulfilled || null,
      sessions: actualData?.sessions || null,
      targetSessions: budgetItem?.targetSessions || 0,
      abandonedCarts: actualData?.abandonedCarts || null,
      adSpend: actualData?.adSpend || null,
      inboundSalesCalls: actualData?.inboundSalesCalls || 0,
      outboundSalesCalls: actualData?.outboundSalesCalls || 0,
      dailyLeadDelta: leadItem ? leadItem.dailyDelta : null,
    });
  }

  const isCreated = metricType === "created";

  const currentQuarter = Math.floor(currentMonth / 3);
  const quarterStartMonth = currentQuarter * 3;
  const quarterEndMonth = quarterStartMonth + 2;
  const isCurrentQuarter = new Date().getMonth() >= quarterStartMonth && new Date().getMonth() <= quarterEndMonth && new Date().getFullYear() === currentYear;

  const quarterData = useMemo(() => {
      const allData = data[activeBrand as keyof BrandData] || [];
      return allData.filter(d => {
          if (!d.fullDate) return false;
          const dDate = new Date(d.fullDate);
          return dDate.getMonth() >= quarterStartMonth && dDate.getMonth() <= quarterEndMonth && dDate.getFullYear() === currentYear;
      });
  }, [data, activeBrand, quarterStartMonth, quarterEndMonth, currentYear]);

  const quarterBudget = useMemo(() => {
      const allBudget = budgetData[activeBrand as keyof BrandBudget] || [];
      return allBudget.filter(d => {
          if (!d.fullDate) return false;
          const dDate = new Date(d.fullDate);
          return dDate.getMonth() >= quarterStartMonth && dDate.getMonth() <= quarterEndMonth && dDate.getFullYear() === currentYear;
      });
  }, [budgetData, activeBrand, quarterStartMonth, quarterEndMonth, currentYear]);

  const progressData = progressView === 'month' ? brandData : quarterData;
  const progressBudget = progressView === 'month' ? brandBudget : quarterBudget;
  
  const totalGrossProfit = progressData.reduce(
    (sum, day) => sum + (isCreated ? day.grossProfitCreated || 0 : day.grossProfitFulfilled || 0),
    0
  );

  const totalGrossProfitBudget = progressBudget.reduce(
    (sum, day) => sum + (isCreated ? day.grossProfitCreatedBudget || 0 : day.grossProfitFulfilledBudget || 0),
    0
  );

  // Calculate Weighted Averages for Margin and Discount
  const { averageGrossMargin, averageSalesDiscount } = useMemo(() => {
    let totalRevenue = 0;
    let totalGP = 0;
    let totalRevenueFulfilled = 0;
    let totalDiscountDollars = 0;

    progressData.forEach(day => {
        // 1. Gross Profit Margin Weighted Calculation
        const gp = isCreated ? (day.grossProfitCreated || 0) : (day.grossProfitFulfilled || 0);
        const marginPct = isCreated ? (day.grossMarginCreated || 0) : (day.grossMarginFulfilled || 0);

        // Derive Revenue from GP and Margin% to act as weight
        // Revenue = GP / (Margin% / 100)
        if (marginPct !== 0 && gp !== 0) {
            const revenue = gp / (marginPct / 100);
            totalRevenue += revenue;
            totalGP += gp;
        }

        // 2. Sales Discount Weighted Calculation (Always Fulfilled data)
        const gpFull = day.grossProfitFulfilled || 0;
        const marginFull = day.grossMarginFulfilled || 0;
        const discountPct = day.salesDiscountFulfilled || 0;

        // Derive Revenue Fulfilled to weight the discount
        if (marginFull !== 0 && gpFull !== 0) {
            const revenueFull = gpFull / (marginFull / 100);
            // Derive Discount Dollars: Revenue * (Discount% / 100)
            const discountDollars = revenueFull * (discountPct / 100);
            
            totalRevenueFulfilled += revenueFull;
            totalDiscountDollars += discountDollars;
        }
    });

    const weightedMargin = totalRevenue > 0 ? (totalGP / totalRevenue) * 100 : 0;
    const weightedDiscount = totalRevenueFulfilled > 0 ? (totalDiscountDollars / totalRevenueFulfilled) * 100 : 0;

    return {
        averageGrossMargin: weightedMargin,
        averageSalesDiscount: weightedDiscount
    };
  }, [progressData, isCreated]);

  const totalSessions = progressData.reduce((sum, day) => sum + (day.sessions || 0), 0);
  
  // Logic for run rate and projection
  let daysWithData = 0;
  let daysInPeriod = 0;

  if (progressView === 'month') {
      daysInPeriod = daysInMonth;
      if (isCurrentMonth) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          daysWithData = yesterday.getDate();
      } else {
          daysWithData = progressData.length;
      }
  } else {
      daysInPeriod = 
          new Date(currentYear, quarterStartMonth + 1, 0).getDate() +
          new Date(currentYear, quarterStartMonth + 2, 0).getDate() +
          new Date(currentYear, quarterStartMonth + 3, 0).getDate();
      
      if (isCurrentQuarter) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const qStart = new Date(currentYear, quarterStartMonth, 1);
          daysWithData = Math.floor((yesterday.getTime() - qStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      } else {
          daysWithData = progressData.length;
      }
  }
  
  const safeDaysWithData = daysWithData || 1;
  const isCurrentPeriod = progressView === 'month' ? isCurrentMonth : isCurrentQuarter;
  const daysRemaining = isCurrentPeriod ? Math.max(0, daysInPeriod - daysWithData) : 0;
  
  // For historical periods, run rate is just average per day over the whole period
  const runRate = totalGrossProfit / safeDaysWithData;
  
  // For historical periods, projected is just actual total
  const projectedGrossProfit = isCurrentPeriod ? (totalGrossProfit + runRate * daysRemaining) : totalGrossProfit;
  
  const progressPercentage = totalGrossProfitBudget > 0 ? (totalGrossProfit / totalGrossProfitBudget) * 100 : 0;
  const projectedProgress = totalGrossProfitBudget > 0 ? (projectedGrossProfit / totalGrossProfitBudget) * 100 : 0;

  const etsAmount = etsData[activeBrand as keyof typeof etsData] || 0;
  const showETS = metricType === "fulfilled" && progressView === "month" && isCurrentMonth;
  const projectedGrossProfitWithETS = projectedGrossProfit + etsAmount;
  const projectedProgressWithETS = totalGrossProfitBudget > 0 ? (projectedGrossProfitWithETS / totalGrossProfitBudget) * 100 : 0;

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
  }, [activeBrand, metricType, selectedDate]);

  // --- PRODUCT SNAPSHOT DATA ---
  const topGrossingProducts = React.useMemo(() => {
      if (!isCurrentMonth) return []; // Hide for previous months
      if (topProductsPeriod === '1d') {
          return productData?.yesterdayTopProducts || [];
      }
      if (!productData?.performance) return [];
      return [...productData.performance]
          .sort((a, b) => b.grossProfit - a.grossProfit)
          .slice(0, 10);
  }, [productData, topProductsPeriod, isCurrentMonth]);

  const cardioInsights = productData?.categoryInsights?.cardio;
  
  const movingTrends = React.useMemo(() => {
     if (!isCurrentMonth) return []; // Hide for previous months
     if (!productData?.trends) return [];
     return productData.trends.slice(0, 5);
  }, [productData, isCurrentMonth]);

  const shareDiff = cardioInsights ? (cardioInsights.currentShare - cardioInsights.previousShare) : 0;
  const gpDiff = cardioInsights ? (cardioInsights.currentGP - cardioInsights.previousGP) : 0;

  const changeMonth = (offset: number) => {
      const newDate = new Date(selectedDate);
      newDate.setMonth(newDate.getMonth() + offset);
      setSelectedDate(newDate);
  };



  return (
    <div className="min-h-screen bg-transparent pb-20 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 border-b border-white/20 shadow-lg">
        <div className="mx-auto max-w-7xl px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center justify-between w-full md:w-auto gap-4">
            <div>
              <h1 className="text-base md:text-lg font-bold tracking-tight" style={{ fontFamily: "'Montserrat', sans-serif", color: GAF_COLORS.black }}>
                Sales Health
              </h1>
              <div className="flex items-center gap-2 text-[10px] md:text-xs" style={{ color: GAF_COLORS.darkGrey }}>
                <Calendar className="w-3 h-3" />
                <div className="flex items-center gap-1">
                    <button onClick={() => changeMonth(-1)} className="p-0.5 hover:bg-gray-100 rounded">
                        <ChevronRight className="w-3 h-3 rotate-180" />
                    </button>
                    <span className="min-w-[80px] text-center font-medium">{monthName} {currentYear}</span>
                    <button 
                        onClick={() => changeMonth(1)} 
                        className={`p-0.5 hover:bg-gray-100 rounded ${isCurrentMonth ? 'opacity-30 cursor-not-allowed' : ''}`}
                        disabled={isCurrentMonth}
                    >
                        <ChevronRight className="w-3 h-3" />
                    </button>
                </div>
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
        {/* KPI Cards */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 p-6 relative overflow-hidden">
            {isFetchingSales && brandData.length > 0 && (
              <div className="absolute top-4 right-4 flex items-center gap-2 text-orange-500 bg-orange-50 px-3 py-1.5 rounded-full text-xs font-medium animate-pulse z-10">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Updating...
              </div>
            )}
            <div className="flex items-center gap-3 mb-6">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${brand.colors.gradient} shadow-lg`}>
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-gray-900">Sales Progress</h3>
                <div className="flex gap-1 p-1 bg-gray-100 rounded-lg ml-auto">
                  <button
                    onClick={() => setProgressView("month")}
                    className={`px-3 py-1 rounded-md font-medium text-xs transition-all ${
                      progressView === "month" ? "bg-white shadow-sm text-gray-900" : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Month
                  </button>
                  <button
                    onClick={() => setProgressView("quarter")}
                    className={`px-3 py-1 rounded-md font-medium text-xs transition-all ${
                      progressView === "quarter" ? "bg-white shadow-sm text-gray-900" : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Quarter
                  </button>
                </div>
            </div>

            {isFetchingSales && brandData.length === 0 ? (
              <div className="animate-pulse space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="p-4 rounded-xl bg-gray-100 border border-gray-100 h-24"></div>
                  ))}
                </div>
                <div className="mb-8">
                  <div className="flex justify-between items-center mb-2">
                    <div className="h-4 bg-gray-200 rounded w-24"></div>
                    <div className="h-4 bg-gray-200 rounded w-12"></div>
                  </div>
                  <div className="w-full h-4 bg-gray-200 rounded-full"></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="p-4 bg-gray-100 rounded-xl border border-gray-100 h-20"></div>
                  ))}
                </div>
              </div>
            ) : (
              <>
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
                      {((averageGrossMargin * progress) / 100).toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Target: {brand.targetMargin}%</p>
                  </div>
                   <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                    <p className="text-sm font-medium text-gray-600 mb-1">Avg Discount</p>
                    <p className="text-2xl font-bold text-gray-900 break-words">
                      {((averageSalesDiscount * progress) / 100).toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Target: &lt; 10%</p>
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
                    <span className="text-sm font-semibold" style={{ color: brand.colors.accent }}>
                      {((progressPercentage * progress) / 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000 ease-out"
                      style={{
                        width: `${Math.min(100, (progressPercentage * progress) / 100)}%`,
                        backgroundColor: brand.colors.accent,
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 bg-white/50 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
                    <p className="text-sm text-gray-600 mb-1">Daily Run Rate</p>
                    <p className="text-lg font-semibold text-gray-900 break-words">
                      {brand.currencySymbol}{" "}
                      {((runRate * progress) / 100).toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}{" "}
                      / day
                    </p>
                  </div>
                  <div className="p-4 bg-white/50 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors relative group">
                    <div className="flex items-center gap-1 mb-1">
                      <p className="text-sm text-gray-600">Projected End</p>
                      {showETS && (
                        <div className="relative flex items-center">
                          <div className="w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-500 cursor-help">?</div>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                            Includes Estimated to Ship (ETS) data. 
                            <a href="https://docs.google.com/spreadsheets/d/1nE1DXvDAg3ozg4iSoSFL4YXAk9oVo2Etbtz9qJZ4U1g/edit?gid=88121376#gid=88121376" target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:underline block mt-1 pointer-events-auto">View Source Spreadsheet</a>
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
                    {showETS && (
                      <p className="text-xs text-gray-500 mt-1 font-medium">
                        w/ ETS: {brand.currencySymbol}{((projectedGrossProfitWithETS * progress) / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                    )}
                  </div>
                  <div className="p-4 bg-white/50 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors relative group">
                    <div className="flex items-center gap-1 mb-1">
                      <p className="text-sm text-gray-600">Projected %</p>
                      {showETS && (
                        <div className="relative flex items-center">
                          <div className="w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-500 cursor-help">?</div>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                            Includes Estimated to Ship (ETS) data. 
                            <a href="https://docs.google.com/spreadsheets/d/1nE1DXvDAg3ozg4iSoSFL4YXAk9oVo2Etbtz9qJZ4U1g/edit?gid=88121376#gid=88121376" target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:underline block mt-1 pointer-events-auto">View Source Spreadsheet</a>
                          </div>
                        </div>
                      )}
                    </div>
                    <p className="text-lg font-semibold" style={{ color: brand.colors.accent }}>
                      {((projectedProgress * progress) / 100).toFixed(1)}%
                    </p>
                    {showETS && (
                      <p className="text-xs text-gray-500 mt-1 font-medium">
                        w/ ETS: {((projectedProgressWithETS * progress) / 100).toFixed(1)}%
                      </p>
                    )}
                  </div>
                  {isCurrentPeriod && (
                  <div className="p-4 bg-white/50 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
                    <p className="text-sm text-gray-600 mb-1">Timeline</p>
                    <p className="text-lg font-semibold text-gray-900 break-words">
                      {daysWithData} days in • {daysRemaining} left
                    </p>
                  </div>
                  )}
                </div>
              </>
            )}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
          {isFetchingSales && brandData.length === 0 ? (
            [...Array(6)].map((_, i) => (
              <div key={i} className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 p-6 h-96 relative overflow-hidden animate-pulse">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-gray-200"></div>
                  <div className="h-6 bg-gray-200 rounded w-48"></div>
                </div>
                <div className="h-72 w-full bg-gray-100 rounded-xl"></div>
              </div>
            ))
          ) : (
            [
              {
                title: `Gross Profit (${metricType === "created" ? "Created" : "Fulfilled"})`,
                icon: TrendingUp,
                dataKey: metricType === "created" ? "grossProfitCreated" : "grossProfitFulfilled",
                budgetKey: metricType === "created" ? "grossProfitCreatedBudget" : "grossProfitFulfilledBudget",
                changeKey: metricType === "created" ? "grossProfitCreated" : "grossProfitFulfilled",
                type: "bar",
              },
              {
                title: "Website Traffic",
                icon: BarChart3,
                dataKey: "sessions",
                budgetKey: "targetSessions",
                changeKey: "sessions",
                type: "bar",
              },
              { title: "Abandoned Carts", icon: ShoppingCart, dataKey: "abandonedCarts", changeKey: "abandonedCarts", type: "bar" },
              { title: "Marketing Spend", icon: DollarSign, dataKey: "adSpend", changeKey: "adSpend", type: "bar" },
              { title: "Inbound Sales Calls", icon: PhoneIncoming, dataKey: "inboundSalesCalls", changeKey: "inboundSalesCalls", type: "bar" },
              { title: "Outbound Sales Calls", icon: PhoneOutgoing, dataKey: "outboundSalesCalls", changeKey: "outboundSalesCalls", type: "bar" },
              { title: "New Marketing Contacts", icon: TrendingUp, dataKey: "dailyLeadDelta", changeKey: "dailyLeadDelta", type: "bar" },
            ].map((chart, i) => (
            <div key={i} className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 p-6 h-96 relative overflow-hidden">
              {isFetchingSales && brandData.length > 0 && (
                <div className="absolute top-4 right-4 flex items-center gap-2 text-orange-500 bg-orange-50 px-2 py-1 rounded-full text-xs font-medium animate-pulse z-10">
                  <Loader2 className="w-3 h-3 animate-spin" />
                </div>
              )}
              <div className="flex items-center gap-3 mb-6">
                <div className={`p-2 rounded-lg bg-gradient-to-br ${brand.colors.gradient} shadow-sm`}>
                  <chart.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{chart.title}</h3>
                {chart.changeKey && (
                  <div className="ml-auto flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-50 px-2 py-1 rounded-md border border-gray-100" title="Same period last month">
                    <span className={
                      chart.changeKey === "adSpend" 
                        ? "text-gray-600" 
                        : periodOverPeriod[chart.changeKey as keyof typeof periodOverPeriod] >= 0 
                          ? "text-green-600" 
                          : "text-red-500"
                    }>
                      {periodOverPeriod[chart.changeKey as keyof typeof periodOverPeriod] > 0 ? "+" : ""}
                      {periodOverPeriod[chart.changeKey as keyof typeof periodOverPeriod].toFixed(1)}%
                    </span>
                    <span className="text-gray-400 font-normal">vs same period last month</span>
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
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          
                          if (chart.dataKey === "dailyLeadDelta") {
                            const leadItem = leadData.find(l => {
                               const dDate = `${monthNames[l.date.getMonth()]} ${l.date.getDate()}`;
                               return dDate === data.date;
                            });

                            return (
                              <div className="bg-white/95 border border-gray-200 rounded-xl shadow-lg p-3 text-sm">
                                <p className="font-semibold text-gray-900 mb-2">{label}</p>
                                <p className="text-gray-600 flex justify-between gap-4">
                                  <span>{chart.title}:</span>
                                  <span className="font-medium text-gray-900" style={{ color: payload[0].color }}>
                                    {Number(payload[0].value) > 0 ? '+' : ''}{payload[0].value}
                                  </span>
                                </p>
                                {leadItem && (
                                  <div className="mt-2 pt-2 border-t border-gray-100">
                                    <div className="flex justify-between gap-4 text-xs mt-1">
                                      <span className="text-gray-500">Total List Size:</span>
                                      <span className="font-medium text-gray-900">{leadItem.totalListSize.toLocaleString()}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          }

                          return (
                            <div className="bg-white/95 border border-gray-200 rounded-xl shadow-lg p-3 text-sm">
                              <p className="font-semibold text-gray-900 mb-1">{label}</p>
                              {payload.map((entry, index) => {
                                const formattedVal = Number(entry.value).toLocaleString(undefined, { maximumFractionDigits: 0 });
                                let name = entry.name;
                                let valStr = formattedVal;

                                if (chart.dataKey === "sessions") {
                                  name = entry.name === "targetSessions" ? "Target" : "Sessions";
                                } else if (chart.dataKey.includes("grossProfit") || chart.dataKey === "adSpend") {
                                  name = String(entry.name).includes("Budget") ? "Budget" : "Actual";
                                  valStr = `${brand.currencySymbol} ${formattedVal}`;
                                } else {
                                  name = chart.title;
                                }

                                return (
                                  <p key={index} className="text-gray-600 flex justify-between gap-4 mt-1">
                                    <span>{name}:</span>
                                    <span className="font-medium text-gray-900" style={{ color: entry.color }}>{valStr}</span>
                                  </p>
                                );
                              })}
                            </div>
                          );
                        }
                        return null;
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
            ))
          )}
        </div>

        {/* --- Top Grossing Products (Horizontal Bar Chart) --- */}
        {isCurrentMonth && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 p-6 relative overflow-hidden">
            {isFetchingProducts && topGrossingProducts.length > 0 && (
              <div className="absolute top-4 right-4 flex items-center gap-2 text-orange-500 bg-orange-50 px-3 py-1.5 rounded-full text-xs font-medium animate-pulse z-10">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Updating...
              </div>
            )}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-orange-100 text-orange-600 shadow-sm">
                        <DollarSign className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Top Grossing Products</h3>
                        <p className="text-xs text-gray-500">
                          {topProductsPeriod === '30d' ? 'Highest gross profit contributors over the last 30 days' : 'Highest gross profit contributors for the latest completed day'}
                        </p>
                    </div>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-lg self-start">
                    <button 
                        onClick={() => setTopProductsPeriod('30d')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${topProductsPeriod === '30d' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                    >
                        Last 30 Days
                    </button>
                    <button 
                        onClick={() => setTopProductsPeriod('1d')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${topProductsPeriod === '1d' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                    >
                        Yesterday
                    </button>
                </div>
            </div>
            
            <div className="h-[400px]">
                {isFetchingProducts && topGrossingProducts.length === 0 ? (
                    <div className="animate-pulse space-y-4 h-full flex flex-col justify-center">
                        {[...Array(10)].map((_, i) => (
                            <div key={i} className="flex items-center gap-4">
                                <div className="h-4 bg-gray-200 rounded w-48"></div>
                                <div className="h-4 bg-gray-200 rounded flex-1"></div>
                            </div>
                        ))}
                    </div>
                ) : topGrossingProducts.length > 0 ? (
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
                                fill={GAF_COLORS.orange} 
                                radius={[0, 4, 4, 0]} 
                                barSize={20}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex h-full items-center justify-center text-gray-400 italic">No data available for this period</div>
                )}
            </div>
        </div>
        )}

        {/* --- Cardio Category Share & 7-Day Movers --- */}
        {isCurrentMonth && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Cardio Category Share (Accordion ONLY) */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 p-6 relative overflow-hidden">
                {isFetchingProducts && cardioInsights && (
                  <div className="absolute top-4 right-4 flex items-center gap-2 text-pink-500 bg-pink-50 px-3 py-1.5 rounded-full text-xs font-medium animate-pulse z-10">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Updating...
                  </div>
                )}
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-lg bg-pink-100 text-pink-600 shadow-sm">
                        <PieChartIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Cardio Category Share</h3>
                        <p className="text-xs text-gray-500">Gross Profit Contribution (Rolling 30 Days)</p>
                    </div>
                </div>

                <div className="space-y-6">
                    {isFetchingProducts && !cardioInsights ? (
                        <div className="animate-pulse space-y-6">
                            <div>
                                <div className="flex items-baseline gap-3 mb-4">
                                    <div className="h-12 bg-gray-200 rounded w-24"></div>
                                    <div className="h-4 bg-gray-200 rounded w-20"></div>
                                </div>
                                <div className="flex gap-4 border-b border-gray-100 pb-4">
                                    <div className="h-8 bg-gray-200 rounded w-20"></div>
                                    <div className="h-8 bg-gray-200 rounded w-24"></div>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="h-4 bg-gray-200 rounded w-32 mb-4"></div>
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="border-b border-gray-100 pb-3">
                                        <div className="flex justify-between mb-2">
                                            <div className="h-4 bg-gray-200 rounded w-32"></div>
                                            <div className="h-4 bg-gray-200 rounded w-16"></div>
                                        </div>
                                        <div className="h-1.5 bg-gray-200 rounded-full w-full"></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div className="flex items-baseline flex-wrap gap-x-3 gap-y-1">
                                <span className="text-5xl font-extrabold text-gray-900 tracking-tight">
                                    {cardioInsights ? cardioInsights.currentShare.toFixed(1) : 0}%
                                </span>
                                <span className="text-sm text-gray-500 font-medium">of Total GP</span>
                                
                                {cardioInsights && (
                                    <>
                                        <div className={`flex items-center gap-1 text-sm font-bold ${shareDiff >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                            {shareDiff >= 0 ? <TrendingUp size={16} strokeWidth={3} /> : <TrendingDown size={16} strokeWidth={3} />}
                                            {Math.abs(shareDiff).toFixed(1)}% vs Prev 30d
                                        </div>
                                        <div className={`flex items-center gap-1 text-sm font-bold ml-2 ${gpDiff >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                            {gpDiff >= 0 ? <TrendingUp size={16} strokeWidth={3} /> : <TrendingDown size={16} strokeWidth={3} />}
                                            ${Math.abs(Math.round(gpDiff)).toLocaleString()} vs Prev 30d
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Target Badge */}
                            <div className="flex items-center gap-2 mt-2 mb-4">
                                <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-gray-100 text-gray-700 text-xs font-bold border border-gray-200">
                                    <Target size={14} className="text-gray-500" />
                                    <span>Target: 14.9%</span>
                                </div>
                                <span className="text-xs text-gray-400 font-medium">(2025 Actual)</span>
                            </div>

                            <div className="flex gap-4 mt-2 border-b border-gray-100 pb-4">
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase">Cardio GP</p>
                                    <p className="text-sm font-bold text-gray-900">${cardioInsights ? Math.round(cardioInsights.currentGP).toLocaleString() : 0}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase">Total Store GP</p>
                                    <p className="text-sm font-bold text-gray-900">${productData?.categoryInsights?.totalGP ? Math.round(productData.categoryInsights.totalGP).toLocaleString() : 0}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Accordion List */}
                    {!isFetchingProducts && cardioInsights && (
                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Sub-Category Breakdown</h4>
                            {cardioInsights?.subCategories.slice(0, 5).map((sub, idx) => {
                                const isExpanded = expandedSubCategory === sub.name;
                                const maxGP = Math.max(...cardioInsights.subCategories.map(s => s.gp));
                                
                                return (
                                    <div key={idx} className="border-b border-gray-100 last:border-0 pb-3 last:pb-0">
                                        <button 
                                            onClick={() => setExpandedSubCategory(isExpanded ? null : sub.name)}
                                            className="w-full text-left group"
                                        >
                                            <div className="flex justify-between items-center mb-1">
                                                <div className="flex items-center gap-2">
                                                    {isExpanded ? <ChevronDown size={14} className="text-gray-400"/> : <ChevronRight size={14} className="text-gray-400"/>}
                                                    <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{sub.name}</span>
                                                </div>
                                                <span className="text-xs font-bold text-gray-900">{((sub.gp / cardioInsights.currentGP) * 100).toFixed(1)}% <span className="text-gray-400 font-normal">of Cardio</span></span>
                                            </div>
                                            <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full rounded-full transition-all duration-500" 
                                                    style={{ width: `${(sub.gp / maxGP) * 100}%`, backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} 
                                                />
                                            </div>
                                            <div className="text-right mt-1">
                                                <span className="text-[10px] text-gray-400">${Math.round(sub.gp).toLocaleString()}</span>
                                            </div>
                                        </button>

                                        {/* Products Dropdown */}
                                        {isExpanded && (
                                            <div className="mt-3 pl-6 space-y-2 animate-in slide-in-from-top-1 duration-200">
                                                {sub.products.slice(0, 5).map((p, pIdx) => (
                                                    <div key={pIdx} className="flex justify-between text-xs p-2 bg-gray-50 rounded-lg">
                                                        <span className="text-gray-600 truncate flex-1 pr-2">{p.name}</span>
                                                        <span className="font-medium text-gray-900">${Math.round(p.gp).toLocaleString()}</span>
                                                    </div>
                                                ))}
                                                {sub.products.length > 5 && (
                                                    <div className="text-[10px] text-gray-400 italic pl-2">+{sub.products.length - 5} more</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* 7-Day Movers (Retained as vertical list for layout balance) */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 p-6 flex flex-col h-full relative overflow-hidden">
                {isFetchingProducts && movingTrends.length > 0 && (
                  <div className="absolute top-4 right-4 flex items-center gap-2 text-purple-500 bg-purple-50 px-3 py-1.5 rounded-full text-xs font-medium animate-pulse z-10">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Updating...
                  </div>
                )}
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-lg bg-purple-100 text-purple-600 shadow-sm">
                        <Activity className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">7-Day Top Movers</h3>
                        <p className="text-xs text-gray-500">Products with largest GP variance vs previous week</p>
                    </div>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                    {isFetchingProducts && movingTrends.length === 0 ? (
                        <div className="animate-pulse space-y-3">
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-gray-100">
                                    <div className="flex-1 pr-4">
                                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                                        <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <div className="h-4 bg-gray-200 rounded w-16 mb-1"></div>
                                        <div className="h-2 bg-gray-200 rounded w-10"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : movingTrends.length > 0 ? (
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
        </div>
        )}

        {/* Top 5 Instagram Reels */}
        {isCurrentMonth && (
        <div className="mb-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className={`p-3 rounded-xl bg-gradient-to-br ${brand.colors.gradient} shadow-lg`}>
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                  <h3 className="text-2xl font-bold text-gray-900">Top 5 Instagram Reels</h3>
                  <p className="text-sm text-gray-500 font-medium">Last 30 Days</p>
              </div>
            </div>

            {/* Desktop View */}
            <div className="hidden md:flex gap-6 overflow-x-auto pb-6 scrollbar-hide relative">
              {isFetchingInstagram && brandIgData.length > 0 && (
                <div className="absolute top-0 right-0 flex items-center gap-2 text-orange-500 bg-orange-50 px-3 py-1.5 rounded-full text-xs font-medium animate-pulse z-10">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Updating...
                </div>
              )}
              {isFetchingInstagram && brandIgData.length === 0 ? (
                [...Array(5)].map((_, i) => (
                  <div key={i} className="min-w-[280px] w-[280px] bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col animate-pulse">
                    <div className="h-48 bg-gray-200"></div>
                    <div className="p-4 flex-1 flex flex-col">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                    </div>
                  </div>
                ))
              ) : brandIgData.length > 0 ? (
                brandIgData.map((post, i) => (
                  <InstagramPostCard key={i} post={post} index={i} brand={brand} />
                ))
              ) : (
                <div className="w-full text-center py-12 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                  No Instagram Reels data available for this period.
                </div>
              )}
            </div>

            {/* Mobile View */}
            <div className="md:hidden overflow-x-auto snap-x snap-mandatory pb-6 -mx-6 px-6 relative">
              {isFetchingInstagram && brandIgData.length > 0 && (
                <div className="absolute top-0 right-6 flex items-center gap-2 text-orange-500 bg-orange-50 px-3 py-1.5 rounded-full text-xs font-medium animate-pulse z-10">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Updating...
                </div>
              )}
              <div className="flex gap-4">
                {isFetchingInstagram && brandIgData.length === 0 ? (
                  [...Array(3)].map((_, i) => (
                    <div key={i} className="min-w-[260px] w-[260px] snap-center bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col animate-pulse">
                      <div className="h-40 bg-gray-200"></div>
                      <div className="p-4 flex-1 flex flex-col">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                      </div>
                    </div>
                  ))
                ) : brandIgData.length > 0 ? (
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
        )}
      </div>
    </div>
  );
}
