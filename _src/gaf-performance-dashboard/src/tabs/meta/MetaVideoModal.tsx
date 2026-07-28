// src/tabs/meta/MetaVideoModal.tsx
// Video detail modal: inline playback via the Worker proxy, headline stats,
// retention bars, Preview Ad + Ads Manager links (reference parity).
import { useEffect, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { fmtCurrency, fmtInt } from "../../lib/format";
import { fetchVideoSource } from "../../lib/meta-live";
import type { MetaVideoRow } from "../../lib/data";

const GAF_ACCOUNT_ID = "10153080558849684";

export interface VideoModalTarget extends MetaVideoRow {
  /** joined from creative[] by adId */
  videoId?: string;
  thumbnailUrl?: string;
  previewLink?: string;
}

interface Props {
  video: VideoModalTarget | null;
  onClose: () => void;
}

function retentionColor(pct: number): string {
  if (pct >= 50) return "var(--gaf-delta-pos)";
  if (pct >= 25) return "#d97706";
  return "var(--gaf-delta-neg)";
}

function RateBar({ label, pct }: { label: string; pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const color = retentionColor(pct);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] w-20 shrink-0" style={{ color: "var(--gaf-text-muted)" }}>{label}</span>
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--gaf-row-border)" }}>
        <div className="h-full rounded-full" style={{ width: `${clamped}%`, background: color }} />
      </div>
      <span className="text-[11px] w-11 text-right tabular-nums font-semibold" style={{ color }}>{pct.toFixed(1)}%</span>
    </div>
  );
}

type VideoState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; src: string }
  | { status: "unavailable" };

export function MetaVideoModal({ video, onClose }: Props) {
  const [videoState, setVideoState] = useState<VideoState>({ status: "idle" });

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); },
    [onClose]
  );

  useEffect(() => {
    if (!video) return;
    document.addEventListener("keydown", handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [video, handleKeyDown]);

  useEffect(() => {
    const vid = video?.videoId ? String(video.videoId) : "";
    if (!vid) { setVideoState({ status: "idle" }); return; }
    let cancelled = false;
    setVideoState({ status: "loading" });
    fetchVideoSource(vid)
      .then(src => { if (!cancelled) setVideoState(src ? { status: "ready", src } : { status: "unavailable" }); })
      .catch(() => { if (!cancelled) setVideoState({ status: "unavailable" }); });
    return () => { cancelled = true; };
  }, [video?.videoId]);

  if (!video) return null;

  const adsManagerUrl = video.adId
    ? `https://www.facebook.com/adsmanager/manage/ads?act=${GAF_ACCOUNT_ID}&selected_ad_ids=${video.adId}`
    : null;

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Video details: ${video.adName ?? ""}`}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-5 sm:p-6"
        style={{ background: "var(--gaf-card-bg)", border: "1px solid var(--gaf-card-border)" }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-lg font-bold z-10"
          style={{ color: "var(--gaf-text-muted)", background: "var(--gaf-row-border)" }}
          aria-label="Close modal"
        >
          ×
        </button>

        <div className="flex flex-col gap-4">
          {/* Media */}
          {videoState.status === "ready" ? (
            <video
              src={videoState.src}
              controls
              autoPlay
              muted
              playsInline
              className="w-full rounded-lg"
              style={{ maxHeight: "50vh", background: "#000" }}
            />
          ) : video.thumbnailUrl ? (
            <img
              src={String(video.thumbnailUrl)}
              alt=""
              className="w-full rounded-lg object-contain"
              style={{ maxHeight: "45vh", background: "#0a0a0a" }}
            />
          ) : (
            <div className="w-full h-40 rounded-lg flex items-center justify-center text-sm" style={{ background: "var(--gaf-primary-light)", color: "var(--gaf-text-muted)" }}>
              No preview
            </div>
          )}
          {videoState.status === "loading" && (
            <p className="text-xs text-center" style={{ color: "var(--gaf-text-muted)" }}>Loading video…</p>
          )}
          {videoState.status === "unavailable" && (
            <p className="text-xs text-center" style={{ color: "var(--gaf-text-muted)" }}>Video source unavailable for this ad</p>
          )}

          {/* Name + campaign */}
          <div>
            <h3 className="text-base font-bold leading-snug" style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}>
              {String(video.adName ?? "Untitled ad")}
            </h3>
            {Boolean(video.campaign) && (
              <p className="text-xs mt-0.5" style={{ color: "var(--gaf-text-muted)" }}>{String(video.campaign)}</p>
            )}
          </div>

          {/* Headline stats */}
          <div className="grid grid-cols-4 gap-3 text-center">
            {[
              { label: "Spend", value: fmtCurrency(Number(video.spend ?? 0)) },
              { label: "Plays", value: fmtInt(Number(video.videoPlays ?? 0)) },
              { label: "ThruPlays", value: fmtInt(Number(video.thruPlays ?? 0)) },
              { label: "Avg Watch", value: `${Number(video.avgWatchTime ?? 0).toFixed(1)}s` },
            ].map(s => (
              <div key={s.label} className="rounded-lg px-2 py-2" style={{ background: "var(--gaf-primary-light)" }}>
                <p className="text-[9px] uppercase tracking-wider" style={{ color: "var(--gaf-text-muted)" }}>{s.label}</p>
                <p className="text-sm font-bold tabular-nums" style={{ color: "var(--gaf-primary)", fontFamily: "var(--font-display)" }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Retention bars */}
          <div className="flex flex-col gap-1.5">
            <RateBar label="Thumb Stop" pct={Number(video.thumbStopRate ?? 0)} />
            <RateBar label="25% Played" pct={Number(video.p25Rate ?? 0)} />
            <RateBar label="50% Played" pct={Number(video.p50Rate ?? 0)} />
            <RateBar label="75% Played" pct={Number(video.p75Rate ?? 0)} />
            <RateBar label="Completion" pct={Number(video.p100Rate ?? 0)} />
          </div>

          {/* Action links */}
          <div className="flex items-center gap-2 flex-wrap">
            {video.previewLink && (
              <a
                href={String(video.previewLink)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-white inline-flex items-center gap-1.5"
                style={{ background: "var(--gaf-primary)" }}
              >
                <span aria-hidden="true">&#9678;</span> Preview Ad
              </a>
            )}
            {adsManagerUrl && (
              <a
                href={adsManagerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5"
                style={{ color: "var(--gaf-text-secondary)", border: "1px solid var(--gaf-input-border)" }}
              >
                <span aria-hidden="true">&#8599;</span> Ads Manager
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
