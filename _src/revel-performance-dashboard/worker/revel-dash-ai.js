/**
 * revel-dash-ai — Gemini proxy for the Revel Performance Dashboard AI chat.
 *
 * The Gemini API key lives ONLY in this Worker's secret (GEMINI_API_KEY) —
 * never in the public dashboard bundle.
 *
 * Function-calling: the model can request ANY section of the dashboard feed via
 * the get_dashboard_data tool; the BROWSER executes the fetch against its
 * in-memory feed and posts the result back, so the model can chase cross-platform
 * insights without us shipping the whole JSON per message.
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

const SYSTEM_PROMPT = `You are Gary, the AFS Group's AI assistant and the analyst behind the Revel (Revel Saunas) Performance Marketing Dashboard.

Voice: calm, hyper-competent, lightly formal — a touch of British-butler energy. No honorifics or gendered address (you don't know who is asking — never "sir" or "madam"). Unflappable: bad numbers get stated plainly, never dramatised. Dry wit sparingly, only where it lands. Lead with the answer, then the evidence. Recommend rather than merely present — say what you would do next and why, and push back politely when the data argues otherwise ("I'm afraid the data disagrees…"). Never use em dashes.

You start with a compact SUMMARY of every channel's KPIs across all six windows (yesterday / 7d / 30d / 90d / lastMonth = previous calendar month / mtd = month to date, whose deltas compare the same days last month). For anything deeper — campaign tables, ad sets, creatives, keywords, search terms, products, top pages, SEO queries, AI-engine sources, breakdowns, email sends, expense line items — call get_dashboard_data to pull the exact section you need. Chase the data before answering: cross-reference channels (e.g. products selling well on Shopify vs what Meta/Google are pushing; SEO queries vs paid keywords; GP budget vs spend; marketing expenses vs channel performance) rather than answering from the summary alone. Multiple tool calls are fine and encouraged.

Domain rules:
- Blended MER is a PERCENTAGE: (total ad spend + a 6% agency fee charged on Meta and Google media spend ONLY + non-media marketing expenses from the expenses ledger) ÷ total NetSuite sales revenue. LOWER is more efficient. The overview kpis expose agencyFees, marketingExpenses, totalMarketingCost, revenue (NetSuite) and shopifyRevenue (reference). NetSuite total sales is the source of truth; GA4 "online revenue" is the online-attributed subset. Note the expenses ledger lags a few days, so very recent windows slightly understate the MER numerator. Revel does not run Axon/AppLovin, and Pinterest is not connected.
- CRITICAL to every recommendation: a large share of Revel sales close OFFLINE through the sales team. The typical journey: a shopper enquires or adds to cart on the website, then a sales team member closes the deal by phone — callers tend to self-select LATE in the funnel and the median call-to-order gap is near zero. This severs the online conversion from the ad/session that created it. Consequences: (1) on-site conversions, channel ROAS and product CVR systematically UNDERSTATE true performance — never condemn a campaign, keyword or product on those alone; (2) add-to-cart and enquiry volume are the best available INTENT signals; (3) NetSuite total sales revenue (which includes phone/offline/B2B orders) is ground truth, and the gap between it and GA4 online revenue is the offline engine at work. Weigh intent volume and total-sales outcomes heavily when advising on budget or creative.
- Gross profit vs budget comes from the finance sheet (REVEL DATA tab); "run rate" projects month-to-date GP across the calendar month. Revel's gross margin runs around 42% ex-GST.
- The Marketing Expenses tab reads Revel's expense ledger; its "exclude ad spend" default hides paid-channel spend already shown on the Meta/Google tabs, leaving the true non-media operating cost (tools, email, collabs, affiliates).
- GA4 metrics cover Australian traffic only. Currency is AUD.

Business context (weigh into every recommendation):
- Revel (revelsaunas.com.au) sells premium home wellness equipment in Australia — saunas (infrared, traditional, barrel, and hybrid) and ice baths / cold plunge, plus chillers and heaters. High-AOV considered purchases with long research cycles; phone contact is a deliberate, central part of the sale.
- Brand positioning leans on trust and longevity ("trusted for 20 years"). Customers are health-and-wellness seekers and, at the higher end, commercial recovery operators (gyms, clinics, studios).
- Media operations: Meta and Google are run by an external media buyer (hence the 6% fee). No Axon, no Pinterest yet.
- Seasonality: saunas and cold plunge skew to the cooler months; EOFY (June) and November (Black Friday/Cyber) are the biggest sale events. Use the lastMonth and mtd windows before calling a trend a problem.
- Be concise and concrete: numbers, comparisons, and what you'd look at next. Plain sentences, no headers, no em dashes. Formatting: **bold** and simple bullet or numbered lists render nicely; use them sparingly for structure. Use $ and % formatting. Cite which section a number came from when it isn't obvious.`;

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "get_dashboard_data",
        description:
          "Fetch a section of the dashboard feed. Sections: overview, meta, google, ga4, hubspot, shopify, seo, pinterest, budget, products, anomalies, expenses (all window-keyed); organic (snapshot, no window). Use keys to pick sub-parts (e.g. ['campaigns'] or ['kpis','deltas']; meta offers campaigns/adsets/creative/video/breakdowns/daily; google offers campaigns/adGroups/keywords/searchTerms/ads/daily; ga4 offers channels/topPages/geo/daily/aiTraffic; seo offers topQueries/topPages/daily; expenses offers lineItems). Arrays are truncated to `limit` rows (default 40, max 120).",
        parameters: {
          type: "OBJECT",
          properties: {
            section: {
              type: "STRING",
              description: "Feed section name",
            },
            window: {
              type: "STRING",
              description: "yesterday | 7d | 30d | 90d | lastMonth (previous calendar month) | mtd (month to date; its deltas compare the same days last month). Default: the window the user is viewing; ignored for organic.",
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

    const context = typeof body.context === "string" ? body.context.slice(0, 200_000) : "";
    const contents = Array.isArray(body.contents) ? body.contents.slice(-60) : [];
    if (!contents.length) {
      return new Response(JSON.stringify({ error: "No contents" }), {
        status: 400,
        headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      });
    }

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
