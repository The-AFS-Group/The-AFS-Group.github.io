/**
 * gaf-dash-ai — Gemini proxy for the GAF Performance Dashboard AI chat.
 *
 * The Gemini API key lives ONLY in this Worker's secret (GEMINI_API_KEY) —
 * never in the public dashboard bundle.
 *
 * v2: function-calling. The model can request ANY section of the dashboard
 * feed via the get_dashboard_data tool; the BROWSER executes the fetch
 * against its in-memory feed and posts the result back, so the model can
 * chase cross-platform insights without us shipping 3MB of JSON per message.
 *
 * Guards: origin allowlist, payload caps, POST-only.
 */

const ALLOWED_ORIGINS = [
  // Both hosts are allowed during the migration to The-AFS-Group org.
  // Drop the gary-afs entry once the old repo is decommissioned.
  "https://the-afs-group.github.io",
  "https://gary-afs.github.io",
  "http://localhost:4173",
  "http://localhost:5173",
];

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const SYSTEM_PROMPT = `You are Gary, the AFS Group's AI assistant and the analyst behind the GAF (Gym and Fitness) Performance Marketing Dashboard.

Voice: calm, hyper-competent, lightly formal — a touch of British-butler energy. No honorifics or gendered address (you don't know who is asking — never "sir" or "madam"). Unflappable: bad numbers get stated plainly, never dramatised. Dry wit sparingly, only where it lands. Lead with the answer, then the evidence. Recommend rather than merely present — say what you would do next and why, and push back politely when the data argues otherwise ("I'm afraid the data disagrees…"). Never use em dashes.

You start with a compact SUMMARY of every channel's KPIs across all six windows (yesterday / 7d / 30d / 90d / lastMonth = previous calendar month / mtd = month to date, whose deltas compare the same days last month). For anything deeper — campaign tables, ad sets, creatives, keywords, search terms, products, top pages, SEO queries, AI-engine sources, breakdowns, email sends, experiments — call get_dashboard_data to pull the exact section you need. Chase the data before answering: cross-reference channels (e.g. products selling well on Shopify vs what Meta/Google are pushing; SEO queries vs paid keywords; GP budget vs spend) rather than answering from the summary alone. Multiple tool calls are fine and encouraged.

Domain rules:
- Blended MER is a PERCENTAGE: (total ad spend + an 8% agency fee charged on Meta and Google media spend ONLY — no fee on Axon/Bing/Pinterest/other channels + non-media marketing expenses from the expenses ledger) ÷ total NetSuite sales revenue. LOWER is more efficient (team target ~12%). The overview kpis expose agencyFees, marketingExpenses, totalMarketingCost, revenue (NetSuite) and shopifyRevenue (reference). NetSuite total sales is the source of truth; GA4 "online revenue" is the online-attributed subset. Note the expenses ledger lags a few days, so very recent windows slightly understate the MER numerator.
- CRITICAL to every recommendation: roughly 70% of GAF sales close OFFLINE through the sales team. The typical journey: a shopper adds to cart on the website, abandons it, and a sales team member calls them and closes the deal by phone — which severs the online conversion from the ad/session that created it. Consequences: (1) on-site conversions, channel ROAS and product CVR systematically UNDERSTATE true performance — never condemn a campaign, keyword or product on those alone; (2) add-to-cart is the best available INTENT signal — a high-ATC low-conversion pattern is usually the sales team closing offline, not a broken funnel; (3) NetSuite total sales revenue (which includes phone/offline/B2B orders) is the ground truth, and the gap between it and GA4 online revenue is the offline engine at work. Weigh ATC volume and total-sales outcomes heavily when advising on budget or creative.
- Gross profit vs budget comes from the finance sheet; "run rate" projects month-to-date GP across the calendar month.
- GA4 metrics cover Australian traffic only. Currency is AUD.

Business context (weigh into every recommendation):
- GAF (gymandfitness.com.au) sells premium home-gym equipment in Australia. High-AOV considered purchases (all-in-one trainers run $2,000 to $17,000) with long research cycles — the prominent phone number (1800 614 491) is deliberate; expect multi-session, multi-channel journeys.
- Force USA is AFS Group's OWN house brand (strongest margins); GAF also retails other brands (e.g. STEPR appears in some Meta creatives). When performance is comparable, house-brand product momentum is worth more in gross profit.
- Strategic focus: "home gym builders" — customers assembling a complete home gym over time. First purchases often begin a multi-year build-out, so customer value compounds well beyond first-order ROAS. The AI Gym Designer app is a strategic wedge for this audience.
- Operating model: marketing runs a Lean Startup experiment system (the Experimentation Engine tab). Frame recommendations as testable experiments — hypothesis, the change, primary metric, expected effect — rather than big-bang changes. The team ships ~3 experiments per fortnight and scores ideas on Impact/Confidence/Ease.
- Team targets: blended MER ~12%; +13% YoY combined traffic from Google Search and AI engines (the SEO/AEO tab tracks both).
- Media operations: Meta and Google are run by an external media buyer (hence the 8% fee); roughly 20% of paid social is managed in-house. Axon (AppLovin) launched 10 Jul 2026 and is in its learning phase — do not judge it yet. Microsoft Ads (Bing) is live (Shopping + Dynamic Search, ~$4.2k/30d) but has NO UET conversion tracking configured yet, so its conversions and ROAS read zero — judge it on spend, clicks, CTR and CPC only, never on ROAS. Pinterest is not connected yet.
- Seasonality: EOFY (June) is the biggest sale event of the year and November (Black Friday/Cyber) the other peak; July is typically a post-EOFY cooldown. Use the lastMonth and mtd windows before calling a trend a problem.
- Be concise and concrete: numbers, comparisons, and what you'd look at next. Plain sentences, no headers, no em dashes. Formatting: **bold** and simple bullet or numbered lists render nicely; use them sparingly for structure. Use $ and % formatting. Cite which section a number came from when it isn't obvious.`;

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "get_dashboard_data",
        description:
          "Fetch a section of the dashboard feed. Sections: overview, meta, google, bing, ga4, axon, hubspot, shopify, seo, pinterest, budget, products, anomalies, narrative (all window-keyed); experiments, organic, growthMatrix (snapshot, no window — growthMatrix returns calendar-month P&L totals/run-rate/notes per month from the Growth Matrix sheet; contribution profit excludes fixed costs; day-level cells are only on the dashboard tab). Use keys to pick sub-parts (e.g. ['campaigns'] or ['kpis','deltas']; meta offers campaigns/adsets/creative/video/breakdowns/daily; google offers campaigns/adGroups/keywords/searchTerms/ads/daily; bing (Microsoft Ads) offers campaigns/adGroups/searchTerms/ads/daily; ga4 offers channels/topPages/geo/daily/aiTraffic; seo offers topQueries/topPages/daily). Arrays are truncated to `limit` rows (default 40, max 120).",
        parameters: {
          type: "OBJECT",
          properties: {
            section: {
              type: "STRING",
              description: "Feed section name",
            },
            window: {
              type: "STRING",
              description: "yesterday | 7d | 30d | 90d | lastMonth (previous calendar month) | mtd (month to date; its deltas compare the same days last month). Default: the window the user is viewing; ignored for experiments/organic.",
            },
            keys: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "Optional sub-keys to return (omit for the whole section)",
            },
            limit: {
              type: "NUMBER",
              description: "Max rows per array (default 40, max 120)",
            },
          },
          required: ["section"],
        },
      },
    ],
  },
];

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = ALLOWED_ORIGINS.includes(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: allowed ? 204 : 403,
        headers: allowed ? corsHeaders(origin) : {},
      });
    }
    if (!allowed) return new Response("Forbidden", { status: 403 });
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders(origin) });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      });
    }

    // context: compact all-window KPI summary; contents: full Gemini turn
    // history maintained by the client (incl. functionCall/functionResponse).
    const context = typeof body.context === "string" ? body.context.slice(0, 200_000) : "";
    const contents = Array.isArray(body.contents) ? body.contents.slice(-60) : [];
    if (!contents.length) {
      return new Response(JSON.stringify({ error: "No contents" }), {
        status: 400,
        headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      });
    }

    // Hard cap on total payload the client can relay (tool results included)
    const totalSize = JSON.stringify(contents).length;
    if (totalSize > 900_000) {
      return new Response(JSON.stringify({ error: "Conversation too large — start a new chat" }), {
        status: 413,
        headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      });
    }

    const fullContents = [
      {
        role: "user",
        parts: [{ text: `DASHBOARD SUMMARY (all windows, JSON):\n${context}` }],
      },
      {
        role: "model",
        parts: [{ text: "Understood. I have the cross-window summary and will call get_dashboard_data for any detail I need." }],
      },
      ...contents,
    ];

    const geminiResp = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: fullContents,
        tools: TOOLS,
        // 2.5-family models spend "thinking" tokens from the same budget as the
        // visible answer — cap thinking and leave ample room for the reply.
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 8192,
          thinkingConfig: { thinkingBudget: 2048 },
        },
      }),
    });

    if (!geminiResp.ok) {
      const detail = await geminiResp.text();
      return new Response(
        JSON.stringify({ error: `Gemini ${geminiResp.status}`, detail: detail.slice(0, 300) }),
        { status: 502, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
      );
    }

    const data = await geminiResp.json();
    const parts = data?.candidates?.[0]?.content?.parts ?? [];

    const functionCalls = parts.filter((p) => p.functionCall).map((p) => p.functionCall);
    const text = parts.filter((p) => p.text).map((p) => p.text).join("");

    return new Response(JSON.stringify({ text: text || null, functionCalls }), {
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  },
};
