
import React, { useState, useEffect, useMemo } from "react"
import Papa from "papaparse"
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "./ui/chart"
import { Info } from "lucide-react"

/* -------------------------------------------------------------------------- */
/*  CONSTANTS                                                                 */
/* -------------------------------------------------------------------------- */

const fyMonths = [
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
]

const calendarMonths = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
]

const today = new Date()

// Fiscal Year Helpers (July - June)
const fyMonthIndex = (today.getMonth() + 6) % 12
const currentMonth = fyMonths[fyMonthIndex]
const nextMonth = fyMonths[(fyMonthIndex + 1) % 12]
const currentQuarterIndex = Math.floor(fyMonthIndex / 3)
const currentQuarter = ["Q1", "Q2", "Q3", "Q4"][currentQuarterIndex]
const lastQuarterIndex = (currentQuarterIndex - 1 + 4) % 4
const lastQuarter = ["Q1", "Q2", "Q3", "Q4"][lastQuarterIndex]
const fiscalYear = today.getMonth() >= 6 ? today.getFullYear() + 1 : today.getFullYear()
const fiscalYearLabel = `FY${String(fiscalYear).slice(-2)}`

// Calendar Year Helpers (Jan - Dec) - For USA
const currentCalMonthIndex = today.getMonth()
const currentCalMonth = calendarMonths[currentCalMonthIndex]
const currentCalQuarterIndex = Math.floor(currentCalMonthIndex / 3)
const currentCalQuarter = ["Q1", "Q2", "Q3", "Q4"][currentCalQuarterIndex]
const currentCalYear = today.getFullYear()

// Updated indices based on A=0, B=1, C=2 (Budget), D=3 (Actual)
// July starts at index 2.
// Skips after December (14, 15 assumed to be HY1 summaries).
const monthColumns = {
  JULY: { budget: 2, actual: 3 },
  AUGUST: { budget: 4, actual: 5 },
  SEPTEMBER: { budget: 6, actual: 7 },
  OCTOBER: { budget: 8, actual: 9 },
  NOVEMBER: { budget: 10, actual: 11 },
  DECEMBER: { budget: 12, actual: 13 },
  JANUARY: { budget: 16, actual: 17 }, // Skips 14, 15
  FEBRUARY: { budget: 18, actual: 19 },
  MARCH: { budget: 20, actual: 21 },
  APRIL: { budget: 22, actual: 23 },
  MAY: { budget: 24, actual: 25 },
  JUNE: { budget: 26, actual: 27 },
}

const europeCountries = [
  "Austria",
  "Belgium",
  "Bulgaria",
  "Croatia",
  "Cyprus",
  "Czechia",
  "Czech Republic",
  "Denmark",
  "Estonia",
  "Finland",
  "France",
  "Germany",
  "Greece",
  "Hungary",
  "Ireland",
  "Italy",
  "Latvia",
  "Lithuania",
  "Luxembourg",
  "Malta",
  "Netherlands",
  "Poland",
  "Portugal",
  "Romania",
  "Slovakia",
  "Slovenia",
  "Spain",
  "Sweden",
  "United Kingdom",
  "UK",
  "Norway",
  "Switzerland",
  "Ukraine",
]

const cleanCurrency = (v: any) => {
  if (!v) return 0
  const n = Number.parseFloat(v.toString().replace(/[$,\s]/g, ""))
  return Number.isNaN(n) ? 0 : n
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)

const formatCompactCurrency = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M` : v >= 1_000 ? `$${(v / 1_000).toFixed(2)}K` : formatCurrency(v)

const formatPercent = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`

const parseDate = (dateStr: string) => {
  if (!dateStr) return null;
  const parts = dateStr.split(/[-/]/);
  if (parts.length !== 3) return null;
  // Assume dd/mm/yyyy or dd-mm-yyyy
  return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
}

/* -------------------------------------------------------------------------- */
/*  REVENUE BY MARKET TABLE                                                   */
/* -------------------------------------------------------------------------- */

type RevenueGroups = {
  groups: {
    [group: string]: {
      customers: Array<{
        name: string
        country: string
        actual: number
        budget: number
      }>
      countries: string[]
      totalActual: number
      totalBudget: number
    }
  }
  grandActual: number
  grandBudget: number
}

const RevenueByMarketTable = ({ data }: { data: RevenueGroups | null }) => {
  const [open, setOpen] = useState<Set<string>>(new Set())
  if (!data) return null

  const { groups, grandActual } = data
  const icon = (g: string) => ({ Europe: "🇪🇺", "Emerging Markets": "🌏", "Existing Markets": "🏷️" }[g] || "🌐")
  const toggle = (g: string) => {
    const n = new Set(open)
    n.has(g) ? n.delete(g) : n.add(g)
    setOpen(n)
  }

  const sorted = Object.entries(groups).sort(([, a], [, b]) => b.totalActual - a.totalActual)

  const varianceBadge = (variance: number) => (
    <span
      className={`px-2 py-1 rounded-md text-xs font-medium ${
        variance >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
      }`}
    >
      {formatPercent(variance)}
    </span>
  )

  return (
    <div className="overflow-auto max-h-96">
      <table className="w-full">
        <thead className="sticky top-0 bg-[#E6EAF1] z-10">
          <tr className="border-b-2 border-[#A5AEB7] text-left text-sm font-semibold text-[#425660]">
            <th className="py-4 px-3 bg-[#E6EAF1]">Market Group</th>
            <th className="py-4 px-3 bg-[#E6EAF1]">Customer / Country</th>
            <th className="py-4 px-3 text-right bg-[#E6EAF1]">YTD Actual</th>
            <th className="py-4 px-3 text-right bg-[#E6EAF1]">% of Total</th>
            <th className="py-4 px-3 text-right bg-[#E6EAF1]">Variance vs Budget</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(([g, d]) => {
            const variance = d.totalBudget ? ((d.totalActual - d.totalBudget) / d.totalBudget) * 100 : 0
            return (
              <React.Fragment key={g}>
                <tr
                  onClick={() => toggle(g)}
                  className={`cursor-pointer border-b transition-colors hover:bg-[#E6EAF1] ${
                    open.has(g) ? "bg-[#E6EAF1]" : ""
                  }`}
                  style={{ borderColor: "#A5AEB7" }}
                >
                  <td className="py-4 px-3">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{icon(g)}</span>
                      <div>
                        <div className="font-bold text-lg text-[#185787]">{g}</div>
                        <div className="text-xs text-[#425660]">
                          {d.customers.length} customers • {d.countries.length} countries
                        </div>
                      </div>
                      <div className="ml-auto">
                        <span className="text-lg text-[#425660]">{open.has(g) ? "▼" : "▶"}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-3 text-sm text-[#425660]">{d.countries.join(", ")}</td>
                  <td className="py-4 px-3 text-right font-bold text-lg text-[#185787]">
                    {formatCompactCurrency(d.totalActual)}
                  </td>
                  <td className="py-4 px-3 text-right font-bold text-lg text-[#185787]">
                    {(grandActual ? (d.totalActual / grandActual) * 100 : 0).toFixed(1)}%
                  </td>
                  <td className="py-4 px-3 text-right">{varianceBadge(variance)}</td>
                </tr>
                {open.has(g) &&
                  d.customers.map((c, i) => {
                    const v = c.budget ? ((c.actual - c.budget) / c.budget) * 100 : 0
                    return (
                      <tr
                        key={c.name}
                        className="border-b hover:bg-[#E6EAF1]"
                        style={{ borderColor: "#E6EAF1", backgroundColor: i % 2 ? "#FFFFFF" : "#FAFBFC" }}
                      >
                        <td className="py-3 pl-12">
                          <div className="w-2 h-2 bg-[#A5AEB7] rounded-full" />
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-sm text-[#081C28]">{c.name}</div>
                          <div className="text-xs text-[#425660]">{c.country}</div>
                        </td>
                        <td className="py-3 px-3 text-right text-sm text-[#081C28]">
                          {formatCompactCurrency(c.actual)}
                        </td>
                        <td className="py-3 px-3 text-right text-sm text-[#425660]">
                          {(grandActual ? (c.actual / grandActual) * 100 : 0).toFixed(1)}%
                        </td>
                        <td className="py-3 px-3 text-right text-sm">{varianceBadge(v)}</td>
                      </tr>
                    )
                  })}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  MONTHLY PERFORMANCE CHART (GLOBAL)                                        */
/* -------------------------------------------------------------------------- */

const MonthlyPerformanceChart = ({ data, fyLabel }: { data: any; fyLabel: string }) => {
  if (!data) return null

  const chartData = data.monthly.map((item: any, index: number) => ({
    month: item.month.substring(0, 3),
    actual: item.actual,
    budget: item.budget,
    isCurrent: index === fyMonthIndex,
    isPast: index < fyMonthIndex,
    isFuture: index > fyMonthIndex,
  }))

  const totalVariance = data.ytd.b ? ((data.ytd.a - data.ytd.b) / data.ytd.b) * 100 : 0

  return (
    <div className="bg-white border border-[#A5AEB7] rounded-2xl p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-2 h-6 bg-[#185787] rounded-full" />
          <h3 className="text-xl font-bold text-[#081C28]">Monthly Performance - {fyLabel}</h3>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 bg-[#185787] rounded"></div>
            <span className="text-[#425660]">Actual</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 bg-[#425660] rounded"></div>
            <span className="text-[#425660]">Budget</span>
          </div>
          <span
            className={`px-3 py-1 rounded-md text-sm font-medium ${
              totalVariance >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}
          >
            YTD: {formatPercent(totalVariance)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        <div className="lg:col-span-3">
          <ChartContainer
            config={{
              actual: { label: "Actual Revenue", color: "#185787" },
              budget: { label: "Budget Target", color: "#425660" },
            }}
            className="h-[300px]"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6EAF1" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: "#425660" }}
                  tickFormatter={(value, index) => {
                    const item = chartData[index]
                    return item?.isCurrent ? `${value}*` : value
                  }}
                />
                <YAxis
                  tickFormatter={(value) => formatCompactCurrency(value)}
                  tick={{ fontSize: 12, fill: "#425660" }}
                />
                <ChartTooltip
                  cursor={{fill: 'transparent'}}
                  content={<ChartTooltipContent className="bg-[#081C28] border-[#425660] text-white" />}
                  contentStyle={{ backgroundColor: "#081C28", borderColor: "#425660", color: "#FFF" }}
                  labelStyle={{ color: "#FFF", fontWeight: "bold" }}
                  itemStyle={{ color: "#FFF" }}
                  formatter={(value: any, name: string) => [
                    formatCurrency(value),
                    name === "Actual Revenue" ? "Actual" : "Budget",
                  ]}
                />
                <Bar dataKey="actual" fill="#185787" name="Actual Revenue" radius={[4, 4, 0, 0]} />
                <Bar dataKey="budget" fill="#425660" name="Budget Target" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
          <div className="mt-2 text-xs text-[#425660] text-center">
            * Current Month | Past months show actual vs budget | Future months show budget targets
          </div>
        </div>

        <div className="space-y-4">
          <div className="text-center p-4 bg-[#E6EAF1] rounded-xl border border-[#A5AEB7]">
            <div className="text-sm font-medium text-[#185787] mb-1">YTD Actual</div>
            <div className="text-2xl font-bold text-[#185787]">{formatCompactCurrency(data.ytd.a)}</div>
          </div>
          <div className="text-center p-4 bg-[#E6EAF1] rounded-xl">
            <div className="text-sm font-medium text-[#425660] mb-1">YTD Budget</div>
            <div className="text-2xl font-bold text-[#425660]">{formatCompactCurrency(data.ytd.b)}</div>
          </div>
          <div className="text-center p-4 bg-[#E6EAF1] rounded-xl">
            <div className="text-sm font-medium text-[#425660] mb-1">Variance</div>
            <div className={`text-xl font-bold ${totalVariance >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCompactCurrency(data.ytd.a - data.ytd.b)}
            </div>
            <div className={`text-sm ${totalVariance >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatPercent(totalVariance)}
            </div>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-xl border border-yellow-200">
            <div className="text-sm font-medium text-yellow-600 mb-1">Current Month</div>
            <div className="text-lg font-bold text-yellow-700">{currentMonth}</div>
            <div className="text-sm text-yellow-600">{formatCompactCurrency(data.currentMonth.a)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  AFS MONTHLY PERFORMANCE CHART                                             */
/* -------------------------------------------------------------------------- */

const AFSMonthlyPerformanceChart = ({ data, fyLabel }: { data: any; fyLabel: string }) => {
  if (!data) return null

  const chartData = data.monthly.map((item: any, index: number) => ({
    month: item.month.substring(0, 3),
    actual: item.actual,
    isCurrent: index === fyMonthIndex,
    isPast: index < fyMonthIndex,
    isFuture: index > fyMonthIndex,
  }))

  return (
    <div className="bg-white border border-[#00AC75] rounded-2xl p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-2 h-6 bg-[#00AC75] rounded-full" />
          <h3 className="text-xl font-bold text-[#081C28]">Monthly Performance (AFS) - {fyLabel}</h3>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 bg-[#00AC75] rounded"></div>
            <span className="text-[#425660]">Net Purchases</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        <div className="lg:col-span-3">
          <ChartContainer config={{ actual: { label: "Net Purchases", color: "#00AC75" } }} className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6EAF1" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: "#425660" }}
                  tickFormatter={(value, index) => {
                    const item = chartData[index]
                    return item?.isCurrent ? `${value}*` : value
                  }}
                />
                <YAxis
                  tickFormatter={(value) => formatCompactCurrency(value)}
                  tick={{ fontSize: 12, fill: "#425660" }}
                />
                <ChartTooltip
                  cursor={{fill: 'transparent'}}
                  content={<ChartTooltipContent className="bg-[#081C28] border-[#425660] text-white" />}
                  contentStyle={{ backgroundColor: "#081C28", borderColor: "#425660", color: "#FFF" }}
                  labelStyle={{ color: "#FFF", fontWeight: "bold" }}
                  itemStyle={{ color: "#FFF" }}
                  formatter={(value: any) => [formatCurrency(value), "Net Purchases"]}
                />
                <Bar dataKey="actual" fill="#00AC75" name="Net Purchases" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
          <div className="mt-2 text-xs text-[#425660] text-center">
            * Current Month
          </div>
        </div>

        <div className="space-y-4">
          <div className="text-center p-4 bg-[#E6EAF1] rounded-xl border border-[#A5AEB7]">
            <div className="text-sm font-medium text-[#00AC75] mb-1">YTD Net Purchases</div>
            <div className="text-2xl font-bold text-[#00AC75]">{formatCompactCurrency(data.ytd.a)}</div>
          </div>
          
          <div className="text-center p-4 bg-yellow-50 rounded-xl border border-yellow-200">
            <div className="text-sm font-medium text-yellow-600 mb-1">Current Month</div>
            <div className="text-lg font-bold text-yellow-700">{currentMonth}</div>
            <div className="text-sm text-yellow-600">{formatCompactCurrency(data.currentMonth.a)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  USA MONTHLY PERFORMANCE CHART                                             */
/* -------------------------------------------------------------------------- */

const USAMonthlyPerformanceChart = ({ data, fyLabel }: { data: any; fyLabel: string }) => {
  if (!data) return null

  const chartData = data.monthly.map((item: any, index: number) => ({
    month: item.month.substring(0, 3),
    actual: item.actual,
    isCurrent: index === fyMonthIndex,
    isPast: index < fyMonthIndex,
    isFuture: index > fyMonthIndex,
  }))

  return (
    <div className="bg-white border border-[#D92D20] rounded-2xl p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-2 h-6 bg-[#D92D20] rounded-full" />
          <h3 className="text-xl font-bold text-[#081C28]">Monthly Performance (USA) - {fyLabel}</h3>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 bg-[#D92D20] rounded"></div>
            <span className="text-[#425660]">Net Purchases</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        <div className="lg:col-span-3">
          <ChartContainer
            config={{
              actual: { label: "Net Purchases", color: "#D92D20" },
            }}
            className="h-[300px]"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6EAF1" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: "#425660" }}
                  tickFormatter={(value, index) => {
                    const item = chartData[index]
                    return item?.isCurrent ? `${value}*` : value
                  }}
                />
                <YAxis
                  tickFormatter={(value) => formatCompactCurrency(value)}
                  tick={{ fontSize: 12, fill: "#425660" }}
                />
                <ChartTooltip
                  cursor={{fill: 'transparent'}}
                  content={<ChartTooltipContent className="bg-[#081C28] border-[#425660] text-white" />}
                  contentStyle={{ backgroundColor: "#081C28", borderColor: "#425660", color: "#FFF" }}
                  labelStyle={{ color: "#FFF", fontWeight: "bold" }}
                  itemStyle={{ color: "#FFF" }}
                  formatter={(value: any) => [formatCurrency(value), "Net Purchases"]}
                />
                <Bar dataKey="actual" fill="#D92D20" name="Net Purchases" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
          <div className="mt-2 text-xs text-[#425660] text-center">
            * Current Month
          </div>
        </div>

        <div className="space-y-4">
          <div className="text-center p-4 bg-[#E6EAF1] rounded-xl border border-[#A5AEB7]">
            <div className="text-sm font-medium text-[#D92D20] mb-1">YTD Net Purchases</div>
            <div className="text-2xl font-bold text-[#D92D20]">{formatCompactCurrency(data.ytd.a)}</div>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-xl border border-yellow-200">
            <div className="text-sm font-medium text-yellow-600 mb-1">Current Month</div>
            <div className="text-lg font-bold text-yellow-700">{currentMonth}</div>
            <div className="text-sm text-yellow-600">{formatCompactCurrency(data.currentMonth.a)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  DASHBOARD                                                                 */
/* -------------------------------------------------------------------------- */

const SalesHealthDashboard = () => {
  const [salesData, setSalesData] = useState<any>(null)
  const [fy27Data, setFy27Data] = useState<any>(null)
  const [afsData, setAfsData] = useState<any>(null)
  const [usaData, setUsaData] = useState<any>(null)
  const [fy27Afs, setFy27Afs] = useState<any>(null)
  const [fy27Usa, setFy27Usa] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCustomer, setCustomer] = useState("All")
  const [selectedCountry, setCountry] = useState("All")
  const [fyExport, setFyExport] = useState(fiscalYearLabel)
  const [fyAfs, setFyAfs] = useState(fiscalYearLabel)
  const [fyUsa, setFyUsa] = useState(fiscalYearLabel)

  /* ----------- LOAD SALES CSV ---------------------------------- */
  useEffect(() => {
    const load = async () => {
      try {
        const url =
          "https://docs.google.com/spreadsheets/d/e/2PACX-1vQiboUvN6uqddlmcX7SqCwKbgtDrvxffq945XtCYb8qQNhOTZXZZ_phwIZQR3VVjti_CI4EjJDZR-lB/pub?gid=2093632728&single=true&output=csv"
        const csv = await (await fetch(url + "&t=" + new Date().getTime(), { cache: "no-store" })).text()
        const rows = Papa.parse(csv, { header: false, skipEmptyLines: true }).data as string[][]
        const customers: any[] = []
        let totalRow: any = null

        for (let i = 2; i < rows.length; i++) {
          const row = rows[i]
          const nameRaw = row[0]?.toString().trim()
          if (!nameRaw) continue
          
          if (/^TOTAL\b/i.test(nameRaw)) {
            totalRow = row
            break 
          }

          if (/licen[cs]e fee/i.test(nameRaw)) continue

          const country = row[1]?.toString().trim() || "Unknown"
          const cust: any = { name: nameRaw, country, monthlyData: {} as any }

          fyMonths.forEach((m) => {
            const col = monthColumns[m as keyof typeof monthColumns]
            const bVal = row[col.budget]
            const aVal = row[col.actual]
            
            cust.monthlyData[m] = {
              budget: cleanCurrency(bVal),
              actual: cleanCurrency(aVal),
            }
          })
          customers.push(cust)
        }
        
        let parsedTotalRow: any = null
        if (totalRow) {
             parsedTotalRow = { monthlyData: {} }
             fyMonths.forEach((m) => {
                const col = monthColumns[m as keyof typeof monthColumns]
                parsedTotalRow.monthlyData[m] = {
                  budget: cleanCurrency(totalRow[col.budget]),
                  actual: cleanCurrency(totalRow[col.actual]),
                }
             })
        }

        setSalesData({ customers, totalRow: parsedTotalRow })
      } catch (e) {
        console.error("Sales data load error:", e)
      }
    }
    load()
  }, [])

  /* ----------- LOAD FY27 SALES CSV ----------------------------- */
  useEffect(() => {
    const load = async () => {
      try {
        const url =
          "https://docs.google.com/spreadsheets/d/e/2PACX-1vQiboUvN6uqddlmcX7SqCwKbgtDrvxffq945XtCYb8qQNhOTZXZZ_phwIZQR3VVjti_CI4EjJDZR-lB/pub?gid=1758000461&single=true&output=csv"
        const csv = await (await fetch(url + "&t=" + new Date().getTime(), { cache: "no-store" })).text()
        const rows = Papa.parse(csv, { header: false, skipEmptyLines: true }).data as string[][]
        const customers: any[] = []
        let totalRow: any = null

        for (let i = 2; i < rows.length; i++) {
          const row = rows[i]
          const nameRaw = row[0]?.toString().trim()
          if (!nameRaw) continue

          if (/^TOTAL\b/i.test(nameRaw)) {
            totalRow = row
            break
          }

          if (/licen[cs]e fee/i.test(nameRaw)) continue
          if (/^NEW CUSTOMERS$/i.test(nameRaw)) continue

          const country = row[1]?.toString().trim() || "Unknown"
          const cust: any = { name: nameRaw, country, monthlyData: {} as any }

          fyMonths.forEach((m) => {
            const col = monthColumns[m as keyof typeof monthColumns]
            cust.monthlyData[m] = {
              budget: cleanCurrency(row[col.budget]),
              actual: cleanCurrency(row[col.actual]),
            }
          })
          customers.push(cust)
        }

        let parsedTotalRow: any = null
        if (totalRow) {
          parsedTotalRow = { monthlyData: {} }
          fyMonths.forEach((m) => {
            const col = monthColumns[m as keyof typeof monthColumns]
            parsedTotalRow.monthlyData[m] = {
              budget: cleanCurrency(totalRow[col.budget]),
              actual: cleanCurrency(totalRow[col.actual]),
            }
          })
        }

        setFy27Data({ customers, totalRow: parsedTotalRow })
      } catch (e) {
        console.error("FY27 sales data load error:", e)
      }
    }
    load()
  }, [])

  /* ----------- LOAD AFS & USA CSV ------------------------------ */
  useEffect(() => {
    const load = async () => {
      try {
        const url =
          "https://docs.google.com/spreadsheets/d/e/2PACX-1vQDf8HwsLmIV1hYg4NUNQLiPrvGPQanZbGXMQba2AwltJSXGBmuyLpR6RNgIArIUugaxxiKxd-J8pSk/pub?gid=2041734228&single=true&output=csv"
        const csv = await (await fetch(url + "&t=" + new Date().getTime(), { cache: "no-store" })).text()
        
        // Use header: false to reliably access columns by index (B=1, C=2)
        const parsed = Papa.parse(csv, { header: false, skipEmptyLines: true })
        const rows = parsed.data as string[][]

        const afsMonthly: any = {}
        const usaMonthly: any = {}
        const afs27Monthly: any = {}
        const usa27Monthly: any = {}

        fyMonths.forEach((m) => {
          afsMonthly[m] = { actual: 0 }
          usaMonthly[m] = { actual: 0 }
          afs27Monthly[m] = { actual: 0 }
          usa27Monthly[m] = { actual: 0 }
        })

        const monthMapping: { [key: string]: string } = {
          "July 2025": "JULY",
          "August 2025": "AUGUST",
          "September 2025": "SEPTEMBER",
          "October 2025": "OCTOBER",
          "November 2025": "NOVEMBER",
          "December 2025": "DECEMBER",
          "January 2026": "JANUARY",
          "February 2026": "FEBRUARY",
          "March 2026": "MARCH",
          "April 2026": "APRIL",
          "May 2026": "MAY",
          "June 2026": "JUNE",
        }

        const monthMapping27: { [key: string]: string } = {
          "July 2026": "JULY",
          "August 2026": "AUGUST",
          "September 2026": "SEPTEMBER",
          "October 2026": "OCTOBER",
          "November 2026": "NOVEMBER",
          "December 2026": "DECEMBER",
          "January 2027": "JANUARY",
          "February 2027": "FEBRUARY",
          "March 2027": "MARCH",
          "April 2027": "APRIL",
          "May 2027": "MAY",
          "June 2027": "JUNE",
        }

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i]
            const monthRaw = (row[0] || "").toString().trim()
            const afsVal = cleanCurrency(row[1])
            const usaVal = cleanCurrency(row[2])

            const fyMonth = monthMapping[monthRaw]
            if (fyMonth) {
                afsMonthly[fyMonth].actual = afsVal
                usaMonthly[fyMonth].actual = usaVal
            }
            const fy27Month = monthMapping27[monthRaw]
            if (fy27Month) {
                afs27Monthly[fy27Month].actual = afsVal
                usa27Monthly[fy27Month].actual = usaVal
            }
        }

        setAfsData({ monthlyData: afsMonthly })
        setUsaData({ monthlyData: usaMonthly })
        setFy27Afs({ monthlyData: afs27Monthly })
        setFy27Usa({ monthlyData: usa27Monthly })
      } catch (e) {
        console.error("AFS/USA data load error:", e)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (salesData && afsData && usaData) setLoading(false)
  }, [salesData, afsData, usaData])

  const activeData = useMemo(() => fyExport === "FY27" ? fy27Data : salesData, [fyExport, fy27Data, salesData])
  const activeAfs = useMemo(() => fyAfs === "FY27" ? fy27Afs : afsData, [fyAfs, fy27Afs, afsData])
  const activeUsa = useMemo(() => fyUsa === "FY27" ? fy27Usa : usaData, [fyUsa, fy27Usa, usaData])

  /* ---------------- SALES FILTERS & METRICS -------------------- */
  const filtered = useMemo(() => {
    if (!activeData) return null
    let arr = activeData.customers
    if (selectedCustomer !== "All") arr = arr.filter((c: any) => c.name === selectedCustomer)
    if (selectedCountry !== "All") arr = arr.filter((c: any) => c.country === selectedCountry)
    return arr
  }, [activeData, selectedCustomer, selectedCountry])

  const summary = useMemo(() => {
    // Degrade to a zeroed summary (not null) so the dashboard renders an empty state
    // instead of crashing when the selected FY has no data yet (e.g. early FY27).
    if (!activeData) return { currentMonth: { b: 0, a: 0 }, nextMonth: { b: 0, a: 0 }, currentQuarter: { b: 0, a: 0 }, lastQuarter: { b: 0, a: 0 }, ytd: { b: 0, a: 0 }, monthly: [] as any[] }
    const out: any = {
      currentMonth: { b: 0, a: 0 },
      nextMonth: { b: 0, a: 0 },
      currentQuarter: { b: 0, a: 0 },
      lastQuarter: { b: 0, a: 0 },
      ytd: { b: 0, a: 0 },
      monthly: [] as any[],
    }

    const useTotalRow = selectedCustomer === "All" && selectedCountry === "All" && activeData.totalRow;

    if (useTotalRow) {
         const t = activeData.totalRow;
         fyMonths.forEach((m, idx) => {
            const mb = t.monthlyData[m].budget;
            const ma = t.monthlyData[m].actual;
            const qIdx = Math.floor(idx / 3);
            
            out.monthly.push({ month: m, budget: mb, actual: ma });
            
            if (m === currentMonth) out.currentMonth = { b: mb, a: ma };
            if (m === nextMonth) out.nextMonth = { b: mb, a: ma };
            if (qIdx === currentQuarterIndex) {
                out.currentQuarter.b += mb;
                out.currentQuarter.a += ma;
            }
            if (qIdx === lastQuarterIndex) {
                out.lastQuarter.b += mb;
                out.lastQuarter.a += ma;
            }
            if (idx <= fyMonthIndex) {
                out.ytd.b += mb;
                out.ytd.a += ma;
            }
         });
    } else if (filtered) {
        fyMonths.forEach((m, idx) => {
          let mb = 0, ma = 0
          const qIdx = Math.floor(idx / 3);
          filtered.forEach((c: any) => {
            mb += c.monthlyData[m].budget
            ma += c.monthlyData[m].actual
          })
          out.monthly.push({ month: m, budget: mb, actual: ma })
          if (m === currentMonth) out.currentMonth = { b: mb, a: ma }
          if (m === nextMonth) out.nextMonth = { b: mb, a: ma }
          if (qIdx === currentQuarterIndex) {
            out.currentQuarter.b += mb
            out.currentQuarter.a += ma
          }
          if (qIdx === lastQuarterIndex) {
            out.lastQuarter.b += mb
            out.lastQuarter.a += ma
          }
          if (idx <= fyMonthIndex) {
            out.ytd.b += mb
            out.ytd.a += ma
          }
        })
    }
    
    return out
  }, [activeData, filtered, selectedCustomer, selectedCountry])

  /* ---------------- AFS METRICS -------------------------------- */
  const afsSummary = useMemo(() => {
    if (!activeAfs) return { currentMonth: { b: 0, a: 0 }, nextMonth: { b: 0, a: 0 }, currentQuarter: { b: 0, a: 0 }, ytd: { b: 0, a: 0 }, monthly: [] as any[] }
    const out: any = {
      currentMonth: { b: 0, a: 0 },
      nextMonth: { b: 0, a: 0 },
      currentQuarter: { b: 0, a: 0 },
      ytd: { b: 0, a: 0 },
      monthly: [] as any[],
    }

    fyMonths.forEach((m, idx) => {
      const ma = activeAfs.monthlyData[m].actual
      out.monthly.push({ month: m, budget: 0, actual: ma })
      if (m === currentMonth) out.currentMonth = { b: 0, a: ma }
      if (m === nextMonth) out.nextMonth = { b: 0, a: ma }
      if (Math.floor(idx / 3) === currentQuarterIndex) {
        out.currentQuarter.a += ma
      }
      if (idx <= fyMonthIndex) {
        out.ytd.a += ma
      }
    })
    return out
  }, [activeAfs])

  /* ---------------- USA METRICS -------------------------------- */
  const usaSummary = useMemo(() => {
    if (!activeUsa) return { currentMonth: { a: 0 }, currentQuarter: { a: 0 }, ytd: { a: 0 }, monthly: [] as any[] }
    const out: any = {
      currentMonth: { a: 0 },
      currentQuarter: { a: 0 },
      ytd: { a: 0 },
      monthly: [] as any[],
    }

    fyMonths.forEach((m, idx) => {
      const ma = activeUsa.monthlyData[m].actual
      out.monthly.push({ month: m, actual: ma })
      
      if (m === currentMonth) out.currentMonth = { a: ma }
      if (Math.floor(idx / 3) === currentQuarterIndex) {
        out.currentQuarter.a += ma
      }
      if (idx <= fyMonthIndex) {
        out.ytd.a += ma
      }
    })
    return out
  }, [activeUsa])

  const revenueGroups: RevenueGroups | null = useMemo(() => {
    if (!activeData) return null
    const groups: any = {}
    const push = (g: string, c: any, act: number, bud: number) => {
      if (!groups[g]) groups[g] = { customers: [], countries: new Set<string>(), totalActual: 0, totalBudget: 0 }
      groups[g].customers.push({ name: c.name, country: c.country, actual: act, budget: bud })
      groups[g].countries.add(c.country)
      groups[g].totalActual += act
      groups[g].totalBudget += bud
    }

    let grandActual = 0
    let grandBudget = 0

    activeData.customers.forEach((c: any) => {
      let ytdA = 0
      let ytdB = 0
      fyMonths.forEach((m, idx) => {
        if (idx <= fyMonthIndex) {
          ytdA += c.monthlyData[m].actual
          ytdB += c.monthlyData[m].budget
        }
      })
      
      let g = "Existing Markets"
      if (europeCountries.includes(c.country)) g = "Europe"
      if (["UAE", "United Arab Emirates", "Saudi Arabia"].includes(c.country)) g = "Emerging Markets"

      push(g, c, ytdA, ytdB)
      grandActual += ytdA
      grandBudget += ytdB
    })

    Object.values(groups).forEach((g: any) => (g.countries = [...g.countries].sort()))
    return { groups, grandActual, grandBudget }
  }, [activeData])

  const uniqueCustomers = useMemo<string[]>(
    () => (activeData ? ([...new Set(activeData.customers.map((c: any) => c.name))] as string[]).sort() : []),
    [activeData],
  )
  const uniqueCountries = useMemo<string[]>(
    () => (activeData ? ([...new Set(activeData.customers.map((c: any) => c.country))] as string[]).sort() : []),
    [activeData],
  )

  /* ---------------------- UI helpers --------------------------- */
  const Card = ({ title, badge, value, target }: { title: string; badge: string; value: number; target: number }) => {
    const variance = target ? ((value - target) / target) * 100 : 0
    const remaining = target - value
    const isOnTrack = value >= target

    return (
      <div className="rounded-2xl p-6 bg-white border border-[#A5AEB7] shadow hover:scale-[1.02] transition">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-[#185787]"></div>
            <span className="text-sm font-medium text-[#425660]">{title}</span>
          </div>
          <span className="text-xs text-[#425660]">{badge}</span>
        </div>
        <div className="space-y-3">
          <div>
            <div className="text-2xl font-bold mb-1 text-[#081C28]">{formatCompactCurrency(value)}</div>
            <div className="text-sm text-[#425660]">vs {formatCompactCurrency(target)} target</div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-1 rounded-md text-xs font-medium ${
                value >= target ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              }`}
            >
              {target ? formatPercent(variance) : "N/A"}
            </span>
            <span className="text-xs text-[#425660]">vs target</span>
          </div>
          {title === "Current Quarter" && !isOnTrack && remaining > 0 && (
            <div className="pt-3 border-t border-[#A5AEB7]">
              <div className="text-xs font-medium text-[#425660] mb-1">Remaining to Target</div>
              <div className="text-lg font-bold text-orange-600">{formatCompactCurrency(remaining)}</div>
            </div>
          )}
          {title === "Current Quarter" && isOnTrack && (
            <div className="pt-3 border-t border-[#A5AEB7]">
              <div className="text-xs font-medium text-green-600 mb-1">Target Achieved!</div>
              <div className="text-sm font-semibold text-green-600">
                +{formatCompactCurrency(Math.abs(remaining))} over target
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  const AFSCard = ({ title, badge, value }: { title: string; badge: string; value: number }) => {
    return (
      <div className="rounded-2xl p-6 bg-white border border-[#00AC75] shadow hover:scale-[1.02] transition">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-[#00AC75]"></div>
            <span className="text-sm font-medium text-[#425660]">{title}</span>
          </div>
          <span className="text-xs text-[#425660]">{badge}</span>
        </div>
        <div className="space-y-3">
          <div>
            <div className="text-2xl font-bold mb-1 text-[#081C28]">{formatCompactCurrency(value)}</div>
            <div className="text-sm text-[#425660]">Net Purchases</div>
          </div>
        </div>
      </div>
    )
  }

  const USACard = ({ title, badge, value }: { title: string; badge: string; value: number }) => {
    return (
      <div className="rounded-2xl p-6 bg-white border border-[#D92D20] shadow hover:scale-[1.02] transition">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-[#D92D20]"></div>
            <span className="text-sm font-medium text-[#425660]">{title}</span>
          </div>
          <span className="text-xs text-[#425660]">{badge}</span>
        </div>
        <div className="space-y-3">
          <div>
            <div className="text-2xl font-bold mb-1 text-[#081C28]">{formatCompactCurrency(value)}</div>
            <div className="text-sm text-[#425660]">Net Purchases</div>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#E6EAF1]">
        <div className="flex flex-col items-center gap-6">
          <div className="animate-spin h-16 w-16 rounded-full border-4 border-[#E6EAF1] border-t-[#185787]" />
          <h3 className="text-xl font-semibold text-[#081C28]">Loading Dashboard</h3>
        </div>
      </div>
    )
  }

  /* ------------------------- RENDER ---------------------------- */
  return (
    <div className="min-h-screen bg-[#E6EAF1]">
      {/* Header */}
      <header className="border-b border-[#A5AEB7] bg-white">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-2 h-8 bg-[#185787] rounded-full" />
                <h1 className="text-3xl text-[#081C28] font-black">FORCE USA EXPORT SALES</h1>
              </div>
              <p className="text-[#425660] text-lg">{fiscalYearLabel} Performance Dashboard</p>
            </div>
            <div className="flex items-center">
              <img 
                src="https://www.forceusa.com/cdn/shop/t/19/assets/force-usa-logo.svg?v=15702838478117472841757084722" 
                alt="Force USA" 
                className="h-12 w-auto brightness-0" 
              />
            </div>
          </div>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Sales Performance Section */}
        <div className="pt-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-3 h-8 bg-[#185787] rounded-full" />
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-[#081C28]">Sales Performance</h2>
                <a href={fyExport === "FY27" ? "https://docs.google.com/spreadsheets/d/1fHUXMDuxFKG3pktlbwFfsmQ4JuEis5GA_Aa-WLQEAEU/edit?gid=1758000461#gid=1758000461" : "https://docs.google.com/spreadsheets/d/1fHUXMDuxFKG3pktlbwFfsmQ4JuEis5GA_Aa-WLQEAEU/edit?pli=1&gid=2093632728#gid=2093632728"} target="_blank" rel="noreferrer" title="Source Data">
                  <Info className="w-5 h-5 text-gray-400 hover:text-gray-600 transition-colors cursor-help" />
                </a>
              </div>
            </div>
            <div className="flex rounded-xl overflow-hidden border border-[#A5AEB7] shadow-sm">
              <button
                onClick={() => { setFyExport("FY26"); setCustomer("All"); setCountry("All"); }}
                className={`px-5 py-3 text-sm font-semibold transition-colors ${fyExport === "FY26" ? "bg-[#185787] text-white" : "bg-white text-[#425660] hover:bg-gray-50"}`}
              >FY26</button>
              <button
                onClick={() => { setFyExport("FY27"); setCustomer("All"); setCountry("All"); }}
                className={`px-5 py-3 text-sm font-semibold transition-colors ${fyExport === "FY27" ? "bg-[#185787] text-white" : "bg-white text-[#425660] hover:bg-gray-50"}`}
              >FY27</button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            {[
              {
                label: "Customer",
                value: selectedCustomer,
                onChange: setCustomer,
                options: ["All", ...uniqueCustomers],
              },
              { label: "Country", value: selectedCountry, onChange: setCountry, options: ["All", ...uniqueCountries] },
            ].map((f) => (
              <div key={f.label} className="min-w-48">
                <label className="block text-sm font-medium text-[#425660] mb-2">{f.label}</label>
                <select
                  value={f.value}
                  onChange={(e) => f.onChange(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-[#A5AEB7] rounded-xl shadow focus:ring-2 focus:ring-[#185787] focus:border-[#185787]"
                >
                  {f.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
            <Card
              title="Current Month"
              badge={currentMonth}
              value={summary.currentMonth.a}
              target={summary.currentMonth.b}
            />
            <Card title="Next Month" badge={nextMonth} value={summary.nextMonth.a} target={summary.nextMonth.b} />
            <Card
              title="Last Quarter"
              badge={lastQuarter}
              value={summary.lastQuarter.a}
              target={summary.lastQuarter.b}
            />
            <Card
              title="Current Quarter"
              badge={currentQuarter}
              value={summary.currentQuarter.a}
              target={summary.currentQuarter.b}
            />
            <Card title="Year to Date" badge={`JUL - ${currentMonth}`} value={summary.ytd.a} target={summary.ytd.b} />
          </div>
        </div>

        {/* Monthly Performance Chart */}
        <MonthlyPerformanceChart data={summary} fyLabel={fyExport} />

        {/* Revenue by Market Group */}
        <div className="bg-white border border-[#A5AEB7] rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-6 bg-[#185787] rounded-full" />
              <h3 className="text-xl font-bold text-[#081C28]">Revenue by Market Group</h3>
            </div>
            <span className="text-xs text-[#425660]">YTD, click rows to expand</span>
          </div>
          <RevenueByMarketTable data={revenueGroups} />
        </div>

        {/* AFS AUSTRALIA SECTION */}
        <div className="pt-12 border-t-4 border-[#00AC75] mt-12">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-3 h-8 bg-[#00AC75] rounded-full" />
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-[#081C28]">Sales Performance - AFS</h2>
                <a href="https://docs.google.com/spreadsheets/d/1W0qacynbijOaoksvt9QLAYS0M-aOV2ot0_wTvmDacqk/edit?gid=2041734228#gid=2041734228" target="_blank" rel="noreferrer" title="Source Data">
                  <Info className="w-5 h-5 text-gray-400 hover:text-gray-600 transition-colors cursor-help" />
                </a>
              </div>
            </div>
            <div className="flex rounded-xl overflow-hidden border border-[#00AC75] shadow-sm">
              <button
                onClick={() => setFyAfs("FY26")}
                className={`px-4 py-2 text-sm font-semibold transition-colors ${fyAfs === "FY26" ? "bg-[#00AC75] text-white" : "bg-white text-[#425660] hover:bg-gray-50"}`}
              >FY26</button>
              <button
                onClick={() => setFyAfs("FY27")}
                className={`px-4 py-2 text-sm font-semibold transition-colors ${fyAfs === "FY27" ? "bg-[#00AC75] text-white" : "bg-white text-[#425660] hover:bg-gray-50"}`}
              >FY27</button>
            </div>
          </div>

          {/* AFS KPI Cards - REMOVED NEXT MONTH */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <AFSCard title="Current Month" badge={currentMonth} value={afsSummary.currentMonth.a} />
            <AFSCard title="Current Quarter" badge={currentQuarter} value={afsSummary.currentQuarter.a} />
            <AFSCard title="Year to Date" badge={`JUL - ${currentMonth}`} value={afsSummary.ytd.a} />
          </div>

          {/* AFS Monthly Performance Chart */}
          <AFSMonthlyPerformanceChart data={afsSummary} fyLabel={fyAfs} />
        </div>

        {/* USA SECTION */}
        <div className="pt-12 border-t-4 border-[#D92D20] mt-12">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-3 h-8 bg-[#D92D20] rounded-full" />
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-[#081C28]">Sales Performance - USA</h2>
                <a href="https://docs.google.com/spreadsheets/d/1W0qacynbijOaoksvt9QLAYS0M-aOV2ot0_wTvmDacqk/edit?gid=2041734228#gid=2041734228" target="_blank" rel="noreferrer" title="Source Data">
                  <Info className="w-5 h-5 text-gray-400 hover:text-gray-600 transition-colors cursor-help" />
                </a>
              </div>
            </div>
            <div className="flex rounded-xl overflow-hidden border border-[#D92D20] shadow-sm">
              <button
                onClick={() => setFyUsa("FY26")}
                className={`px-4 py-2 text-sm font-semibold transition-colors ${fyUsa === "FY26" ? "bg-[#D92D20] text-white" : "bg-white text-[#425660] hover:bg-gray-50"}`}
              >FY26</button>
              <button
                onClick={() => setFyUsa("FY27")}
                className={`px-4 py-2 text-sm font-semibold transition-colors ${fyUsa === "FY27" ? "bg-[#D92D20] text-white" : "bg-white text-[#425660] hover:bg-gray-50"}`}
              >FY27</button>
            </div>
          </div>

          {/* USA KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <USACard title="Current Month" badge={currentMonth} value={usaSummary.currentMonth.a} />
            <USACard title="Current Quarter" badge={currentQuarter} value={usaSummary.currentQuarter.a} />
            <USACard title="Year to Date" badge={`JUL - ${currentMonth}`} value={usaSummary.ytd.a} />
          </div>

          {/* USA Monthly Performance Chart */}
          <USAMonthlyPerformanceChart data={usaSummary} fyLabel={fyUsa} />
        </div>
      </section>

    </div>
  )
}

export default SalesHealthDashboard
