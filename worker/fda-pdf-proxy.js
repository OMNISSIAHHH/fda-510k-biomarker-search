// Generic byte-relay proxy for FDA 510(k) Decision Summary PDFs.
//
// accessdata.fda.gov sends no Access-Control-Allow-Origin header, so a browser blocks any
// client-side fetch() from reading a PDF hosted there — same problem as the LDT database
// (see ldt-proxy.js). This Worker just fetches the PDF server-side and relays the raw bytes
// with CORS enabled; it does NOT parse the PDF itself (Cloudflare Workers have no built-in
// PDF parser, and bundling one would require a build step this project intentionally
// avoids). Text extraction (looking for the "Measurand:" field) happens client-side using
// PDF.js, loaded from a CDN just like Chart.js/SheetJS already are.
//
// Deploy exactly like ldt-proxy.js — paste into a new Cloudflare Worker via the dashboard,
// no local Node/wrangler needed. See worker/README.md.

const UPSTREAM_BASE = 'https://www.accessdata.fda.gov/cdrh_docs/reviews';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonError(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders() },
  });
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    const url = new URL(request.url);
    const kNumber = (url.searchParams.get('k') || '').trim().toUpperCase();

    if (!/^K\d{6}$/.test(kNumber)) {
      return jsonError({ error: 'Missing or malformed required query parameter: k (expected like K123456)' }, 400);
    }

    let res;
    try {
      res = await fetch(`${UPSTREAM_BASE}/${kNumber}.pdf`, {
        headers: {
          // accessdata.fda.gov's bot detection blocks requests without a browser-like UA
          // (returns a small "apology" HTML page instead of the PDF).
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        },
      });
    } catch (err) {
      return jsonError({ error: 'Upstream fetch failed', detail: String(err && err.message || err) }, 502);
    }

    if (res.status === 404) {
      return jsonError({ error: 'No Decision Summary available for this K number', kNumber }, 404);
    }
    if (!res.ok) {
      return jsonError({ error: `Upstream returned HTTP ${res.status}`, kNumber }, 502);
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('pdf')) {
      // Likely the bot-detection "apology" page rather than a real PDF.
      return jsonError({ error: 'Upstream did not return a PDF (possibly rate-limited) — try again shortly', kNumber }, 502);
    }

    return new Response(res.body, {
      status: 200,
      headers: { 'Content-Type': 'application/pdf', ...corsHeaders() },
    });
  },
};
