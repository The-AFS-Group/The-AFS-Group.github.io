// src/tabs/meta/MetaOrganic.tsx
// Organic social: IG/FB brand glyphs, engagement-rate + posts KPIs, daily
// reach chart and an engagement breakdown card (11 Jul review parity items).
import { useState } from "react";
import { KpiCard } from "../../components/KpiCard";
import { TrendChart } from "../../components/TrendChart";
import { fmtCompact, fmtInt, fmtPct } from "../../lib/format";
import type { OrganicData, OrganicPost } from "../../lib/data";

interface Props {
  organic?: OrganicData;
}

// Instagram glyph — rounded square + lens + dot, IG magenta.
function InstagramGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="6" stroke="#E1306C" strokeWidth="2.2" />
      <circle cx="12" cy="12" r="4.6" stroke="#E1306C" strokeWidth="2.2" />
      <circle cx="17.4" cy="6.6" r="1.5" fill="#E1306C" />
    </svg>
  );
}

// Facebook glyph — blue circle + white f.
function FacebookGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#1877F2" />
      <path
        d="M15.6 12.6h-2.4V20h-3v-7.4H8.4V10h1.8V8.4c0-2 1.2-3.4 3.4-3.4.9 0 1.7.1 1.9.1v2.3h-1.3c-1 0-1.2.5-1.2 1.2V10h2.7l-.4 2.6Z"
        fill="#ffffff"
      />
    </svg>
  );
}

function PostThumb({ url, alt }: { url?: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return (
      <div
        className="w-full flex items-center justify-center text-xs"
        style={{ aspectRatio: "4 / 5", background: "var(--gaf-primary-light)", color: "var(--gaf-text-muted)" }}
      >
        No preview
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="w-full object-cover"
      style={{ aspectRatio: "4 / 5" }}
    />
  );
}

function fmtPostDate(iso?: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

function SectionHeader({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h4 className="flex items-center gap-2 text-sm font-bold mb-3" style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}>
      {icon}
      {children}
    </h4>
  );
}

export function MetaOrganic({ organic }: Props) {
  const ig = organic?.ig;
  const fb = organic?.fbPage;

  if (!organic || (!ig && !fb)) {
    return (
      <div className="fade-in dash-card p-8 text-center text-sm" style={{ color: "var(--gaf-text-muted)" }}>
        No organic social data available.
      </div>
    );
  }

  const posts = (ig?.posts ?? []) as OrganicPost[];
  const reachDaily = (ig?.reachDaily ?? []) as Array<{ date: string; reach: number }>;
  const breakdown = ig?.engagementBreakdown;
  const breakdownTotal =
    (breakdown?.likes ?? 0) + (breakdown?.comments ?? 0) + (breakdown?.saves ?? 0) + (breakdown?.shares ?? 0);
  const engagementRate =
    (ig?.reach ?? 0) > 0 ? ((ig?.accountsEngaged ?? 0) / (ig?.reach ?? 1)) * 100 : 0;

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h3
          className="text-lg font-bold"
          style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}
        >
          Organic Social
        </h3>
        <span className="text-xs" style={{ color: "var(--gaf-text-muted)" }}>
          30-day snapshot
        </span>
      </div>

      {/* Instagram KPI cards */}
      {ig && (
        <section aria-label="Instagram organic metrics">
          <SectionHeader icon={<InstagramGlyph />}>Instagram</SectionHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 sm:gap-3 stagger">
            <KpiCard label="Reach" value={fmtInt(ig.reach ?? 0)} tooltip="Unique accounts reached in the last 30 days." />
            <KpiCard label="Views" value={fmtInt(ig.views ?? 0)} tooltip="Total content views." />
            <KpiCard label="Accounts Engaged" value={fmtInt(ig.accountsEngaged ?? 0)} tooltip="Unique accounts that interacted." />
            <KpiCard label="Eng. Rate" value={fmtPct(engagementRate)} tooltip="Accounts engaged ÷ reach." />
            <KpiCard label="Interactions" value={fmtInt(ig.totalInteractions ?? 0)} tooltip="Likes, comments, saves and shares." />
            <KpiCard label="Posts Published" value={fmtInt(ig.postsPublished ?? 0)} tooltip="Posts published in the last 30 days." />
            <KpiCard label="Followers" value={fmtInt(ig.followerCount ?? 0)} tooltip="Current follower count." />
          </div>
        </section>
      )}

      {/* Daily reach chart */}
      {reachDaily.length > 1 && (
        <section className="dash-card p-5" aria-label="Daily Instagram reach">
          <SectionHeader icon={<InstagramGlyph />}>Daily Reach</SectionHeader>
          <TrendChart
            data={reachDaily as Array<{ date: string; [k: string]: number | string }>}
            series={{ areas: [{ key: "reach", color: "var(--gaf-primary)", label: "Reach", format: fmtCompact }] }}
          />
        </section>
      )}

      {/* Engagement breakdown */}
      {breakdown && breakdownTotal > 0 && (
        <section className="dash-card p-5" aria-label="Engagement breakdown">
          <SectionHeader icon={<InstagramGlyph />}>Engagement Breakdown</SectionHeader>
          <p className="text-[11px] -mt-2 mb-3" style={{ color: "var(--gaf-text-muted)" }}>
            From the top posts in the period
          </p>
          <div className="space-y-3">
            {([
              ["Likes", breakdown.likes ?? 0],
              ["Comments", breakdown.comments ?? 0],
              ["Saves", breakdown.saves ?? 0],
              ["Shares", breakdown.shares ?? 0],
            ] as Array<[string, number]>).map(([label, val]) => (
              <div key={label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium" style={{ color: "var(--gaf-text-primary)" }}>{label}</span>
                  <span className="tabular-nums" style={{ color: "var(--gaf-text-secondary)" }}>
                    {fmtInt(val)}{" "}
                    <span style={{ color: "var(--gaf-text-muted)" }}>({((val / breakdownTotal) * 100).toFixed(0)}%)</span>
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--gaf-row-border)" }}>
                  <div className="h-full rounded-full" style={{ width: `${(val / breakdownTotal) * 100}%`, background: "var(--gaf-primary)" }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Top posts grid */}
      {posts.length > 0 && (
        <section aria-label="Top Instagram posts">
          <SectionHeader icon={<InstagramGlyph />}>Recent Posts</SectionHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {posts.map((p, i) => {
              const isVideo = p.mediaType === "VIDEO";
              const isCarousel = p.mediaType === "CAROUSEL_ALBUM";
              const typeBadge = isVideo ? "Video" : isCarousel ? "Album" : null;
              const card = (
                <div className="dash-card overflow-hidden flex flex-col h-full">
                  <div className="relative">
                    <PostThumb url={p.thumbnail} alt={p.caption ?? "Instagram post"} />
                    {typeBadge && (
                      <span
                        className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-semibold text-white"
                        style={{ background: "rgba(0,0,0,0.55)" }}
                      >
                        {typeBadge}
                      </span>
                    )}
                  </div>
                  <div className="p-3 flex flex-col gap-2 flex-1 min-w-0">
                    <p className="text-[11px] leading-snug line-clamp-3" style={{ color: "var(--gaf-text-secondary)" }}>
                      {p.caption ?? ""}
                    </p>
                    <div className="mt-auto flex items-center gap-2.5 text-[11px] tabular-nums flex-wrap" style={{ color: "var(--gaf-text-muted)" }}>
                      <span>&#10084; {fmtInt(p.likes ?? 0)}</span>
                      <span>&#128172; {fmtInt(p.comments ?? 0)}</span>
                      {p.saves != null && <span>&#128278; {fmtInt(p.saves)}</span>}
                      {p.shares != null && <span>&#10150; {fmtInt(p.shares)}</span>}
                      {p.timestamp && <span className="ml-auto">{fmtPostDate(p.timestamp)}</span>}
                    </div>
                  </div>
                </div>
              );
              return p.permalink ? (
                <a key={p.id ?? i} href={p.permalink} target="_blank" rel="noopener noreferrer" className="block h-full">
                  {card}
                </a>
              ) : (
                <div key={p.id ?? i} className="h-full">{card}</div>
              );
            })}
          </div>
        </section>
      )}

      {/* Facebook Page stats */}
      {fb && (
        <section aria-label="Facebook Page metrics">
          <SectionHeader icon={<FacebookGlyph />}>Facebook Page</SectionHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            <KpiCard label="Page Followers" value={fmtInt(fb.fanCount ?? 0)} tooltip="Total page fans / followers." />
            <KpiCard label="Talking About" value={fmtInt(fb.talkingAbout ?? 0)} subLabel="7-day" tooltip="People engaged with the page in the last 7 days." />
          </div>
          <p className="text-[11px] mt-3" style={{ color: "var(--gaf-text-muted)" }}>
            Facebook Page Insights are largely deprecated in the Graph API. Follower and talking-about counts are read directly from the Page node.
          </p>
        </section>
      )}
    </div>
  );
}
