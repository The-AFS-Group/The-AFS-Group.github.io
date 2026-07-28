// src/components/AiChat.tsx
// "Ask AI" — agentic chat over the ENTIRE dashboard feed. The model starts
// from a compact all-window KPI summary and calls a get_dashboard_data tool
// for anything deeper; the tool executes HERE against the in-memory feed, so
// every data point on the dashboard is reachable without shipping megabytes.
// The Gemini key lives in the gaf-dash-ai Cloudflare Worker (server-side).
import { useMemo, useRef, useState, useEffect } from "react";
import garyAvatar from "../assets/gary.png";
import { useDateRange } from "../state/DateRangeContext";
import type { PerfData, Window } from "../lib/data";

const WORKER_URL = "https://revel-dash-ai.josh-03c.workers.dev";
const WINDOWS: Window[] = ["yesterday", "7d", "30d", "90d", "lastMonth", "mtd"];
const MAX_TOOL_ROUNDS = 6;

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

// Gemini content turn (loose typing — parts carry text/functionCall/functionResponse)
type GeminiTurn = { role: "user" | "model"; parts: Array<Record<string, unknown>> };

const STARTERS = [
  "Give me three genuine cross-platform insights from this data.",
  "Which products sell well on Shopify but get little paid or SEO support?",
  "Compare Meta vs Google efficiency across every window.",
  "Are we on track against the GP budget, and what's driving it?",
];

// Heavy string fields stripped from tool results to keep tokens for numbers.
const STRIP_FIELDS = new Set(["thumbnailUrl", "imageUrl", "previewLink", "body", "permalink", "thumbnail", "url"]);

function sanitize(value: unknown, limit: number, depth = 0): unknown {
  if (Array.isArray(value)) {
    return value.slice(0, limit).map(v => sanitize(v, limit, depth + 1));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (STRIP_FIELDS.has(k)) continue;
      out[k] = sanitize(v, limit, depth + 1);
    }
    return out;
  }
  return value;
}

/** Execute a get_dashboard_data call against the in-memory feed. */
function getDashboardData(
  data: PerfData,
  args: Record<string, unknown>,
  currentWindow: Window
): unknown {
  const section = String(args.section ?? "");
  const window = WINDOWS.includes(args.window as Window) ? (args.window as Window) : currentWindow;
  const keys = Array.isArray(args.keys) ? (args.keys as string[]) : null;
  const limit = Math.min(Math.max(Number(args.limit ?? 40) || 40, 5), 120);

  const snapshotSections: Record<string, unknown> = {
    experiments: data.experiments,
    organic: data.organic,
  };
  let node: unknown;
  if (section in snapshotSections) {
    node = snapshotSections[section];
  } else {
    const root = (data as unknown as Record<string, unknown>)[section];
    if (root == null) return { error: `Unknown section '${section}'` };
    node = (root as Record<string, unknown>)[window] ?? root;
  }
  if (node == null) return { error: `No data for ${section} / ${window}` };

  let result: unknown = node;
  if (keys && keys.length && typeof node === "object" && !Array.isArray(node)) {
    const picked: Record<string, unknown> = {};
    for (const k of keys) {
      const v = (node as Record<string, unknown>)[k];
      if (v !== undefined) picked[k] = v;
    }
    result = Object.keys(picked).length ? picked : { error: `Keys ${keys.join(",")} not found in ${section}` };
  }

  let clean = sanitize(result, limit);
  // Hard cap the serialized size; drop to a smaller row limit if needed.
  let json = JSON.stringify(clean);
  if (json.length > 90_000) {
    clean = sanitize(result, 15);
    json = JSON.stringify(clean);
    if (json.length > 90_000) {
      return { error: "Result too large — request specific keys or a smaller limit", truncatedPreview: json.slice(0, 2000) };
    }
  }
  return { section, window: section in snapshotSections ? "snapshot" : window, data: clean };
}

/** Compact all-window KPI summary so simple questions need zero tool calls. */
function buildSummary(data: PerfData): string {
  const perWindow: Record<string, unknown> = {};
  for (const w of WINDOWS) {
    perWindow[w] = {
      overview: { kpis: data.overview?.[w]?.kpis, deltas: data.overview?.[w]?.deltas },
      meta: { kpis: data.meta?.[w]?.kpis, deltas: data.meta?.[w]?.deltas },
      google: { kpis: data.google?.[w]?.kpis, deltas: data.google?.[w]?.deltas },
      ga4: { kpis: data.ga4?.[w]?.kpis, deltas: data.ga4?.[w]?.deltas, aiTraffic: data.ga4?.[w]?.aiTraffic?.kpis },
      axon: { kpis: data.axon?.[w]?.kpis },
      email: { kpis: data.hubspot?.[w]?.kpis },
      shopify: { kpis: data.shopify?.[w]?.kpis, deltas: data.shopify?.[w]?.deltas },
      seo: { kpis: data.seo?.[w]?.kpis, deltas: data.seo?.[w]?.deltas },
      pinterest: data.pinterest?.[w]?.connected ? { kpis: data.pinterest?.[w]?.kpis } : "not connected",
      anomalies: (data.anomalies?.[w] ?? []).map(a => a.label),
    };
  }
  return JSON.stringify({
    generatedAt: data.generated_at,
    gpMonth: data.overview?.["30d"]?.gpMonth,
    windows: perWindow,
    experimentsSummary: data.experiments?.summary,
    organicIgTotals30d: data.organic?.ig
      ? {
          reach: data.organic.ig.reach,
          views: data.organic.ig.views,
          accountsEngaged: data.organic.ig.accountsEngaged,
          followerCount: data.organic.ig.followerCount,
          postsPublished: data.organic.ig.postsPublished,
        }
      : undefined,
  });
}

function fcLabel(args: Record<string, unknown>): string {
  const bits = [String(args.section ?? "")];
  if (args.window) bits.push(String(args.window));
  if (Array.isArray(args.keys) && args.keys.length) bits.push((args.keys as string[]).join("+"));
  return bits.join(" · ");
}

/** Minimal markdown for chat bubbles: escapes HTML, then renders **bold**,
`code`, and bullet/numbered lists. No external deps, injection-safe. */
function mdToHtml(text: string): string {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (t: string) =>
    t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
     .replace(/`([^`]+)`/g, '<code style="background:#e5e7eb;border-radius:4px;padding:0 3px;">$1</code>');

  const lines = esc.split("\n");
  const out: string[] = [];
  let list: { tag: "ul" | "ol"; items: string[] } | null = null;

  const flush = () => {
    if (list) {
      const style = list.tag === "ul" ? "disc" : "decimal";
      out.push(
        `<${list.tag} style="margin:4px 0 4px 18px;list-style:${style};display:flex;flex-direction:column;gap:2px;">`
        + list.items.map(i => `<li>${i}</li>`).join("")
        + `</${list.tag}>`
      );
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[*-]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet) {
      if (!list || list.tag !== "ul") { flush(); list = { tag: "ul", items: [] }; }
      list.items.push(inline(bullet[1]));
    } else if (numbered) {
      if (!list || list.tag !== "ol") { flush(); list = { tag: "ol", items: [] }; }
      list.items.push(inline(numbered[1]));
    } else {
      flush();
      out.push(line.trim() === "" ? '<div style="height:6px;"></div>' : `<div>${inline(line)}</div>`);
    }
  }
  flush();
  return out.join("");
}

function Sparkle() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l1.9 5.7L19.6 9.6l-5.7 1.9L12 17.2l-1.9-5.7L4.4 9.6l5.7-1.9L12 2Zm7 12l.9 2.7 2.7.9-2.7.9-.9 2.7-.9-2.7-2.7-.9 2.7-.9.9-2.7Z" />
    </svg>
  );
}

export function AiChat({ data }: { data: PerfData }) {
  const { window: selectedWindow } = useDateRange();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const turnsRef = useRef<GeminiTurn[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const summary = useMemo(() => buildSummary(data), [data]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, progress]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setError(null);
    setMessages(prev => [...prev, { role: "user", text: question }]);
    setInput("");
    setBusy(true);
    setProgress(null);

    turnsRef.current = [
      ...turnsRef.current,
      { role: "user", parts: [{ text: `(User is viewing the ${selectedWindow} window.) ${question}` }] },
    ];

    try {
      for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
        const res = await fetch(WORKER_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ context: summary, contents: turnsRef.current }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        const calls: Array<{ name: string; args: Record<string, unknown> }> = json.functionCalls ?? [];
        if (calls.length && round < MAX_TOOL_ROUNDS) {
          setProgress(`Checking ${calls.map(c => fcLabel(c.args ?? {})).join(", ")}…`);
          // Record the model's tool request, then answer it from the feed.
          turnsRef.current = [
            ...turnsRef.current,
            { role: "model", parts: calls.map(fc => ({ functionCall: fc })) },
            {
              role: "user",
              parts: calls.map(fc => ({
                functionResponse: {
                  name: fc.name,
                  response: { result: getDashboardData(data, fc.args ?? {}, selectedWindow) },
                },
              })),
            },
          ];
          continue;
        }

        const answer = String(json.text ?? "").trim() || "I couldn't produce an answer from the data.";
        turnsRef.current = [...turnsRef.current, { role: "model", parts: [{ text: answer }] }];
        setMessages(prev => [...prev, { role: "assistant", text: answer }]);
        break;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  function resetChat() {
    setMessages([]);
    turnsRef.current = [];
    setError(null);
  }

  return (
    <>
      {/* Floating launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold text-white shadow-lg transition-transform hover:scale-105"
          style={{ background: "var(--gaf-primary)", fontFamily: "var(--font-display)" }}
          aria-label="Ask Gary about this data"
        >
          <img src={garyAvatar} alt="" className="w-7 h-7 rounded-full object-cover -ml-1" style={{ border: "2px solid rgba(255,255,255,0.6)" }} />
          Ask Gary
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-0 right-0 sm:bottom-5 sm:right-5 z-50 w-full sm:w-[440px] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl"
          style={{
            background: "var(--gaf-card-bg)",
            border: "1px solid var(--gaf-card-border)",
            maxHeight: "min(660px, 85vh)",
          }}
          role="dialog"
          aria-label="Ask Gary — AI data assistant"
        >
          {/* Header */}
          <div
            className="flex items-center gap-2 px-4 py-3 text-white shrink-0"
            style={{ background: "var(--gaf-primary)" }}
          >
            <img src={garyAvatar} alt="Gary" className="w-8 h-8 rounded-full object-cover shrink-0" style={{ border: "2px solid rgba(255,255,255,0.6)" }} />
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                Ask Gary
              </p>
              <p className="text-[10px] opacity-80">
                Full dashboard access — all channels, all windows
              </p>
            </div>
            {messages.length > 0 && (
              <button
                onClick={resetChat}
                className="ml-auto text-[10px] px-2 py-1 rounded-full"
                style={{ background: "rgba(255,255,255,0.2)" }}
                title="Start a fresh conversation"
              >
                New chat
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className={`${messages.length > 0 ? "" : "ml-auto "}w-7 h-7 rounded-full flex items-center justify-center text-lg leading-none shrink-0`}
              style={{ background: "rgba(255,255,255,0.2)" }}
              aria-label="Close chat"
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ minHeight: 220 }}>
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs" style={{ color: "var(--gaf-text-muted)" }}>
                  Ask Gary anything — he can pull any table on this dashboard (campaigns, keywords,
                  products, experiments…) across every window to find cross-platform insights.
                </p>
                {STARTERS.map(q => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="block w-full text-left text-xs px-3 py-2 rounded-lg transition-colors"
                    style={{
                      background: "var(--gaf-primary-light)",
                      color: "var(--gaf-text-primary)",
                      border: "1px solid var(--gaf-card-border)",
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                {m.role === "user" ? (
                  <div
                    className="max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed"
                    style={{ background: "var(--gaf-primary)", color: "#fff", borderBottomRightRadius: 6 }}
                  >
                    {m.text}
                  </div>
                ) : (
                  <div
                    className="max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed"
                    style={{ background: "#f3f4f6", color: "var(--gaf-text-primary)", borderBottomLeftRadius: 6 }}
                    dangerouslySetInnerHTML={{ __html: mdToHtml(m.text) }}
                  />
                )}
              </div>
            ))}

            {busy && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-2xl text-xs" style={{ background: "#f3f4f6", color: "var(--gaf-text-muted)" }}>
                  {progress ?? (
                    <span className="inline-flex gap-1 text-sm">
                      <span className="animate-bounce" style={{ animationDelay: "0ms" }}>·</span>
                      <span className="animate-bounce" style={{ animationDelay: "120ms" }}>·</span>
                      <span className="animate-bounce" style={{ animationDelay: "240ms" }}>·</span>
                    </span>
                  )}
                </div>
              </div>
            )}

            {error && (
              <p className="text-xs" style={{ color: "var(--gaf-delta-neg)" }}>
                Couldn't reach the AI service ({error}). Try again.
              </p>
            )}
          </div>

          {/* Input */}
          <form
            className="flex items-center gap-2 px-3 py-3 border-t shrink-0"
            style={{ borderColor: "var(--gaf-row-border)", background: "var(--gaf-card-bg)" }}
            onSubmit={e => { e.preventDefault(); send(input); }}
          >
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask across any channel or window…"
              className="flex-1 text-sm px-3 py-2 rounded-lg focus:outline-none"
              style={{
                border: "1px solid var(--gaf-input-border)",
                background: "var(--gaf-page-bg)",
                color: "var(--gaf-text-primary)",
              }}
              aria-label="Question for the AI assistant"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="px-3.5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--gaf-primary)" }}
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
