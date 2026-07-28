import { useState } from "react";
import { useData } from "./lib/data";
import type { PerfData, Window } from "./lib/data";
import { DateRangeProvider, useDateRange } from "./state/DateRangeContext";
import { Sidebar, NAV_ITEMS } from "./components/Sidebar";
import type { TabId } from "./components/Sidebar";
import { AiChat } from "./components/AiChat";
import { Overview } from "./tabs/Overview";
import { MetaAds } from "./tabs/MetaAds";
import { GoogleAds } from "./tabs/GoogleAds";
import { WebsiteTraffic } from "./tabs/WebsiteTraffic";
import { Email } from "./tabs/Email";
import { SeoAeo } from "./tabs/SeoAeo";
import { Pinterest } from "./tabs/Pinterest";
import { MarketingExpenses } from "./tabs/MarketingExpenses";

// Same white-background GAF logo the reference dashboards use.
const GAF_LOGO_URL =
  "https://cdn.shopify.com/s/files/1/0802/6279/1481/files/REVEL_Logo-Black-01.png?v=1691024664";

function makePanels(data: PerfData): Record<TabId, () => JSX.Element> {
  return {
    overview:    () => <Overview data={data} />,
    meta:        () => <MetaAds data={data} />,
    google:      () => <GoogleAds data={data} />,
    pinterest:   () => <Pinterest data={data} />,
    website:     () => <WebsiteTraffic data={data} />,
    seo:         () => <SeoAeo data={data} />,
    email:       () => <Email data={data} />,
    expenses:    () => <MarketingExpenses data={data} />,
  };
}

const WINDOW_LABELS: Record<Window, string> = {
  yesterday: "Yesterday",
  "7d":      "Last 7 days",
  "30d":     "Last 30 days",
  "90d":     "Last 90 days",
  mtd:       "Month to date",
  lastMonth: "Last month",
};

/** Latest date the snapshot covers — the last day in the 90d blended series. */
function dataThrough(data: PerfData): string | null {
  const daily = data.overview?.["90d"]?.daily;
  if (!daily || daily.length === 0) return null;
  return daily[daily.length - 1]?.date ?? null;
}

// Horizontal pill nav shown on small screens instead of the sidebar.
function MobileNav({ active, onSelect }: { active: TabId; onSelect: (t: TabId) => void }) {
  return (
    <nav
      className="md:hidden sticky top-14 z-30 flex gap-1 px-3 py-2 overflow-x-auto scrollbar-thin border-b"
      style={{ background: "var(--gaf-card-bg)", borderColor: "var(--gaf-row-border)" }}
      aria-label="Dashboard sections"
    >
      {NAV_ITEMS.map(({ id, label, Icon }) => {
        const isActive = id === active;
        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors"
            style={{
              background: isActive ? "var(--gaf-primary)" : "transparent",
              color: isActive ? "#ffffff" : "var(--gaf-text-secondary)",
            }}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon />
            {label}
          </button>
        );
      })}
    </nav>
  );
}

// ---- Inner shell (needs access to useDateRange context) ----

function DashboardShell({ data, onReload }: { data: PerfData; onReload: () => void }) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const { window: selectedWindow, setWindow } = useDateRange();

  const TAB_PANELS = makePanels(data);
  const Panel = TAB_PANELS[activeTab];
  const through = dataThrough(data);

  return (
    <div className="flex min-h-screen" style={{ background: "var(--gaf-page-bg)", color: "var(--gaf-text-primary)" }}>
      <Sidebar active={activeTab} onSelect={setActiveTab} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header bar -- white/blur, sticky */}
        <header
          className="sticky top-0 z-40 border-b px-3 sm:px-6 py-3 flex items-center gap-3 sm:gap-4 h-14 sm:h-16"
          style={{
            background: "var(--gaf-header-bg)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            boxShadow: "var(--gaf-header-shadow)",
            borderColor: "var(--gaf-row-border)",
          }}
        >
          {/* Brand mark */}
          <div className="flex items-center gap-3 mr-auto min-w-0">
            <img
              src={GAF_LOGO_URL}
              alt="Revel Saunas"
              className="h-7 sm:h-9 w-auto shrink-0"
            />
            <h1
              className="text-sm font-bold tracking-tight hidden lg:block whitespace-nowrap"
              style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}
            >
              Performance Dashboard
            </h1>
          </div>

          {/* Window picker */}
          <label className="flex items-center gap-2 text-xs shrink-0" style={{ color: "var(--gaf-text-secondary)" }}>
            <span className="hidden sm:inline">Window</span>
            <select
              value={selectedWindow}
              onChange={(e) => setWindow(e.target.value as Window)}
              className="text-xs rounded-md px-2 py-1.5 focus:outline-none"
              style={{
                background: "var(--gaf-card-bg)",
                border: "1px solid var(--gaf-input-border)",
                color: "var(--gaf-text-primary)",
              }}
            >
              {(["yesterday", "7d", "30d", "90d", "mtd", "lastMonth"] as Window[]).map((w) => (
                <option key={w} value={w}>
                  {WINDOW_LABELS[w]}
                </option>
              ))}
            </select>
          </label>

          {/* Freshness stamp + refresh */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs hidden xl:block" style={{ color: "var(--gaf-text-muted)" }}>
              Updated {new Date(data.generated_at).toLocaleString("en-AU", { dateStyle: "short", timeStyle: "short" })}
              {through ? ` · data through ${through}` : ""}
            </span>
            <button
              onClick={onReload}
              className="w-7 h-7 flex items-center justify-center rounded-md text-sm transition-colors"
              style={{ color: "var(--gaf-primary)", border: "1px solid var(--gaf-input-border)", background: "var(--gaf-card-bg)" }}
              title="Reload the snapshot. Data refreshes nightly at ~3:10am ACST, so this only changes numbers after a new snapshot lands — for live Meta numbers use 'Refresh live' on the Meta tab."
              aria-label="Reload snapshot data"
            >
              &#8635;
            </button>
          </div>
        </header>

        {/* Mobile section nav */}
        <MobileNav active={activeTab} onSelect={setActiveTab} />

        {/* Active tab panel */}
        <main className="flex-1 px-3 sm:px-6 py-4 sm:py-6 max-w-[1600px] w-full mx-auto">
          <div className="fade-in">
            <Panel />
          </div>
        </main>

        {/* Footer */}
        <footer
          className="px-6 py-3 text-[11px] flex items-center justify-between border-t"
          style={{ color: "var(--gaf-text-muted)", borderColor: "var(--gaf-row-border)" }}
        >
          <span>AFS Group · Revel Performance Dashboard</span>
          <span>Snapshot refreshed daily at 3:10am ACST · Meta tab supports live refresh</span>
        </footer>
      </div>

      {/* AI data assistant */}
      <AiChat data={data} />
    </div>
  );
}

// ---- Root App with data fetch + loading/error states ----

function AppInner() {
  const { data, loading, error, reload } = useData();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--gaf-page-bg)" }}>
        <div className="text-center space-y-4">
          <div
            className="inline-block w-12 h-12 border-4 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: "var(--gaf-primary)", borderTopColor: "transparent" }}
          />
          <p className="text-sm" style={{ color: "var(--gaf-text-muted)" }}>Loading performance data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--gaf-page-bg)" }}>
        <div className="text-center space-y-3">
          <p className="font-semibold" style={{ color: "#ef4444" }}>Failed to load data</p>
          <p className="text-sm" style={{ color: "var(--gaf-text-muted)" }}>
            {error instanceof Error ? error.message : String(error)}
          </p>
          <button
            onClick={reload}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
            style={{ background: "var(--gaf-primary)" }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return <DashboardShell data={data!} onReload={reload} />;
}

export default function App() {
  return (
    <DateRangeProvider>
      <AppInner />
    </DateRangeProvider>
  );
}
