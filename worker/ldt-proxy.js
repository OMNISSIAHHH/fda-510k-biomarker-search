// LDT search proxy for the NY State Wadsworth Center Clinical Laboratory Evaluation
// Program (CLEP) "Search Approved Laboratory Developed Tests" tool.
//
// wadsworth.org sends no Access-Control-Allow-Origin header, so a browser blocks any
// client-side fetch() from reading its response. This Worker fetches it server-side
// (no CORS restriction between servers), parses the returned HTML with HTMLRewriter,
// and returns clean JSON with CORS enabled — so the client-side biomarker search tool
// can call this Worker instead of wadsworth.org directly.
//
// Deploy: paste this file's contents into a new Worker in the Cloudflare dashboard
// (Workers & Pages -> Create -> Create Worker -> edit code -> paste -> Deploy).
// No local Node/wrangler needed. Then set the deployed Worker's URL as LDT_PROXY_URL
// in FDA510kBiomarkerSearch.html.

const UPSTREAM_BASE = 'https://www.wadsworth.org/regulatory/clep/approved-ldt';
const MAX_RECORDS = 50; // bound response size/parse time regardless of how many match
// Requesting items_per_page=All asks wadsworth.org to render every matching row in one
// response. For a generic term (a bare 2-3 letter antigen abbreviation, say) that page can
// run to thousands of rows and take long enough to blow past this Worker's fetch/CPU
// budget. The "Showing X of Y Records" total is accurate regardless of page size, so
// request a bounded page instead — same total, far more predictable latency. Must be one
// of the exposed filter's actual <select> options (5/10/20/25/50/All) — an arbitrary value
// like 100 silently breaks the filter server-side and the page renders as if 0 matched.
const ITEMS_PER_PAGE = 50;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders() },
  });
}

function cleanText(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

async function searchLdt(term, status) {
  const upstream = new URL(UPSTREAM_BASE);
  upstream.searchParams.set('analyte_name_value', term);
  upstream.searchParams.set('field_analyte_name_value_op', 'word'); // "contains any word", matches the site's own documented default
  upstream.searchParams.set('ltd_status_value', status || 'All');
  upstream.searchParams.set('items_per_page', String(ITEMS_PER_PAGE));

  const res = await fetch(upstream.toString(), {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LDTLookupProxy/1.0; +biomarker search tool)' },
  });
  if (!res.ok) {
    throw new Error(`Upstream returned HTTP ${res.status}`);
  }

  const records = [];
  let current = null;
  let headerText = '';

  const rewriter = new HTMLRewriter()
    .on('.views-row', {
      element() {
        current = {
          facilityName: '', facilityId: '', projectId: '', facilityState: '',
          analyte: '', method: '', specimenType: '', permitCategory: '', status: '',
          detailLink: '',
        };
        records.push(current);
      },
    })
    .on('.views-row .clep-approved-ltd__name', {
      text(t) { if (current) current.facilityName += t.text; },
    })
    .on('.views-row .field--name-field-facility-id .field__item', {
      text(t) { if (current) current.facilityId += t.text; },
    })
    .on('.views-row .field--name-field-project-id .field__item', {
      text(t) { if (current) current.projectId += t.text; },
    })
    .on('.views-row .field--name-field-facility-state-ref .field__item', {
      text(t) { if (current) current.facilityState += t.text; },
    })
    .on('.views-row .field--name-field-analyte-name .field__item', {
      text(t) { if (current) current.analyte += t.text; },
    })
    .on('.views-row .field--name-field-ltd-method .field__item', {
      text(t) { if (current) current.method += t.text; },
    })
    .on('.views-row .field--name-field-ltd-specimen-type .field__item', {
      text(t) { if (current) current.specimenType += t.text; },
    })
    .on('.views-row .field--name-field-ltd-permit-category .field__item', {
      text(t) { if (current) current.permitCategory += t.text; },
    })
    .on('.views-row .field--name-field-ltd-status .field__item', {
      text(t) { if (current) current.status += t.text; },
    })
    .on('.views-row .print a', {
      element(el) { if (current) current.detailLink = el.getAttribute('href') || ''; },
    })
    .on('.view__header h3', {
      text(t) { headerText += t.text; },
    });

  await rewriter.transform(res).arrayBuffer(); // drain the stream so all handlers run

  for (const r of records) {
    for (const key of Object.keys(r)) r[key] = cleanText(r[key]);
    if (r.detailLink && r.detailLink.startsWith('/')) {
      r.detailLink = 'https://www.wadsworth.org' + r.detailLink;
    }
  }

  const totalMatch = headerText.match(/of\s+([\d,]+)\s+Records?/i);
  const total = totalMatch ? parseInt(totalMatch[1].replace(/,/g, ''), 10) : records.length;

  return { total, records: records.slice(0, MAX_RECORDS) };
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    const url = new URL(request.url);
    const term = (url.searchParams.get('q') || '').trim();
    const status = url.searchParams.get('status') || 'All';

    if (!term) {
      return json({ error: 'Missing required query parameter: q' }, 400);
    }

    try {
      const { total, records } = await searchLdt(term, status);
      return json({ term, total, count: records.length, records });
    } catch (err) {
      return json({ error: 'LDT lookup failed', detail: String(err && err.message || err) }, 502);
    }
  },
};
