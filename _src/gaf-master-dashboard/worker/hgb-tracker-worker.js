/**
 * gaf-hgb-tracker — live backing store for the Home Gym Builder BHAG tracker.
 *
 * Replaces the committed hgb-tracker.json (hand-edited on every refresh) with a
 * small KV-backed store: a NetSuite Scheduled Script computes the numbers daily
 * and POSTs them here; the dashboard GETs the latest value, same shape as the
 * old JSON file. Same pattern as gaf-dash-ai / the "Gym designs created" stats
 * endpoint already used elsewhere on this dashboard — NetSuite calls OUT to this
 * worker, so no NetSuite credentials ever need to live in this repo.
 *
 * GET  /            -> current tracker JSON (public, no auth — same numbers were
 *                       already public in the committed JSON this replaces)
 * POST /            -> replace the stored JSON. Requires header
 *                       Authorization: Bearer <HGB_WRITE_SECRET>. Body is stored
 *                       as-is after a minimal shape check, so a bad NetSuite run
 *                       can't silently corrupt the tracker into something the
 *                       dashboard can't render.
 */

const ALLOWED_ORIGINS = [
  "https://the-afs-group.github.io",
  "http://localhost:4173",
  "http://localhost:5173",
];

const KV_KEY = "hgb-tracker";

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

// Loose on purpose — this only guards against a malformed NetSuite payload
// wiping the tracker, not against every possible bad value.
function isValidPayload(d) {
  return (
    d &&
    typeof d.count === "number" &&
    typeof d.target === "number" &&
    typeof d.asOf === "string"
  );
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    if (request.method === "GET") {
      const stored = await env.HGB_KV.get(KV_KEY);
      if (!stored) return json({ error: "not set yet" }, 404, origin);
      return json(JSON.parse(stored), 200, origin);
    }

    if (request.method === "POST") {
      const auth = request.headers.get("Authorization") || "";
      if (auth !== `Bearer ${env.HGB_WRITE_SECRET}`) {
        return json({ error: "unauthorized" }, 401, origin);
      }

      let payload;
      try {
        payload = await request.json();
      } catch {
        return json({ error: "invalid JSON body" }, 400, origin);
      }

      if (!isValidPayload(payload)) {
        return json({ error: "payload missing count/target/asOf" }, 400, origin);
      }

      await env.HGB_KV.put(KV_KEY, JSON.stringify(payload));
      return json({ ok: true }, 200, origin);
    }

    return json({ error: "method not allowed" }, 405, origin);
  },
};
