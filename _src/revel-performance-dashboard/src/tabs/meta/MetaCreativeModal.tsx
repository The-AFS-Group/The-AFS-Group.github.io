// src/tabs/meta/MetaCreativeModal.tsx
import { useEffect, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { fmtCurrency, fmtInt, fmtPct, fmtRoas, fmtCpc } from "../../lib/format";
import { fetchVideoSource } from "../../lib/meta-live";
import type { MetaCreativeRow } from "../../lib/data";

export interface MetaCreativeModalProps {
  creative: MetaCreativeRow | null;
  onClose: () => void;
}

function ModalStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col min-w-0">
      <span
        className="text-[9px] uppercase tracking-wider truncate"
        style={{ color: "var(--gaf-text-muted)" }}
      >
        {label}
      </span>
      <span
        className="text-sm font-bold tabular-nums truncate"
        style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}
      >
        {value}
      </span>
    </div>
  );
}

function ModalThumbnail({ url, alt }: { url?: string; alt: string }) {
  if (!url) {
    return (
      <div
        className="w-full h-48 flex items-center justify-center text-sm rounded-lg"
        style={{ background: "var(--gaf-primary-light)", color: "var(--gaf-text-muted)" }}
      >
        No preview
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      className="w-full h-48 object-contain rounded-lg"
      style={{ background: "var(--gaf-primary-light)" }}
    />
  );
}

type VideoState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; src: string }
  | { status: "unavailable" };

export function MetaCreativeModal({ creative, onClose }: MetaCreativeModalProps) {
  const [videoState, setVideoState] = useState<VideoState>({ status: "idle" });

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!creative) return;
    document.addEventListener("keydown", handleKeyDown);
    // Body scroll lock while the modal is open (reference parity)
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [creative, handleKeyDown]);

  // Lazily fetch a playable source for video ads via the Worker proxy.
  useEffect(() => {
    const vid = creative?.videoId ? String(creative.videoId) : "";
    if (!vid) {
      setVideoState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setVideoState({ status: "loading" });
    fetchVideoSource(vid)
      .then(src => {
        if (!cancelled) setVideoState(src ? { status: "ready", src } : { status: "unavailable" });
      })
      .catch(() => {
        if (!cancelled) setVideoState({ status: "unavailable" });
      });
    return () => { cancelled = true; };
  }, [creative?.videoId]);

  if (!creative) return null;

  const name = String(creative.adName ?? creative.title ?? "Untitled ad");
  const isVideo = Boolean(creative.videoId);
  const adsManagerUrl = creative.adId
    ? `https://www.facebook.com/adsmanager/manage/ads?act=10153080558849684&selected_ad_ids=${creative.adId}`
    : null;

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Ad details: ${name}`}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-5 sm:p-6"
        style={{ background: "var(--gaf-card-bg)", border: "1px solid var(--gaf-card-border)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-lg font-bold transition-colors"
          style={{ color: "var(--gaf-text-muted)", background: "var(--gaf-row-border)" }}
          aria-label="Close modal"
        >
          ×
        </button>

        <div className="flex flex-col gap-4">
          {/* Media: inline video when a source is available, else thumbnail */}
          {isVideo && videoState.status === "ready" ? (
            <video
              src={videoState.src}
              controls
              autoPlay
              muted
              playsInline
              className="w-full rounded-lg"
              style={{ maxHeight: "50vh", background: "#000" }}
            />
          ) : (
            <ModalThumbnail url={creative.thumbnailUrl || creative.imageUrl} alt={name} />
          )}

          {isVideo && videoState.status === "loading" && (
            <p className="text-xs text-center" style={{ color: "var(--gaf-text-muted)" }}>
              Loading video…
            </p>
          )}
          {isVideo && videoState.status === "unavailable" && (
            <p className="text-xs text-center" style={{ color: "var(--gaf-text-muted)" }}>
              Video source unavailable for this ad
            </p>
          )}

          {/* Name + copy */}
          <div>
            <h3
              className="text-base font-bold leading-snug mb-1"
              style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}
            >
              {name}
            </h3>
            {(creative.campaign || creative.adset) && (
              <p className="text-xs mb-1" style={{ color: "var(--gaf-text-muted)" }}>
                {[creative.campaign, creative.adset].filter(Boolean).join(" › ")}
              </p>
            )}
            {creative.title && creative.title !== name && (
              <p className="text-sm font-medium mb-1" style={{ color: "var(--gaf-text-secondary)" }}>
                {String(creative.title)}
              </p>
            )}
            {creative.body && (
              <div className="mt-2">
                <p className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: "var(--gaf-text-muted)" }}>
                  Ad Copy
                </p>
                <p className="text-xs leading-relaxed whitespace-pre-line" style={{ color: "var(--gaf-text-secondary)" }}>
                  {String(creative.body)}
                </p>
              </div>
            )}
          </div>

          {/* Primary stats 2x4 */}
          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: "var(--gaf-text-muted)" }}>
              Performance
            </p>
            <div className="grid grid-cols-4 gap-3">
              <ModalStat label="Spend" value={fmtCurrency(Number(creative.spend ?? 0))} />
              <ModalStat label="ROAS" value={fmtRoas(Number(creative.roas ?? 0))} />
              <ModalStat label="Revenue" value={fmtCurrency(Number(creative.purchaseValue ?? 0))} />
              <ModalStat label="Conv." value={fmtInt(Number(creative.purchases ?? 0))} />
              <ModalStat label="CPA" value={fmtCpc(Number(creative.cpa ?? 0))} />
              <ModalStat label="ATC" value={fmtInt(Number(creative.addToCart ?? 0))} />
              <ModalStat label="ATC Rate" value={fmtPct(Number(creative.atcRate ?? 0))} />
              <ModalStat label="Cost/ATC" value={fmtCpc(Number((creative as Record<string, unknown>).costPerAtc ?? 0))} />
            </div>
          </div>

          {/* Secondary stats 3x4 */}
          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: "var(--gaf-text-muted)" }}>
              Delivery
            </p>
            <div className="grid grid-cols-4 gap-3">
              <ModalStat label="Impressions" value={fmtInt(Number(creative.impressions ?? 0))} />
              <ModalStat label="Reach" value={fmtInt(Number(creative.reach ?? 0))} />
              <ModalStat label="Clicks" value={fmtInt(Number(creative.clicks ?? 0))} />
              <ModalStat label="CTR" value={fmtPct(Number(creative.ctr ?? 0))} />
              <ModalStat label="CPC" value={fmtCpc(Number(creative.cpc ?? 0))} />
              <ModalStat label="CPM" value={fmtCurrency(Number(creative.cpm ?? 0))} />
              <ModalStat label="Frequency" value={(Number(creative.frequency ?? 0)).toFixed(1)} />
              <ModalStat label="Outbound" value={fmtInt(Number(creative.outboundClicks ?? 0))} />
              <ModalStat label="LPV" value={fmtInt(Number(creative.landingPageViews ?? 0))} />
              <ModalStat label="Engagements" value={fmtInt(Number(creative.engagements ?? 0))} />
              <ModalStat label="Eng Rate" value={fmtPct(Number(creative.engagementRate ?? 0))} />
              <ModalStat label="Purchases" value={fmtInt(Number(creative.purchases ?? 0))} />
            </div>
          </div>

          {/* Action links — Preview Ad (filled) + Ads Manager (outline), reference parity */}
          <div className="flex items-center gap-2 flex-wrap">
            {creative.previewLink && (
              <a
                href={String(creative.previewLink)}
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
