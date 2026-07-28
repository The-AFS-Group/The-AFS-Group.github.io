
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { fetchProductInsightsData, getCachedProductInsightsData } from '../services/dataService';
import { ProductInsightsData, ProductPerformance } from '../types';
import { 
    Loader2, TrendingUp, TrendingDown, AlertCircle, Sparkles, Calendar, DollarSign, 
    Eye, Package, SlidersHorizontal, ChevronRight, ChevronLeft, Bot, Send, User, ChevronDown, MessageSquare, ExternalLink, Info, Check, Search, List, Pencil, X
} from 'lucide-react';
import { GAF_COLORS } from '../constants';
import { GoogleGenAI } from "@google/genai";

// Initialize AI - Removed top-level init to prevent crash
// const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

// ---- COMPONENTS ----

interface FilterConfig {
    gpThreshold: number;
    inventoryThreshold: number;
    viewsThreshold: number;
    priceThreshold: number;
    grossProfitThreshold: number;
}

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

const TAB_DEFAULTS: Record<string, FilterConfig> = {
    underperform: { gpThreshold: 1, inventoryThreshold: 3, viewsThreshold: 250, priceThreshold: 400, grossProfitThreshold: 0 },
    traffic: { gpThreshold: 1, inventoryThreshold: 3, viewsThreshold: 150, priceThreshold: 250, grossProfitThreshold: 0 },
    high: { gpThreshold: 2, inventoryThreshold: 0, viewsThreshold: 100, priceThreshold: 150, grossProfitThreshold: 0 },
    risks: { gpThreshold: 0, inventoryThreshold: 0, viewsThreshold: 0, priceThreshold: 0, grossProfitThreshold: 0 },
    all: { gpThreshold: 0, inventoryThreshold: 0, viewsThreshold: 0, priceThreshold: 0, grossProfitThreshold: 0 }
};

interface ProductTableProps {
    data: ProductPerformance[];
    columns: string[];
    onPriceChange: (sku: string, val: number) => void;
    defaultSortCol?: keyof ProductPerformance;
}

const ProductTable: React.FC<ProductTableProps> = ({ 
    data, 
    columns, 
    onPriceChange, 
    defaultSortCol = 'grossProfit' 
}) => {
    const [sortCol, setSortCol] = useState<keyof ProductPerformance>(defaultSortCol);
    const [sortAsc, setSortAsc] = useState(false);
    const [page, setPage] = useState(1);
    const ROWS_PER_PAGE = 20;

    const handleSort = (col: string) => {
        let key: keyof ProductPerformance | null = null;
        
        // Map Display Header to Data Key
        switch(col) {
            case 'SKU': key = 'sku'; break;
            case 'Name': key = 'name'; break;
            case 'Est GP (30d)': key = 'grossProfit'; break;
            case 'GP/Visit (30d)': key = 'gpPerVisit30d'; break;
            case 'Qty (30d)': key = 'qtyPurchased30d'; break;
            case 'GP/Visit (3m)': key = 'gpPerVisit3m'; break;
            case 'Qty (3m)': key = 'qtyPurchased3m'; break;
            case 'Inv': key = 'inventory'; break;
            case 'Days Left': key = 'daysUntilSoldOut'; break;
            case 'Run Rate OK?': key = 'enoughStockRunRate'; break;
            case 'PREORDER INV AVAIL': key = 'preOrderInventory'; break;
            case 'Next ETA': key = 'nextEta'; break;
            case 'PreOrder Date': key = 'websitePreorderDate'; break;
            case 'Views (30d)': key = 'pageViews30d'; break;
            case 'Views (3m)': key = 'pageViews3m'; break;
            case 'Type': key = 'productType'; break;
            case 'RRP': key = 'rrp'; break;
            case 'Sell Price (Inc GST)': key = 'currentPriceIncGst'; break;
            case 'Cost (Ex)': key = 'costPriceExcGst'; break;
            case 'GP %': key = 'gpPercent'; break;
            case 'Vendor': key = 'vendor'; break;
            case 'Discontinued': key = 'discontinued'; break;
            case 'Comp. Price': key = 'lowestCompetitorPrice'; break;
            case 'Date Published': key = 'publishedDate'; break;
            default: key = 'grossProfit';
        }

        if (key) {
            if (sortCol === key) setSortAsc(!sortAsc);
            else {
                setSortCol(key);
                setSortAsc(false);
            }
        }
    };

    const sortedData = useMemo(() => {
        return [...data].sort((a, b) => {
            // @ts-ignore
            const valA = a[sortCol];
            // @ts-ignore
            const valB = b[sortCol];
            
            if (typeof valA === 'number' && typeof valB === 'number') {
                return sortAsc ? valA - valB : valB - valA;
            }
            const strA = String(valA || "").toLowerCase();
            const strB = String(valB || "").toLowerCase();
            return sortAsc ? strA.localeCompare(strB) : strB.localeCompare(strA);
        });
    }, [data, sortCol, sortAsc]);

    // Reset page when data changes
    useEffect(() => {
        setPage(1);
    }, [data.length]);

    const paginatedData = sortedData.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);
    const totalPages = Math.ceil(data.length / ROWS_PER_PAGE);

    const formatCurrency = (val: number) => 
        new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 2 }).format(val);

    // Uniform font: text-sm (14px), font-normal
    const renderCell = (row: ProductPerformance, col: string) => {
        const baseClass = "text-sm text-gray-900";
        
        switch(col) {
            case 'SKU': return <span className="text-sm text-gray-500 font-medium">{row.sku}</span>;
            case 'Name': 
                return (
                    <div className="min-w-[220px] md:min-w-[250px] max-w-[350px]">
                        <span className={`${baseClass} line-clamp-2 leading-snug md:leading-normal`} title={row.name}>{row.name}</span>
                    </div>
                );
            case 'Est GP (30d)': return <span className={baseClass}>{formatCurrency(row.grossProfit)}</span>;
            case 'GP/Visit (30d)': {
                const isUp = row.gpPerVisit30d > row.gpPerVisit3m;
                const isDown = row.gpPerVisit30d < row.gpPerVisit3m;
                return (
                    <div className="flex items-center">
                        <span className={`text-sm ${row.gpPerVisit30d < 1 ? 'text-red-500' : 'text-emerald-600'}`}>${row.gpPerVisit30d.toFixed(2)}</span>
                        {isUp && <TrendingUp size={14} className="text-emerald-500 ml-1.5" />}
                        {isDown && <TrendingDown size={14} className="text-red-500 ml-1.5" />}
                    </div>
                );
            }
            case 'Qty (30d)': return <span className={baseClass}>{row.qtyPurchased30d}</span>;
            case 'GP/Visit (3m)': return <span className={baseClass}>${row.gpPerVisit3m.toFixed(2)}</span>;
            case 'Qty (3m)': return <span className={baseClass}>{row.qtyPurchased3m}</span>;
            case 'Inv': return <span className={`text-sm ${row.inventory < 5 ? 'text-red-600' : 'text-gray-900'}`}>{row.inventory}</span>;
            case 'Days Left': return <span className={baseClass}>{row.daysUntilSoldOut === 0 ? '-' : Math.round(row.daysUntilSoldOut)}</span>;
            case 'Run Rate OK?': return (
                <span className={`text-[11px] md:text-xs px-2 py-0.5 rounded-full ${row.enoughStockRunRate === 'YES' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {row.enoughStockRunRate}
                </span>
            );
            case 'PREORDER INV AVAIL': return row.preOrderInventory > 0 ? <span className="text-blue-600 text-sm">{row.preOrderInventory}</span> : <span className="text-gray-400 text-sm">-</span>;
            case 'Next ETA': return <span className="text-sm text-gray-900 whitespace-nowrap">{row.nextEta || '-'}</span>;
            case 'PreOrder Date': return <span className="text-sm text-gray-900 whitespace-nowrap">{row.websitePreorderDate || '-'}</span>;
            case 'Views (30d)': {
                const daily30 = row.pageViews30d / 30;
                const daily3m = row.pageViews3m / 90;
                const isUp = daily30 > daily3m;
                const isDown = daily30 < daily3m;
                return (
                    <div className="flex items-center">
                        <span className={baseClass}>{row.pageViews30d.toLocaleString()}</span>
                        {isUp && <TrendingUp size={14} className="text-emerald-500 ml-1.5" />}
                        {isDown && <TrendingDown size={14} className="text-red-500 ml-1.5" />}
                    </div>
                );
            }
            case 'Views (3m)': return <span className={baseClass}>{row.pageViews3m.toLocaleString()}</span>;
            case 'Type': return <span className="text-sm text-gray-900 truncate max-w-[120px] block" title={row.productType}>{row.productType}</span>;
            case 'RRP': return <span className={baseClass}>{formatCurrency(row.rrp)}</span>;
            case 'Sell Price (Inc GST)': {
                const isSale = row.currentPriceIncGst < row.rrp;
                return (
                    <div className="flex items-center group/edit">
                        <span className="text-gray-400 text-xs mr-1">$</span>
                        <input 
                            key={row.currentPriceIncGst} // Force re-render if external update
                            type="number" 
                            className={`w-20 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-orange-500 focus:bg-white outline-none text-sm transition-all px-1 py-0.5 ${isSale ? 'text-emerald-600 font-medium' : 'text-gray-900'}`}
                            defaultValue={row.currentPriceIncGst}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') e.currentTarget.blur();
                            }}
                            onBlur={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val) && val !== row.currentPriceIncGst) {
                                    onPriceChange(row.sku, val);
                                }
                            }}
                        />
                        <Pencil size={12} className="text-gray-300 ml-1" />
                    </div>
                );
            }
            case 'Cost (Ex)': return <span className="text-gray-900 text-sm">{formatCurrency(row.costPriceExcGst)}</span>;
            case 'GP %': return <span className={`text-sm ${row.gpPercent < 0.38 ? 'text-red-600' : 'text-emerald-600'}`}>{(row.gpPercent * 100).toFixed(1)}%</span>;
            case 'Vendor': return <span className="text-sm text-gray-900 truncate max-w-[120px] block" title={row.vendor}>{row.vendor}</span>;
            case 'Discontinued': return row.discontinued ? <span className="text-sm text-red-600">YES</span> : <span className="text-sm text-gray-400">NO</span>;
            case 'Comp. Price': {
                const cleanComp = String(row.lowestCompetitorPrice || "").replace(/[$,\s]/g, "");
                const compVal = parseFloat(cleanComp);
                const isLower = !isNaN(compVal) && compVal > 0 && compVal < row.currentPriceIncGst;
                return <span className={`text-sm ${isLower ? 'text-red-600 font-medium' : 'text-gray-900'}`}>{row.lowestCompetitorPrice}</span>;
            }
            case 'Date Published': {
                 if (!row.publishedDate) return <span className="text-gray-400 text-sm">-</span>;
                 const date = new Date(row.publishedDate);
                 const displayDate = !isNaN(date.getTime()) 
                    ? date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
                    : row.publishedDate;
                 return <span className="text-gray-900 text-sm whitespace-nowrap">{displayDate}</span>;
            }
            case 'GAF URL': {
                const url = row.url.startsWith('http') ? row.url : `https://gymandfitness.com.au${row.url.startsWith('/') ? '' : '/'}${row.url}`;
                return (
                    <a 
                        href={url} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-orange-500 hover:text-orange-700 flex items-center justify-center p-2 md:p-0"
                    >
                        <ExternalLink size={18} className="md:w-4 md:h-4" />
                    </a>
                );
            }
            default: return null;
        }
    };

    if (data.length === 0) return <div className="p-12 text-center text-gray-400 italic bg-white rounded-xl border border-gray-200">No products match current filters.</div>;

    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col h-full overflow-hidden">
            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 8px;
                    height: 8px;
                }
                @media (min-width: 768px) {
                  .custom-scrollbar::-webkit-scrollbar {
                    width: 12px;
                    height: 20px;
                  }
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background-color: #f1f5f9;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: #cbd5e1;
                    border-radius: 6px;
                    border: 3px solid #f1f5f9;
                }
                /* Hide number input arrows */
                input[type=number]::-webkit-inner-spin-button, 
                input[type=number]::-webkit-outer-spin-button { 
                    -webkit-appearance: none; 
                    margin: 0; 
                }
            `}</style>
            <div className="overflow-auto custom-scrollbar flex-1 w-full pb-2">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200 sticky top-0 z-20 shadow-sm">
                        <tr>
                            {columns.map(c => (
                                <th 
                                    key={c} 
                                    className={`px-3 md:px-4 py-2.5 md:py-3 whitespace-nowrap bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors border-r border-gray-100 last:border-0 text-[11px] md:text-sm uppercase tracking-wider ${
                                        c === 'SKU' ? 'sticky left-0 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''
                                    }`}
                                    onClick={() => handleSort(c)}
                                    title={c === 'PREORDER INV AVAIL' ? 'Inventory available after backorders' : undefined}
                                >
                                    <div className="flex items-center gap-1">
                                        {c}
                                        <div className="text-gray-400">
                                           <ChevronDown size={14} className="opacity-50" />
                                        </div>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {paginatedData.map((row) => (
                            <tr key={row.sku} className="hover:bg-orange-50/30 transition-colors group">
                                {columns.map(c => (
                                    <td 
                                        key={c} 
                                        className={`px-3 md:px-4 py-2 md:py-2.5 border-r border-transparent group-hover:border-gray-100 last:border-0 whitespace-nowrap text-gray-900 ${
                                            c === 'SKU' ? 'sticky left-0 z-10 bg-white group-hover:bg-orange-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''
                                        }`}
                                    >
                                        {renderCell(row, c)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            {/* Pagination */}
            <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-t border-gray-200 bg-gray-50 sticky bottom-0 z-10">
                <span className="text-[10px] md:text-xs text-gray-500">
                    {Math.min(data.length, (page - 1) * ROWS_PER_PAGE + 1)}-{Math.min(data.length, page * ROWS_PER_PAGE)} of {data.length}
                </span>
                <div className="flex gap-1 md:gap-2">
                    <button 
                        onClick={() => setPage(p => Math.max(1, p - 1))} 
                        disabled={page === 1}
                        className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-30 transition-all text-gray-600"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span className="flex items-center px-1 text-[10px] md:text-xs font-medium text-gray-600">
                        {page} / {totalPages}
                    </span>
                    <button 
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                        disabled={page === totalPages}
                        className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-30 transition-all text-gray-600"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};

const AIChatPanel = ({ visible, onClose, contextData }: { visible: boolean, onClose: () => void, contextData: ProductPerformance[] }) => {
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: 'model', text: "I'm your Product Strategy AI. I have access to the products currently in view. Ask me to draft emails, analyze vendors, or summarize issues." }
    ]);
    const [thinking, setThinking] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages]);

    const handleSend = async () => {
        const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
        if (!input.trim() || !apiKey) {
             if (!apiKey) {
                 setMessages(prev => [...prev, { role: 'model', text: "API Key not found. Please configure GEMINI_API_KEY." }]);
             }
             return;
        }
        
        const userMsg = input;
        setInput("");
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setThinking(true);

        try {
            const ai = new GoogleGenAI({ apiKey });
            const summaryStats = {
                count: contextData.length,
                totalGP: contextData.reduce((acc, curr) => acc + curr.grossProfit, 0).toFixed(0),
                vendors: [...new Set(contextData.map(d => d.vendor))].slice(0, 10).join(", ")
            };
            
            // INCREASED SAMPLE SIZE TO 1000 TO ENSURE AI SEES RECENTLY PUBLISHED PRODUCTS
            const dataSample = contextData.slice(0, 1000).map(p => ({
                sku: p.sku, name: p.name, gpVisit: p.gpPerVisit30d, views: p.pageViews30d, inv: p.inventory, vendor: p.vendor, published: p.publishedDate
            }));

            const prompt = `
                Role: Retail Strategy Assistant for Gym And Fitness.
                Context: The user is looking at a list of products filtered by strategy criteria.
                Data Summary: ${JSON.stringify(summaryStats)}
                Data Sample (All in view): ${JSON.stringify(dataSample)}
                User Question: ${userMsg}
                Answer concisely.
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
            });

            setMessages(prev => [...prev, { role: 'model', text: response.text || "Sorry, I couldn't generate a response." }]);
        } catch (e) {
            setMessages(prev => [...prev, { role: 'model', text: "Error connecting to AI." }]);
        } finally {
            setThinking(false);
        }
    };

    if (!visible) return null;

    return (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[400px] bg-white shadow-2xl z-[150] flex flex-col border-l border-gray-200 animate-in slide-in-from-right duration-300">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-orange-50">
                <div className="flex items-center gap-2 text-orange-700 font-bold">
                    <Bot size={20} />
                    <span>Strategy Assistant</span>
                </div>
                <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-800 rounded-full hover:bg-orange-100 transition-colors">
                    <X size={20}/>
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50" ref={scrollRef}>
                {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-3 rounded-xl text-sm ${
                            m.role === 'user' 
                                ? 'bg-orange-500 text-white rounded-br-none shadow-sm' 
                                : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm'
                        }`}>
                            {m.text.split('\n').map((line, lIdx) => (
                                <p key={lIdx} className={lIdx > 0 ? "mt-2" : ""}>{line}</p>
                            ))}
                        </div>
                    </div>
                ))}
                {thinking && (
                    <div className="flex justify-start">
                        <div className="bg-white border border-gray-200 p-3 rounded-xl rounded-bl-none shadow-sm flex gap-1">
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-75" />
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150" />
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 border-t border-gray-200 bg-white sticky bottom-0">
                <div className="relative">
                    <input 
                        type="text" 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Ask about these products..."
                        className="w-full pl-4 pr-10 py-3 rounded-xl border border-gray-300 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-sm text-gray-900 bg-white"
                    />
                    <button 
                        onClick={handleSend}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                    >
                        <Send size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function ProductInsightsDashboard() {
  const [data, setData] = useState<ProductInsightsData | null>(() => getCachedProductInsightsData());
  const [loading, setLoading] = useState(() => !getCachedProductInsightsData());
  const [activeTab, setActiveTab] = useState<'underperform' | 'traffic' | 'high' | 'risks' | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProductTypes, setSelectedProductTypes] = useState<string[]>([]);
  const [config, setConfig] = useState<FilterConfig>(TAB_DEFAULTS.all);

  const handleTabChange = (tabId: typeof activeTab) => {
      setActiveTab(tabId);
      if (TAB_DEFAULTS[tabId]) {
          setConfig(TAB_DEFAULTS[tabId]);
      }
  };

  useEffect(() => {
    const load = async () => {
      if (!getCachedProductInsightsData()) {
        const result = await fetchProductInsightsData();
        setData(result);
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(async () => {
        const result = await fetchProductInsightsData();
        setData(result);
    }, 15 * 60 * 1000); // Auto-refresh every 15 minutes
    return () => clearInterval(interval);
  }, []);

  const handlePriceUpdate = (sku: string, newPriceIncGst: number) => {
    setData(prev => {
        if (!prev) return null;
        const updatedPerf = prev.performance.map(p => {
            if (p.sku === sku) {
                const newPriceLessGst = newPriceIncGst / 1.1;
                const newGpPercent = newPriceLessGst !== 0 ? (newPriceLessGst - p.costPriceExcGst) / newPriceLessGst : 0;
                return { ...p, currentPriceIncGst: newPriceIncGst, currentPriceLessGst: newPriceLessGst, gpPercent: newGpPercent };
            }
            return p;
        });
        return { ...prev, performance: updatedPerf };
    });
  };

  // --- FILTER LOGIC ---
  const filteredData = useMemo(() => {
      if (!data?.performance) return [];

      let result = data.performance.filter(p => {
          if (!p.sku || !p.sku.trim()) return false; // Filter out blank SKUs
          if (p.productType?.trim() === 'Internal Use Only') return false;
          // Allow Impulse for 'risks' and 'all', exclude for others
          if (p.vendor?.trim().toUpperCase() === 'IMPULSE' && !['risks', 'all'].includes(activeTab)) return false;
          if (selectedProductTypes.length > 0 && !selectedProductTypes.includes(p.productType)) return false;
          return true;
      });

      if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          result = result.filter(p => (p.name && p.name.toLowerCase().includes(q)) || (p.sku && p.sku.toLowerCase().includes(q)));
      }

      switch(activeTab) {
          case 'underperform':
              return result.filter(p => p.exclusionList !== true && p.gpPerVisit30d < config.gpThreshold && p.inventory > config.inventoryThreshold && p.pageViews30d > config.viewsThreshold && p.currentPriceIncGst > config.priceThreshold && p.url.includes('/'));
          case 'traffic':
              return result.filter(p => p.exclusionList !== true && p.gpPerVisit30d < config.gpThreshold && p.inventory > config.inventoryThreshold && p.pageViews30d < config.viewsThreshold && p.currentPriceIncGst > config.priceThreshold && p.url.includes('/') && p.discontinued === false);
          case 'high':
              return result.filter(p => p.rrp > config.priceThreshold && p.pageViews30d > config.viewsThreshold && p.gpPerVisit30d > config.gpThreshold);
          case 'risks':
              return result.filter(p => p.enoughStockRunRate === 'NO' && p.discontinued === false && p.gpPerVisit30d >= config.gpThreshold && p.inventory >= config.inventoryThreshold && p.pageViews30d >= config.viewsThreshold && p.currentPriceIncGst >= config.priceThreshold && p.grossProfit >= config.grossProfitThreshold);
          case 'all':
              return result.filter(p => p.gpPerVisit30d >= config.gpThreshold && p.inventory >= config.inventoryThreshold && p.pageViews30d >= config.viewsThreshold && p.currentPriceIncGst >= config.priceThreshold && p.grossProfit >= config.grossProfitThreshold);
          default: return result;
      }
  }, [data, activeTab, config, selectedProductTypes, searchQuery]);

  const uniqueProductTypes = useMemo(() => {
    if (!data?.performance) return [];
    return Array.from(new Set(data.performance.map(p => p.productType).filter(t => t && t.trim() !== 'Internal Use Only'))).sort();
  }, [data]);

  const logicDescription = useMemo(() => {
      switch(activeTab) {
          case 'underperform': return `GP/Visit < $${config.gpThreshold}, Inv > ${config.inventoryThreshold}, Views > ${config.viewsThreshold}, Price > $${config.priceThreshold}`;
          case 'traffic': return `GP/Visit < $${config.gpThreshold}, Inv > ${config.inventoryThreshold}, Views < ${config.viewsThreshold}, Price > $${config.priceThreshold}`;
          case 'high': return `GP/Visit > $${config.gpThreshold}, Views > ${config.viewsThreshold}, Price > $${config.priceThreshold}`;
          case 'risks': return `Run Rate=NO. GP>$${config.gpThreshold}, Inv>${config.inventoryThreshold}`;
          case 'all': return `All active products. Filters: GP>$${config.gpThreshold}, Inv>${config.inventoryThreshold}`;
          default: return "";
      }
  }, [activeTab, config]);

  const columns = useMemo(() => [
      'SKU', 'Name', 'Est GP (30d)', 'GP/Visit (30d)', 'Qty (30d)', 'Views (30d)', 'GP/Visit (3m)', 'Qty (3m)', 'Views (3m)',
      'Inv', 'Days Left', 'Run Rate OK?', 'PREORDER INV AVAIL', 'Next ETA', 'PreOrder Date',
      'Type', 'RRP', 'Sell Price (Inc GST)', 'Cost (Ex)', 'GP %', 'Vendor', 'Discontinued', 'Comp. Price', 'Date Published', 'GAF URL'
  ], []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
        <p className="text-gray-500 font-medium">Loading Product Intelligence...</p>
      </div>
    );
  }

  return (
    <div className="bg-[#f8f8fa] h-screen font-sans relative flex flex-col overflow-hidden">
        <AIChatPanel visible={showChat} onClose={() => setShowChat(false)} contextData={filteredData} />
        
        {/* Header */}
        <header className="flex-shrink-0 sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200">
            <div className="mx-auto max-w-[1920px] px-4 py-3 md:py-4 flex items-center justify-between">
                <div>
                    <h1 className="text-lg md:text-xl font-bold tracking-tight text-gray-900">
                        Product Strategy
                    </h1>
                    <div className="flex items-center gap-2 text-[10px] md:text-xs text-gray-500">
                        <Calendar className="w-3 h-3" />
                        <span className="hidden md:inline">Weekly Strategy Meeting View</span>
                        <span className="md:hidden">Strategy View</span>
                    </div>
                </div>
                <button 
                    onClick={() => setShowChat(!showChat)}
                    className={`flex items-center gap-2 px-3 py-2 md:px-4 md:py-2.5 rounded-xl transition-all ${showChat ? 'bg-orange-100 text-orange-700' : 'bg-gray-900 text-white hover:bg-gray-800 shadow-sm'}`}
                >
                    <Bot size={18} />
                    <span className="text-xs md:text-sm font-semibold">AI Analyst</span>
                </button>
            </div>
        </header>

        <main className="max-w-[1920px] mx-auto px-2 md:px-4 py-4 md:py-6 space-y-4 md:space-y-6 w-full flex-1 flex flex-col min-h-0 overflow-hidden">
            
            {/* Strategy Tabs & Search */}
            <div className="flex-shrink-0 flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center">
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full xl:w-auto">
                    <div className="bg-white p-1 rounded-xl border border-gray-200 flex shadow-sm overflow-x-auto custom-scrollbar no-scrollbar-on-mobile">
                        {[
                            { id: 'underperform', label: 'Underperforming', icon: AlertCircle },
                            { id: 'traffic', label: 'Needs Traffic', icon: Eye },
                            { id: 'high', label: 'High Performers', icon: Sparkles },
                            { id: 'risks', label: 'Inventory Risks', icon: Package },
                            { id: 'all', label: 'All', icon: List }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => handleTabChange(tab.id as any)}
                                className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all whitespace-nowrap ${
                                    activeTab === tab.id ? 'bg-orange-50 text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                                }`}
                            >
                                <tab.icon size={14} className="md:w-4 md:h-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="relative w-full md:w-64">
                        <input 
                            type="text" 
                            placeholder="Search SKU..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-1 focus:ring-orange-500 text-xs md:text-sm shadow-sm bg-white text-gray-900"
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    </div>
                </div>

                <button 
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center gap-2 text-xs md:text-sm font-semibold text-gray-600 hover:text-orange-600 transition-colors bg-white px-3 py-2 rounded-lg border border-gray-200"
                >
                    <SlidersHorizontal size={14} />
                    {showFilters ? 'Hide Logic' : 'Adjust Logic'}
                </button>
            </div>

            {/* Adjustable Logic Panel */}
            {showFilters && (
                <div className="flex-shrink-0 bg-white p-4 md:p-6 rounded-xl border border-gray-200 shadow-sm animate-in slide-in-from-top-2">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-6">
                        {[
                            { label: 'GP/Visit ($)', key: 'gpThreshold' },
                            { label: 'Inv Threshold', key: 'inventoryThreshold', disabled: activeTab === 'high' },
                            { label: 'Views (30d)', key: 'viewsThreshold' },
                            { label: 'Price ($)', key: 'priceThreshold' },
                            { label: 'Est GP (30d) ($)', key: 'grossProfitThreshold' }
                        ].map(f => (
                            <div key={f.key}>
                                <label className="text-[10px] md:text-xs font-bold text-gray-500 mb-1 block uppercase tracking-tight">{f.label}</label>
                                <input 
                                    type="number" 
                                    value={(config as any)[f.key]} 
                                    disabled={f.disabled}
                                    onChange={(e) => setConfig({...config, [f.key]: Number(e.target.value)})}
                                    className="w-full p-2 border border-gray-300 rounded-lg text-xs md:text-sm focus:ring-1 focus:ring-orange-500 outline-none disabled:bg-gray-50 text-gray-900 bg-white"
                                />
                            </div>
                        ))}
                        
                        <div className="col-span-2 md:col-span-3 lg:col-span-1">
                            <label className="text-[10px] md:text-xs font-bold text-gray-500 mb-1 block uppercase">Type Filter</label>
                            <div className="border border-gray-300 rounded-lg p-2 h-24 overflow-y-auto bg-gray-50/50 custom-scrollbar">
                                {uniqueProductTypes.map(type => (
                                   <div key={type} className="flex items-center gap-2 mb-1 cursor-pointer" onClick={() => {
                                        setSelectedProductTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
                                   }}>
                                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${selectedProductTypes.includes(type) ? 'bg-orange-500 border-orange-500' : 'border-gray-300 bg-white'}`}>
                                          {selectedProductTypes.includes(type) && <Check size={10} className="text-white" />}
                                      </div>
                                      <span className="text-[10px] md:text-xs text-gray-700 truncate">{type}</span>
                                   </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Data View */}
            <div className="flex-1 flex flex-col min-h-0">
                 <div className="flex-shrink-0 flex flex-col md:flex-row justify-between items-start md:items-center mb-3 gap-2 px-1">
                    <div>
                        <h2 className="text-sm md:text-lg font-bold text-gray-900 leading-tight">
                            {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Products
                        </h2>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] md:text-xs text-gray-500">
                            <Info size={12} className="text-orange-400" />
                            <span className="truncate max-w-[280px] md:max-w-none">{logicDescription}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] md:text-sm font-bold text-gray-900 bg-orange-100 text-orange-700 px-2 py-1 rounded-lg">
                           {filteredData.length} items
                        </span>
                    </div>
                 </div>

                 <ProductTable 
                    key={activeTab} 
                    data={filteredData} 
                    columns={columns} 
                    onPriceChange={handlePriceUpdate} 
                    defaultSortCol={activeTab === 'risks' ? 'grossProfit' : activeTab === 'underperform' ? 'pageViews30d' : 'grossProfit'}
                 />
            </div>
        </main>
    </div>
  );
}
